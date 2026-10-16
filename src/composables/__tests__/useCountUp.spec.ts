import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountUp } from '../useCountUp'

/**
 * rAF 桩：手动 stepping 驱动回调（手法同 useLoopProgress.spec.ts），
 * 用 performance.now() 偏移构造帧时间，断言缓出插值。
 */
let rafCbs: Map<number, FrameRequestCallback>
let nextRafId: number

beforeEach(() => {
  rafCbs = new Map()
  nextRafId = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafCbs.set(++nextRafId, cb)
    return nextRafId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCbs.delete(id)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 触发当前所有已注册帧回调（回调内的续订保留到下一轮） */
function stepFrame(timestamp: number) {
  const cbs = [...rafCbs.values()]
  rafCbs.clear()
  for (const cb of cbs) cb(timestamp)
}

function mountWithSource(source: () => number) {
  let displayRef: { value: number } | null = null
  const Comp = defineComponent({
    setup() {
      const display = useCountUp(source)
      displayRef = display as unknown as { value: number }
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, display: displayRef! }
}

describe('useCountUp 数值滚动', () => {
  it('首渲染直接取源值，不起动画', () => {
    const source = ref(100)
    const { display, wrapper } = mountWithSource(() => source.value)
    expect(display.value).toBe(100)
    expect(rafCbs.size).toBe(0)
    wrapper.unmount()
  })

  it('源值变化后从旧值缓出推进（easeOutCubic：t=0.5 → 87.5%）', async () => {
    const source = ref(100)
    const { wrapper, display } = mountWithSource(() => source.value)
    source.value = 200
    await nextTick()

    const start = performance.now()
    stepFrame(start + 300) // t = 0.5 → ease = 0.875 → 187.5
    expect(display.value).toBeCloseTo(187.5, 1)

    stepFrame(start + 620) // t ≥ 1 → 落定 200
    expect(display.value).toBe(200)
    wrapper.unmount()
  })

  it('等值变化不调度动画帧', async () => {
    const source = ref(50)
    const { wrapper } = mountWithSource(() => source.value)
    source.value = 50
    await nextTick()
    expect(rafCbs.size).toBe(0)
    wrapper.unmount()
  })

  it('unmount 后取消动画帧订阅', async () => {
    const source = ref(0)
    const { wrapper } = mountWithSource(() => source.value)
    source.value = 100
    await nextTick()
    expect(rafCbs.size).toBe(1)
    wrapper.unmount()
    expect(rafCbs.size).toBe(0)
  })
})
