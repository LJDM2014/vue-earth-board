import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLoopProgress } from '../useLoopProgress'

/**
 * rAF 桩：手动 stepping 驱动回调，避免依赖 jsdom 的事件循环时序，
 * 同时可断言 unmount 后 cancelAnimationFrame 被正确调用。
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

/** 推进一帧：触发最早注册的回调 */
function stepFrame(timestamp: number) {
  const [id, cb] = [...rafCbs.entries()][0]
  if (id === undefined) return
  rafCbs.delete(id)
  cb(timestamp)
  // useLoopProgress 在回调内部立即续订下一帧
}

function mountWithProgress(loopSeconds: number) {
  let progressRef: { value: number } | null = null
  const Comp = defineComponent({
    setup() {
      const progress = useLoopProgress(loopSeconds)
      progressRef = progress as unknown as { value: number }
      return () => h('div')
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, progress: progressRef! }
}

describe('useLoopProgress 全局循环进度', () => {
  it('首帧仅记录时间基准，进度保持 0', () => {
    const { progress, wrapper } = mountWithProgress(10)
    stepFrame(1000)
    expect(progress.value).toBe(0)
    wrapper.unmount()
  })

  it('按流逝时间线性推进', () => {
    const { progress, wrapper } = mountWithProgress(10)
    stepFrame(1000)
    stepFrame(3500)
    expect(progress.value).toBeCloseTo(0.25, 10)
    stepFrame(8500)
    expect(progress.value).toBeCloseTo(0.75, 10)
    wrapper.unmount()
  })

  it('跨周期回卷到 [0,1)', () => {
    const { progress, wrapper } = mountWithProgress(10)
    stepFrame(1000)
    stepFrame(13_500)
    expect(progress.value).toBeCloseTo(0.25, 10)
    wrapper.unmount()
  })

  it('unmount 后取消动画帧订阅', () => {
    const { wrapper } = mountWithProgress(10)
    stepFrame(0)
    expect(rafCbs.size).toBe(1)
    wrapper.unmount()
    expect(rafCbs.size).toBe(0)
  })
})
