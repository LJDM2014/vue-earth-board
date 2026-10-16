import type { Layer } from '@deck.gl/core'
import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { aggregateLayers, memoizeGroups, type LayerDescriptor } from '../registry'

/** 测试用伪图层（仅验证实例引用与 id，避免在 node 环境构造 deck 图层） */
function fakeLayer(id: string): Layer {
  return { id } as unknown as Layer
}

/** 组装一组描述符：两组可见（带 tooltip）、一组不可见 */
function makeDescriptors(state: { showA: boolean; showB: boolean; showC: boolean }): LayerDescriptor[] {
  return [
    {
      id: 'b',
      order: 20,
      visible: () => state.showB,
      build: () => [fakeLayer('b-1')],
      tooltip: () => 'b-tip',
    },
    {
      id: 'a',
      order: 10,
      visible: () => state.showA,
      build: () => [fakeLayer('a-1'), fakeLayer('a-2')],
    },
    {
      id: 'c',
      order: 30,
      visible: () => state.showC,
      build: () => [fakeLayer('c-1')],
    },
  ]
}

describe('aggregateLayers 注册表聚合', () => {
  it('按 order 排序并过滤不可见组', () => {
    const state = { showA: true, showB: true, showC: false }
    const { layers } = aggregateLayers(makeDescriptors(state))
    expect(layers.map((l) => l.id)).toEqual(['a-1', 'a-2', 'b-1'])
  })

  it('tooltip 按图层 id 映射（无 tooltip 的组不写入）', () => {
    const state = { showA: true, showB: true, showC: true }
    const { tooltips } = aggregateLayers(makeDescriptors(state))
    expect(tooltips.has('a-1')).toBe(false)
    expect(tooltips.get('b-1')).toBeTruthy()
    expect(tooltips.size).toBe(1)
  })
})

describe('memoizeGroups 组级 memo（M4.1 契约）', () => {
  it('静态组实例跨动画帧复用，仅自身依赖变化时重建', () => {
    const data = ref(1)
    const progress = ref(0)
    let staticBuilds = 0
    let animatedBuilds = 0
    const descriptors: LayerDescriptor[] = [
      {
        id: 'static',
        order: 10,
        visible: () => true,
        build: () => {
          staticBuilds += 1
          void data.value
          return [fakeLayer(`static-${data.value}`)]
        },
      },
      {
        id: 'animated',
        order: 20,
        visible: () => true,
        build: () => {
          animatedBuilds += 1
          void progress.value
          return [fakeLayer(`animated-${progress.value}`)]
        },
      },
    ]
    const [staticGroup, animatedGroup] = memoizeGroups(descriptors)

    const firstStatic = staticGroup.layers.value
    const firstAnimated = animatedGroup.layers.value
    expect(staticBuilds).toBe(1)
    expect(animatedBuilds).toBe(1)

    // 动画帧推进：静态组实例保持同一引用，动画组重建
    progress.value = 0.5
    expect(staticGroup.layers.value).toBe(firstStatic)
    expect(animatedGroup.layers.value).not.toBe(firstAnimated)
    expect(staticBuilds).toBe(1)
    expect(animatedBuilds).toBe(2)

    // 静态组自身数据变化：仅静态组重建
    data.value = 2
    expect(staticGroup.layers.value).not.toBe(firstStatic)
    expect(staticGroup.layers.value.map((l) => l.id)).toEqual(['static-2'])
    expect(animatedBuilds).toBe(2)
  })

  it('visible 与 layers 各自独立缓存，隐藏时不执行 build', () => {
    const show = ref(false)
    let builds = 0
    const descriptors: LayerDescriptor[] = [
      {
        id: 'g',
        order: 10,
        visible: () => show.value,
        build: () => {
          builds += 1
          return [fakeLayer('g-1')]
        },
      },
    ]
    const [group] = memoizeGroups(descriptors)

    expect(group.visible.value).toBe(false)
    expect(group.layers.value).toEqual([])
    expect(builds).toBe(0)

    show.value = true
    expect(group.visible.value).toBe(true)
    expect(group.layers.value.map((l) => l.id)).toEqual(['g-1'])
    expect(builds).toBe(1)

    // 再次读取（依赖未变）命中缓存
    expect(group.layers.value).toBe(group.layers.value)
    expect(builds).toBe(1)
  })

  it('按 order 排序输出', () => {
    const groups = memoizeGroups(makeDescriptors({ showA: true, showB: true, showC: true }))
    expect(groups.map((g) => g.desc.id)).toEqual(['a', 'b', 'c'])
  })

  it('与 computed 响应式链集成：聚合出口随组依赖更新', () => {
    const show = ref(true)
    const descriptors: LayerDescriptor[] = [
      { id: 'g', order: 10, visible: () => show.value, build: () => [fakeLayer('g-1')] },
    ]
    const [group] = memoizeGroups(descriptors)
    const total = computed(() => (group.visible.value ? group.layers.value.length : 0))
    expect(total.value).toBe(1)
    show.value = false
    expect(total.value).toBe(0)
  })
})
