import type { Layer, PickingInfo } from '@deck.gl/core'
import { computed, type ComputedRef } from 'vue'

/**
 * 图层组悬浮提示：按命中的 deck 图层 id 解析文案。
 * 返回 string 时 deck 以纯文本渲染；返回 { html } 时按 HTML 渲染（富化卡片用）。
 */
export type LayerTooltip = (info: PickingInfo) => string | { html: string } | null

/**
 * 图层描述符：以声明式方式描述一个"图层组"（可包含多个 deck 图层实例），
 * useDeckOverlay 仅依赖本接口聚合渲染——新增图层无需改动 overlay 主流程。
 */
export interface LayerDescriptor {
  /** 组唯一 id（如 'region' / 'trips'） */
  id: string
  /** z 序：数值小的先渲染（位于底部） */
  order: number
  /** 可见性（闭包内读取响应式开关，变化后自动重算） */
  visible: () => boolean
  /** 构建该组的 deck 图层实例（纯函数，随数据/状态重算） */
  build: () => Layer[]
  /** 该组各图层的悬浮提示（可选，按图层 id 匹配） */
  tooltip?: LayerTooltip
}

export interface AggregateResult {
  /** 渲染用图层列表（已按 order 排序、过滤不可见组） */
  layers: Layer[]
  /** deck 图层 id → tooltip 函数映射 */
  tooltips: Map<string, LayerTooltip>
}

/** 按注册表聚合全部图层：单次遍历同时产出图层列表与 tooltip 映射 */
export function aggregateLayers(descriptors: LayerDescriptor[]): AggregateResult {
  const ordered = [...descriptors].sort((a, b) => a.order - b.order)
  const layers: Layer[] = []
  const tooltips = new Map<string, LayerTooltip>()
  for (const desc of ordered) {
    if (!desc.visible()) continue
    for (const layer of desc.build()) {
      layers.push(layer)
      if (desc.tooltip) tooltips.set(layer.id, desc.tooltip)
    }
  }
  return { layers, tooltips }
}

/** 单个图层组的 memo 化状态（M4.1）：visible / layers 各自独立缓存 */
export interface MemoizedGroup {
  desc: LayerDescriptor
  visible: ComputedRef<boolean>
  layers: ComputedRef<Layer[]>
}

/**
 * 按组拆分响应式依赖（M4.1）：每组 visible/build 以独立 computed 缓存，
 * 组内闭包读取的响应式 deps 只触发本组重建——静态层实例跨帧复用，
 * 仅 progress 驱动的动画组（trips / 彗星）保持每帧更新，降低 deck diff 压力。
 */
export function memoizeGroups(descriptors: LayerDescriptor[]): MemoizedGroup[] {
  return descriptors
    .map((desc) => {
      const visible = computed(() => desc.visible())
      return { desc, visible, layers: computed(() => (visible.value ? desc.build() : [])) }
    })
    .sort((a, b) => a.desc.order - b.desc.order)
}
