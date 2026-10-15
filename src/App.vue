<template>
  <ScreenFit>
    <div class="board">
      <TitleBar />
      <!-- 中央地图：MapLibre 实例挂载点 -->
      <div ref="mapContainer" class="map-container" />
      <TopCityPanel class="panel-pos panel-left" :cities="cities" />
      <FlowStatPanel
        class="panel-pos panel-right"
        :flows="flows"
        :show-heatmap="showHeatmap"
        @toggle-heatmap="showHeatmap = $event"
      />
      <MapControls
        class="map-controls-pos"
        @zoom-in="zoomIn()"
        @zoom-out="zoomOut()"
        @reset-north="resetNorth()"
        @reset-view="resetView()"
      />
      <BasemapSwitch v-model="basemapId" class="basemap-pos" />
      <ModeSwitch class="mode-switch-pos" :mode="mode" @change="onModeChange" />
    </div>
  </ScreenFit>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import BasemapSwitch from './components/BasemapSwitch.vue'
import MapControls from './components/MapControls.vue'
import ModeSwitch from './components/ModeSwitch.vue'
import ScreenFit from './components/ScreenFit.vue'
import TitleBar from './components/TitleBar.vue'
import FlowStatPanel from './panels/FlowStatPanel.vue'
import TopCityPanel from './panels/TopCityPanel.vue'
import { BASEMAP_OPTIONS, DEFAULT_BASEMAP_ID } from './config/basemap'
import { useDeckOverlay } from './composables/useDeckOverlay'
import { useMapLibre, type ScreenMode } from './composables/useMapLibre'
import { MOCK_CITIES, type CityMetric } from './mock/cities'
import { MOCK_FLOWS, type FlowOD } from './mock/flows'

/** 大屏全局状态（不引入 pinia，经 props/emits 下发） */
const mode = ref<ScreenMode>('3d')
const showHeatmap = ref(false)
/** 当前底图 id（BasemapSwitch 双向绑定） */
const basemapId = ref(DEFAULT_BASEMAP_ID)

/** mock 数据以响应式状态管理，数据变化驱动 deck.gl 图层自动更新 */
const cities = ref<CityMetric[]>(MOCK_CITIES)
const flows = ref<FlowOD[]>(MOCK_FLOWS)

const mapContainer = ref<HTMLElement | null>(null)
const { mapReady, setMode, setBasemap, zoomIn, zoomOut, resetNorth, resetView } =
  useMapLibre(mapContainer)
useDeckOverlay(mapReady, { cities, flows, showHeatmap })

/** 2D/3D 切换：同一地图实例上切换投影，保持相机中心不变 */
function onModeChange(next: ScreenMode) {
  mode.value = next
  setMode(next)
}

/** 底图切换：id 变化后按配置应用新样式（样式重载后投影由 useMapLibre 自动恢复） */
watch(basemapId, (id) => {
  const option = BASEMAP_OPTIONS.find((b) => b.id === id)
  if (option) setBasemap(option)
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

.panel-left {
  left: 28px;
}

.panel-right {
  right: 28px;
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
