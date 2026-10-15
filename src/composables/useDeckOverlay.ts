import type { Layer, PickingInfo } from '@deck.gl/core'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { computed, markRaw, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import {
  buildCometPoints,
  buildFlowPaths,
  createFlowArcLayer,
  createFlowCometLayer,
  type FlowPath,
} from '../map/layers/flightArcs'
import { createHeatmapLayer } from '../map/layers/heatmap'
import { createRegionLayer, type ProvinceFeature } from '../map/layers/regionGeoJson'
import { createCityCoreLayer, createCityPointLayer } from '../map/layers/scatterPoints'
import type { CityMetric } from '../mock/cities'
import type { FlowOD } from '../mock/flows'

export interface DeckDataSources {
  /** 城市指标数据（响应式） */
  cities: Ref<CityMetric[]>
  /** 飞线 OD 数据（响应式） */
  flows: Ref<FlowOD[]>
  /** 热力图显隐开关 */
  showHeatmap: Ref<boolean>
}

/** 彗星飞行一圈的周期（秒） */
const LOOP_SECONDS = 16

/**
 * deck.gl 图层 composable：所有数据图层通过 MapboxOverlay 叠加在同一张
 * MapLibre 地图上，2D/3D 投影切换时无需重建图层。
 */
export function useDeckOverlay(mapReady: Ref<MapLibreMap | null>, sources: DeckDataSources) {
  const { cities, flows, showHeatmap } = sources

  /** deck overlay 实例：同样 shallowRef + markRaw，避免 Proxy 破坏 WebGL 状态 */
  const overlay = shallowRef<MapboxOverlay | null>(null)
  /** 省界 hover 状态：驱动 GeoJsonLayer 高亮 */
  const hoveredProvince = ref<string | null>(null)
  /** 全局飞行进度（0→1 循环），驱动飞线彗星动画 */
  const progress = ref(0)
  let rafId = 0
  let lastTs = 0

  const cityMap = computed(() => new Map(cities.value.map((c) => [c.name, c])))
  const flowPaths = computed<FlowPath[]>(() => buildFlowPaths(flows.value, cityMap.value))
  const volumeRange = computed<[number, number]>(() => {
    const vs = flows.value.map((f) => f.volume)
    return vs.length ? [Math.min(...vs), Math.max(...vs)] : [0, 1]
  })

  /** 聚合全部图层（纯函数生成，数据/hover/开关变化时自动重算） */
  const layers = computed<Layer[]>(() => {
    const list: Layer[] = [
      createRegionLayer({
        hoveredName: hoveredProvince.value,
        onHover: (name) => (hoveredProvince.value = name),
      }),
    ]
    if (showHeatmap.value) {
      list.push(createHeatmapLayer(cities.value))
    }
    list.push(createCityPointLayer(cities.value), createCityCoreLayer(cities.value))
    const paths = flowPaths.value
    if (paths.length > 0) {
      list.push(createFlowArcLayer(paths, volumeRange.value))
      list.push(createFlowCometLayer(buildCometPoints(paths, progress.value)))
    }
    return list
  })

  /** 数据图层统一出口：setProps 增量更新，无需重建 overlay */
  function syncLayers() {
    overlay.value?.setProps({ layers: layers.value })
  }

  watch(layers, syncLayers)

  // 等待地图样式完全就绪（'load' 事件）后才挂载 overlay：
  // MapboxOverlay 初始化会读取 map.getProjection()，而 maplibre v5 在样式
  // 未初始化（内部 style 为 null）时调用它会抛 TypeError。
  watch(mapReady, (map) => {
    if (!map || overlay.value) return
    const instance = markRaw(
      new MapboxOverlay({ interleaved: false, layers: layers.value, getTooltip }),
    )
    map.addControl(instance)
    overlay.value = instance
  })

  // 飞线动画：requestAnimationFrame 驱动全局进度，经响应式管线刷新图层
  function tick(ts: number) {
    if (lastTs !== 0) {
      progress.value = (progress.value + (ts - lastTs) / 1000 / LOOP_SECONDS) % 1
    }
    lastTs = ts
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  /** 悬浮提示：省份名 / 城市热度 */
  function getTooltip(info: PickingInfo): string | null {
    if (info.layer?.id === 'city-points') {
      const city = info.object as CityMetric
      return `<b>${city.name}</b><br/>热度指数 ${city.value}`
    }
    if (info.layer?.id === 'china-provinces') {
      const province = info.object as ProvinceFeature
      return `<b>${province.properties.name}</b>`
    }
    return null
  }

  onUnmounted(() => {
    cancelAnimationFrame(rafId)
    // finalize 内部调用 map.removeControl 并触发 deck 清理，且重复调用安全
    //（map.remove() 时 maplibre 也会遍历触发 control.onRemove）
    overlay.value?.finalize()
    overlay.value = null
  })
}
