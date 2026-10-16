<template>
  <ScreenFit>
    <div class="board">
      <TitleBar />
      <!-- 中央地图：MapLibre 实例挂载点 -->
      <div ref="mapContainer" class="map-container" />
      <DrillBreadcrumb class="crumb-pos" :province="drillProvince" @back="exitDrill" />
      <RegionNav
        class="region-nav-pos"
        :active-id="activePresetId"
        :tour-active="tourActive"
        :tour-label="tourLabel"
        @fly="flyToPreset"
        @toggle-tour="tourActive ? stopTour() : startTour()"
      />
      <!-- 左侧面板栈：榜单 + 图层管理 -->
      <div class="left-stack">
        <TopCityPanel
          :cities="cities"
          :highlighted-city="highlightedCity"
          :highlight-province="highlightProvince"
          @hover-city="hoverCityName = $event"
        />
        <LayerPanel
          :mode="mode"
          :point-style="pointStyle"
          :show-points="showPoints"
          :show-heatmap="showHeatmap"
          :show-arcs="showArcs"
          :show-trips="showTrips"
          :show-region="showRegion"
          :show-labels="showLabels"
          :show-annotations="showAnnotations"
          :opacity="layerOpacity"
          @change-point-style="pointStyle = $event"
          @toggle-points="showPoints = $event"
          @toggle-heatmap="showHeatmap = $event"
          @toggle-arcs="showArcs = $event"
          @toggle-trips="showTrips = $event"
          @toggle-region="showRegion = $event"
          @toggle-labels="showLabels = $event"
          @toggle-annotations="showAnnotations = $event"
          @change-opacity="setOpacity"
        />
      </div>
      <FlowStatPanel class="panel-pos panel-right" :flows="flows" />
      <TimelinePlayer v-model="period" class="timeline-pos" :periods="periods" />
      <MapControls
        class="map-controls-pos"
        :auto-rotate="autoRotate"
        @zoom-in="zoomIn()"
        @zoom-out="zoomOut()"
        @reset-north="resetNorth()"
        @reset-view="resetView()"
        @toggle-rotate="setAutoRotate"
      />
      <BasemapSwitch v-model="basemapId" class="basemap-pos" />
      <ModeSwitch class="mode-switch-pos" :mode="mode" @change="onModeChange" />
      <BootOverlay
        v-if="bootVisible"
        :progress="bootProgress"
        :status="bootStatus"
        :error="loadError"
        @gone="bootVisible = false"
      />
    </div>
  </ScreenFit>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import BasemapSwitch from './components/BasemapSwitch.vue'
import BootOverlay from './components/BootOverlay.vue'
import DrillBreadcrumb from './components/DrillBreadcrumb.vue'
import MapControls from './components/MapControls.vue'
import ModeSwitch from './components/ModeSwitch.vue'
import RegionNav from './components/RegionNav.vue'
import ScreenFit from './components/ScreenFit.vue'
import TimelinePlayer from './components/TimelinePlayer.vue'
import TitleBar from './components/TitleBar.vue'
import FlowStatPanel from './panels/FlowStatPanel.vue'
import LayerPanel from './panels/LayerPanel.vue'
import TopCityPanel from './panels/TopCityPanel.vue'
import {
  CAMERA_PRESETS,
  TOUR_PERIOD_EVERY,
  TOUR_STEP_MS,
  type CameraPreset,
} from './config/cameras'
import { BASEMAP_OPTIONS, DEFAULT_BASEMAP_ID } from './config/basemap'
import { useDeckOverlay } from './composables/useDeckOverlay'
import { useLoopProgress } from './composables/useLoopProgress'
import { useMapLibre, type ScreenMode } from './composables/useMapLibre'
import { useCityLabels } from './composables/useCityLabels'
import { useMapAnnotations } from './composables/useMapAnnotations'
import {
  createBoardDescriptors,
  HISTORY_COUNT,
  LOOP_SECONDS,
  type LayerOpacityKey,
  type PointStyle,
} from './map/layers/boardLayers'
import type { ProvinceFeature } from './map/layers/regionGeoJson'
import type { CityMetric } from './mock/cities'
import type { FlowOD } from './mock/flows'
import { geoBBox, loadCityBoundaries, type CityBoundaryFeature } from './services/boundaryService'
import type { BoardDataSource, Period } from './services/dataSource'
import { MockDataSource } from './services/mockDataSource'
import { reportMonitorEvent } from './services/monitor'

/** 大屏全局状态（不引入 pinia，经 props/emits 下发） */
const mode = ref<ScreenMode>('3d')
const showHeatmap = ref(false)
/** 当前底图 id（BasemapSwitch 双向绑定） */
const basemapId = ref(DEFAULT_BASEMAP_ID)
/** 图层开关（M3.1 图层管理）：散点呈现 / 城市图层 / 标注 / 轨迹 / 飞线 / 省界 */
const pointStyle = ref<PointStyle>('scatter')
const showPoints = ref(true)
const showLabels = ref(true)
/** 地图注记（M5）：在卫星/地形等无注记瓦片上叠加中文地名，默认开启 */
const showAnnotations = ref(true)
const showTrips = ref(true)
const showArcs = ref(true)
const showRegion = ref(true)
/** 图层透明度 0-1（M3.1 滑杆） */
const layerOpacity = ref<Record<LayerOpacityKey, number>>({
  city: 1,
  heatmap: 1,
  arcs: 1,
  trips: 1,
  region: 1,
  labels: 1,
  annotations: 1,
})

/** 数据服务层（M2.7）：面板与图层只依赖 BoardDataSource 接口 */
const dataSource: BoardDataSource = new MockDataSource()
const periods = ref<Period[]>([])
const period = ref<Period>('')
const cities = ref<CityMetric[]>([])
const flows = ref<FlowOD[]>([])
/** 城市近 12 期指标历史：tooltip sparkline（M3.4） */
const cityHistory = ref<Map<string, number[]>>(new Map())

/** 初始化周期列表并默认定位到中期（数据就绪后时间轴出现并触发首次加载） */
async function initPeriods() {
  periods.value = await dataSource.listPeriods()
  period.value = periods.value[Math.floor(periods.value.length / 2)] ?? ''
}
void initPeriods()

/** 周期切换：异步拉取该期数据 + 历史序列，驱动图层与面板同步刷新（失败上报监控 M4.6） */
watch(period, async (p) => {
  if (!p) return
  try {
    const [nextCities, nextFlows] = await Promise.all([
      dataSource.getCities(p),
      dataSource.getFlows(p),
    ])
    cities.value = nextCities
    flows.value = nextFlows
    const historyEntries = await Promise.all(
      nextCities.map(async (c) => [c.name, await dataSource.getCityHistory(p, c.name, HISTORY_COUNT)] as const),
    )
    cityHistory.value = new Map(historyEntries)
  } catch (err) {
    reportMonitorEvent({ type: 'data-source-error', source: 'period-fetch', detail: String(err) })
  }
})

/** 首屏引导（M3.5）：地图引擎 → 底图/数据 → 就绪淡出 */
const bootProgress = ref(8)
const bootStatus = ref('初始化地图引擎…')
const bootVisible = ref(true)
let bootDone = false

const mapContainer = ref<HTMLElement | null>(null)
const {
  mapInstance,
  mapReady,
  styleVersion,
  autoRotate,
  loadError,
  setMode,
  setBasemap,
  setAutoRotate,
  zoomIn,
  zoomOut,
  resetNorth,
  resetView,
  flyToCamera,
} = useMapLibre(mapContainer)

watch(mapReady, (map) => {
  if (!map || bootDone) return
  bootProgress.value = Math.max(bootProgress.value, 55)
  bootStatus.value = '加载业务数据…'
})

/** 全局循环进度：彗星尾迹与轨迹回放共用同一时间基准 */
const progress = useLoopProgress(LOOP_SECONDS)

/** 省份下钻状态（M2.5） */
const drillProvince = ref<{ name: string; adcode: number } | null>(null)
const drillFeatures = ref<CityBoundaryFeature[]>([])
/** 下钻前的自转开关，返回全国时恢复 */
let rotateBeforeDrill: boolean | null = null

/** 面板联动状态（M3.3）：地图 hover 高亮城市 → 图层；点击回写 → 面板高亮 */
const hoverCityName = ref<string | null>(null)
const highlightedCity = ref<string | null>(null)
const highlightProvince = ref<string | null>(null)

/** 图层注册表（M2.1）：所有 deck 图层以描述符声明，overlay 仅按注册表聚合 */
const descriptors = createBoardDescriptors({
  cities,
  flows,
  progress,
  showHeatmap,
  pointStyle,
  showTrips,
  showPoints,
  showArcs,
  showRegion,
  opacity: layerOpacity,
  hoverCityName,
  cityHistory,
  onProvinceClick: handleProvinceClick,
  onCityClick: handleCityClick,
  drillFeatures,
})
useDeckOverlay(mapReady, descriptors)

/** 地图注记（M5）：矢量地名叠加层，先于城市标注注册使其垫在业务标注之下 */
useMapAnnotations(
  mapReady,
  styleVersion,
  showAnnotations,
  computed(() => layerOpacity.value.annotations),
)

/** 城市中文标注（M2.4）：maplibre 原生 symbol 层，deck TextLayer 在 globe 下不渲染 */
useCityLabels(
  mapReady,
  styleVersion,
  cities,
  showLabels,
  computed(() => layerOpacity.value.labels),
)

/** 图层透明度滑杆写入 */
function setOpacity(key: LayerOpacityKey, value: number) {
  layerOpacity.value = { ...layerOpacity.value, [key]: value }
}

/** 点击城市散点/柱：左侧 TOP 面板高亮该城市（M3.3） */
function handleCityClick(city: CityMetric) {
  highlightedCity.value = city.name
  highlightProvince.value = null
}

/** 点击省份：拉取市界 GeoJSON（内存缓存）→ 面包屑 + 市界描边 + 平滑飞行 */
async function handleProvinceClick(feature: ProvinceFeature) {
  const { name, adcode } = feature.properties
  if (drillProvince.value?.adcode === adcode) return
  try {
    const collection = await loadCityBoundaries(adcode)
    if (rotateBeforeDrill === null) rotateBeforeDrill = autoRotate.value
    setAutoRotate(false)
    drillProvince.value = { name, adcode }
    drillFeatures.value = collection.features
    highlightedCity.value = null
    highlightProvince.value = name
    mapInstance.value?.fitBounds(geoBBox(collection.features), {
      padding: { top: 120, bottom: 150, left: 360, right: 360 },
      maxZoom: 6.5,
      duration: 1200,
      essential: true,
    })
  } catch (err) {
    reportMonitorEvent({ type: 'data-source-error', source: 'boundary', detail: String(err) })
    console.warn(`[下钻] ${name} 市界数据加载失败（内网/离线时降级为全国视角）`, err)
  }
}

/** 面包屑返回全国：清除市界层、恢复自转并复位视角 */
function exitDrill() {
  drillProvince.value = null
  drillFeatures.value = []
  highlightProvince.value = null
  if (rotateBeforeDrill !== null) {
    setAutoRotate(rotateBeforeDrill)
    rotateBeforeDrill = null
  }
  resetView()
}

/** 2D/3D 切换：同一地图实例上切换投影，保持相机中心不变；
 * 2D 平面模式下停用自转（M3.2），切回 3D 时恢复原状态 */
let rotateBefore2d: boolean | null = null
function onModeChange(next: ScreenMode) {
  mode.value = next
  setMode(next)
  if (next === '2d') {
    rotateBefore2d = autoRotate.value
    setAutoRotate(false)
  } else if (rotateBefore2d !== null) {
    setAutoRotate(rotateBefore2d)
    rotateBefore2d = null
  }
}

/** 区域快捷导航（M3.2）：预设机位平滑飞行 */
const activePresetId = ref<string | null>(CAMERA_PRESETS[0].id)

function flyToPreset(preset: CameraPreset) {
  activePresetId.value = preset.id
  flyToCamera(preset)
}

/** 大屏轮播模式（M3.6）：定时轮播预设机位 + 数据片，ESC 退出 */
const tourActive = ref(false)
const tourIndex = ref(0)
const tourLabel = computed(
  () => CAMERA_PRESETS[tourIndex.value % CAMERA_PRESETS.length].label,
)
let tourTimer: number | undefined
let rotateBeforeTour: boolean | null = null

function startTour() {
  if (drillProvince.value) exitDrill()
  rotateBeforeTour = autoRotate.value
  setAutoRotate(false)
  tourIndex.value = 0
  tourActive.value = true
  flyToPreset(CAMERA_PRESETS[0])
  tourTimer = window.setInterval(stepTour, TOUR_STEP_MS)
}

function stepTour() {
  tourIndex.value += 1
  const preset = CAMERA_PRESETS[tourIndex.value % CAMERA_PRESETS.length]
  flyToPreset(preset)
  // 每隔 N 个机位推进一期数据切片，形成「机位 + 数据」联合巡览
  if (tourIndex.value % TOUR_PERIOD_EVERY === 0) advancePeriod()
}

function advancePeriod() {
  const list = periods.value
  if (list.length === 0) return
  const idx = list.indexOf(period.value)
  period.value = list[(idx + 1) % list.length] ?? list[0]
}

function stopTour() {
  window.clearInterval(tourTimer)
  tourTimer = undefined
  tourActive.value = false
  if (rotateBeforeTour !== null) {
    setAutoRotate(rotateBeforeTour)
    rotateBeforeTour = null
  }
}

function onTourKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') stopTour()
}

watch(tourActive, (on) => {
  if (on) window.addEventListener('keydown', onTourKeydown)
  else window.removeEventListener('keydown', onTourKeydown)
})

onUnmounted(() => {
  window.clearInterval(tourTimer)
  window.removeEventListener('keydown', onTourKeydown)
})

/** 底图切换：id 变化后按配置应用新样式（样式重载后投影由 useMapLibre 自动恢复） */
watch(basemapId, (id) => {
  const option = BASEMAP_OPTIONS.find((b) => b.id === id)
  if (option) setBasemap(option)
})

/** 首次数据就绪：走满引导进度并安排淡出 */
watch(cityHistory, (map) => {
  if (bootDone || map.size === 0) return
  bootDone = true
  bootProgress.value = 100
  bootStatus.value = '就绪'
})
</script>

<style scoped>
.board {
  position: absolute;
  inset: 0;
}

.map-container {
  position: absolute;
  inset: 0;
}

.panel-pos {
  position: absolute;
  top: 108px;
  z-index: 10;
}

.panel-right {
  right: 28px;
}

.left-stack {
  position: absolute;
  top: 108px;
  left: 28px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 360px;
}

.crumb-pos {
  position: absolute;
  top: 96px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.region-nav-pos {
  position: absolute;
  top: 134px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.timeline-pos {
  position: absolute;
  bottom: 88px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.mode-switch-pos {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}

.basemap-pos {
  position: absolute;
  left: 28px;
  bottom: 30px;
  z-index: 10;
}

.map-controls-pos {
  position: absolute;
  right: 28px;
  bottom: 30px;
  z-index: 10;
}
</style>
