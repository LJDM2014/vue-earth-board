import { ref } from 'vue'
import { DEFAULT_BASEMAP_ID } from '../config/basemap'
import type { LayerOpacityKey, PointStyle } from '../map/layers/boardLayers'
import type { ScreenMode } from './useMapLibre'

/**
 * 图层开关域（M7.6 自 App.vue 抽离）：大屏全部面板联动的开关与透明度状态。
 * 纯 UI 状态无副作用，图层/标注/底图消费方为面板与图层注册表。
 */
export function useLayerToggles() {
  const mode = ref<ScreenMode>('3d')
  const showHeatmap = ref(false)
  /** 当前底图 id（BasemapSwitch 双向绑定） */
  const basemapId = ref(DEFAULT_BASEMAP_ID)
  const pointStyle = ref<PointStyle>('scatter')
  const showPoints = ref(true)
  const showLabels = ref(true)
  /** 地图注记（M5）：在卫星/地形等无注记瓦片上叠加中文地名 */
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

  function setOpacity(key: LayerOpacityKey, value: number) {
    layerOpacity.value = { ...layerOpacity.value, [key]: value }
  }

  return {
    mode,
    showHeatmap,
    basemapId,
    pointStyle,
    showPoints,
    showLabels,
    showAnnotations,
    showTrips,
    showArcs,
    showRegion,
    layerOpacity,
    setOpacity,
  }
}
