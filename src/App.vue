<template>
  <ScreenFit>
    <div class="board" :class="{ entered }">
      <TitleBar data-enter style="--enter-order: 0" :data-source-label="dataSourceLabel" :is-degraded="isDegraded" />
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
      <div class="left-stack" data-enter style="--enter-order: 1">
        <TopCityPanel
          :cities="activeCities"
          :metric="activeMetric"
          :history="cityHistory"
          :highlighted-city="highlightedCity"
          :highlight-province="highlightProvince"
          @hover-city="hoverCityName = $event"
          @change-metric="activeMetric = $event"
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
      <FlowStatPanel
        class="panel-pos panel-right"
        data-enter
        style="--enter-order: 2"
        :flows="flows"
        :prev-flows="prevFlows"
        @hover-flow="hoverFlow = $event"
      />
      <TimelinePlayer v-model="period" class="timeline-pos" data-enter style="--enter-order: 3" :periods="periods" />
      <MapControls
        class="map-controls-pos"
        data-enter
        style="--enter-order: 3"
        :auto-rotate="autoRotate"
        @zoom-in="zoomIn()"
        @zoom-out="zoomOut()"
        @reset-north="resetNorth()"
        @reset-view="resetView()"
        @toggle-rotate="setAutoRotate"
      />
      <BasemapSwitch v-model="basemapId" class="basemap-pos" data-enter style="--enter-order: 3" />
      <ModeSwitch class="mode-switch-pos" data-enter style="--enter-order: 3" :mode="mode" @change="onModeChange" />
      <DebugHud :period="period" :source-kind="dataSourceKind" />
      <BootOverlay
        v-if="bootVisible"
        :progress="bootProgress"
        :status="bootStatus"
        :error="loadError"
        @gone="onBootGone"
      />
    </div>
  </ScreenFit>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import BasemapSwitch from './components/BasemapSwitch.vue'
import BootOverlay from './components/BootOverlay.vue'
import DebugHud from './components/DebugHud.vue'
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
import { BASEMAP_OPTIONS } from './config/basemap'
import { CAMERA_PRESETS, type CameraPreset } from './config/cameras'
import { boardConfig, initBoardConfig } from './config/runtime'
import { useBoardData } from './composables/useBoardData'
import { useCityLabels } from './composables/useCityLabels'
import { useDeckOverlay } from './composables/useDeckOverlay'
import { useLayerToggles } from './composables/useLayerToggles'
import { useLoopProgress } from './composables/useLoopProgress'
import { useMapAnnotations } from './composables/useMapAnnotations'
import { useMapLibre, type ScreenMode } from './composables/useMapLibre'
import { useProvinceDrill } from './composables/useProvinceDrill'
import { useTourMode } from './composables/useTourMode'
import { useWatchdog } from './composables/useWatchdog'
import { createBoardDescriptors, LOOP_SECONDS } from './map/layers/boardLayers'
import type { CityMetric } from './mock/cities'
import { createDataSource } from './services/createDataSource'
import type { BoardDataSource } from './services/dataSource'

// 数据源装配（M7.3/M9.4）：先加载运行配置，再按配置装配数据源；角标 mock=演示 / http=实时
const dataSourceRef = shallowRef<BoardDataSource | null>(null)
const isDegraded = ref(false)
const dataSourceLabel = computed(() => {
  const ds = dataSourceRef.value
  return ds ? (ds.kind === 'mock' ? '演示数据' : '实时数据') : null
})
/** HUD（M9.1）消费的原始 kind：mock / http / null */
const dataSourceKind = computed(() => dataSourceRef.value?.kind ?? null)

// ── 数据域（M7.5）：加载/缓存/推送订阅全部内聚在 useBoardData；
// 轮询间隔走响应式运行配置（M9.4），配置加载后动态启停 ──
const { periods, period, cities, flows, prevFlows, cityHistory, activeMetric, refreshCurrent } =
  useBoardData(dataSourceRef, {
    refreshIntervalMs: computed(() => boardConfig.value.refreshIntervalMs),
    // 实时推送默认关闭：TOP5 数据只随时间轴周期变化，部署方可经 board.config.json 开启
    realtimePush: computed(() => boardConfig.value.realtimePush),
  })
const activeCities = computed<CityMetric[]>(() =>
  cities.value.map((c) => ({ ...c, value: c.indicators[activeMetric.value] })),
)

// ── 图层开关域（M7.6）：面板联动的开关与透明度状态 ──
const {
  mode, showHeatmap, basemapId, pointStyle, showPoints, showLabels,
  showAnnotations, showTrips, showArcs, showRegion, layerOpacity, setOpacity,
} = useLayerToggles()

// ── 地图引擎、首屏引导（M3.5）与循环时间基准 ──
const bootProgress = ref(8)
const bootStatus = ref('初始化地图引擎…')
const bootVisible = ref(true)
let bootDone = false

/** 入场编排（M8.3）：引导层退场后面板逐组升起 */
const entered = ref(false)
function onBootGone() {
  bootVisible.value = false
  entered.value = true
}

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

const progress = useLoopProgress(LOOP_SECONDS)

/**
 * 地图缩放响应式信号：驱动 3D 柱径随缩放自适应（metricColumns 像素夹带）。
 * 'zoom' 事件在推近动画期间高频触发，rAF 合并到每帧一次；'moveend' 兜底
 * 捕捉平移导致的纬度变化（地面分辨率随纬度余弦变化）。自转只改经度，不会误触发重建。
 */
const mapZoom = ref(2.2)
watch(mapReady, (map) => {
  if (!map) return
  let frame = 0
  const syncZoom = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      mapZoom.value = map.getZoom()
    })
  }
  map.on('zoom', syncZoom)
  map.on('moveend', syncZoom)
})

const hoverCityName = ref<string | null>(null)
const highlightedCity = ref<string | null>(null)
const hoverFlow = ref<string | null>(null)

const { drillProvince, drillFeatures, highlightProvince, handleProvinceClick, exitDrill } =
  useProvinceDrill({
    mapInstance, autoRotate, setAutoRotate, resetView,
    onEnter: () => { highlightedCity.value = null },
  })

const descriptors = createBoardDescriptors({
  cities: activeCities,
  activeMetric,
  flows,
  progress,
  mapZoom,
  showHeatmap,
  pointStyle,
  showTrips,
  showPoints,
  showArcs,
  showRegion,
  opacity: layerOpacity,
  hoverCityName,
  hoverFlow,
  cityHistory,
  onProvinceClick: handleProvinceClick,
  onCityClick: handleCityClick,
  drillFeatures,
})
useDeckOverlay(mapReady, descriptors)

useMapAnnotations(
  mapReady,
  styleVersion,
  showAnnotations,
  computed(() => layerOpacity.value.annotations),
)

useCityLabels(
  mapReady,
  styleVersion,
  activeCities,
  showLabels,
  computed(() => layerOpacity.value.labels),
)

function handleCityClick(city: CityMetric) {
  highlightedCity.value = city.name
  highlightProvince.value = null
}
const activePresetId = ref<string | null>(CAMERA_PRESETS[0].id)

function flyToPreset(preset: CameraPreset) {
  activePresetId.value = preset.id
  flyToCamera(preset)
}
const { tourActive, tourLabel, startTour, stopTour } = useTourMode({
  autoRotate, setAutoRotate, periods, period, drillProvince, exitDrill, flyToPreset,
})

// ── 无人值守看门狗（M9.3）：连续数据错误降级 / 回前台强刷 / 轮播被打断后自愈恢复 ──
useWatchdog({ sourceRef: dataSourceRef, isDegraded, refreshCurrent, tourActive, startTour })

// ── 运行配置装配（M9.4）：配置加载后应用指标/机位缺省，并按配置选数据源 ──
void initBoardConfig()
  .then((cfg) => {
    activeMetric.value = cfg.defaultMetric
    const preset = CAMERA_PRESETS.find((p) => p.id === cfg.defaultCameraId)
    if (preset) activePresetId.value = preset.id
    return createDataSource({
      VITE_DATA_SOURCE: cfg.dataSource,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    })
  })
  .then((handle) => {
    dataSourceRef.value = handle.source
    isDegraded.value = handle.degraded
  })

// ── 2D/3D 切换：投影切换保持相机中心；2D 停自转（M3.2），切回 3D 恢复 ──
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

watch(basemapId, (id) => {
  const option = BASEMAP_OPTIONS.find((b) => b.id === id)
  if (option) setBasemap(option)
})

watch(mapReady, (map) => {
  if (!map || bootDone) return
  bootProgress.value = Math.max(bootProgress.value, 55)
  bootStatus.value = '加载业务数据…'
})

watch(cityHistory, (map) => {
  if (bootDone || map.size === 0) return
  bootDone = true
  bootProgress.value = 100
  bootStatus.value = '就绪'
})
</script>
