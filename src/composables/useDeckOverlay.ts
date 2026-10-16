import type { Layer, PickingInfo } from '@deck.gl/core'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { computed, markRaw, onUnmounted, shallowRef, watch, type Ref } from 'vue'
import { memoizeGroups, type AggregateResult, type LayerDescriptor, type LayerTooltip } from '../map/layers/registry'

/**
 * deck.gl 图层 composable：仅依赖图层注册表（M2.1）聚合渲染。
 * 图层的增删/显隐/数据映射全部由 LayerDescriptor 声明，本主流程不再感知具体图层；
 * M4.1 起每组以独立 computed memo 化——静态层实例跨帧复用，仅动画组随帧重建，
 * 数据/开关/hover/progress 变化时经 setProps 增量更新。
 */
export function useDeckOverlay(mapReady: Ref<MapLibreMap | null>, descriptors: LayerDescriptor[]) {
  /** deck overlay 实例：shallowRef + markRaw，避免 Proxy 破坏 WebGL 状态 */
  const overlay = shallowRef<MapboxOverlay | null>(null)

  /** 每组独立 memo（M4.1）：组内 deps 变化只重建本组，progress 不再波及静态层 */
  const groups = memoizeGroups(descriptors)

  /** 聚合出口：可见组引用拼接（O(n)，组内实例已由各自 computed 缓存） */
  const aggregated = computed<AggregateResult>(() => {
    const layers: Layer[] = []
    const tooltips = new Map<string, LayerTooltip>()
    for (const g of groups) {
      if (!g.visible.value) continue
      for (const layer of g.layers.value) {
        layers.push(layer)
        if (g.desc.tooltip) tooltips.set(layer.id, g.desc.tooltip)
      }
    }
    return { layers, tooltips }
  })

  /** 数据图层统一出口：setProps 增量更新，无需重建 overlay */
  function syncLayers() {
    overlay.value?.setProps({ layers: aggregated.value.layers })
  }

  watch(aggregated, syncLayers)

  // 等待地图样式完全就绪（'load' 事件）后才挂载 overlay：
  // MapboxOverlay 初始化会读取 map.getProjection()，而 maplibre v5 在样式
  // 未初始化（内部 style 为 null）时调用它会抛 TypeError。
  watch(mapReady, (map) => {
    if (!map || overlay.value) return
    const instance = markRaw(
      new MapboxOverlay({
        interleaved: false,
        layers: aggregated.value.layers,
        getTooltip,
      }),
    )
    map.addControl(instance)
    overlay.value = instance
  })

  /** 悬浮提示：按命中图层 id 在注册表 tooltip 映射中解析（string 纯文本 / {html} 富化卡片） */
  function getTooltip(info: PickingInfo): string | { html: string } | null {
    const resolve = aggregated.value.tooltips.get(info.layer?.id ?? '')
    return resolve ? resolve(info) : null
  }

  onUnmounted(() => {
    // finalize 内部调用 map.removeControl 并触发 deck 清理，且重复调用安全
    //（map.remove() 时 maplibre 也会遍历触发 control.onRemove）
    overlay.value?.finalize()
    overlay.value = null
  })
}
