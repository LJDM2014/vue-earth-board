import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref, shallowRef } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { BoardDataSource } from '../../services/dataSource'
import { onMonitorEvent, reportMonitorEvent, type MonitorEvent } from '../../services/monitor'
import {
  createHttpErrorCounter,
  REFRESH_AWAY_MS,
  TOUR_IDLE_RECOVER_MS,
  useWatchdog,
  type WatchdogDeps,
} from '../useWatchdog'

/** 构造仅含 kind 的数据源替身（watchdog 只消费 kind 字段） */
function fakeSource(kind: 'mock' | 'http'): BoardDataSource {
  return { kind } as unknown as BoardDataSource
}

describe('createHttpErrorCounter 连续错误计数（M9.3）', () => {
  it('连续 3 次触发一次并自动复位', () => {
    const counter = createHttpErrorCounter()
    expect(counter.record(true)).toBe(false)
    expect(counter.record(true)).toBe(false)
    expect(counter.record(true)).toBe(true)
    // 复位后需要重新累计 3 次
    expect(counter.record(true)).toBe(false)
    expect(counter.record(true)).toBe(false)
    expect(counter.record(true)).toBe(true)
  })

  it('非 http（mock/降级后）视为中断清零', () => {
    const counter = createHttpErrorCounter()
    expect(counter.record(true)).toBe(false)
    expect(counter.record(true)).toBe(false)
    expect(counter.record(false)).toBe(false)
    expect(counter.record(true)).toBe(false)
    expect(counter.record(true)).toBe(false)
    expect(counter.record(true)).toBe(true)
  })
})

describe('useWatchdog 无人值守看门狗（M9.3）', () => {
  let events: MonitorEvent[]
  let offEvents: () => void
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    events = []
    offEvents = onMonitorEvent((e) => events.push(e))
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    offEvents()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** 挂载看门狗宿主组件（deps 允许逐项覆盖） */
  function mountWatchdog(overrides: Partial<WatchdogDeps> = {}) {
    const deps: WatchdogDeps = {
      sourceRef: shallowRef(fakeSource('http')),
      isDegraded: ref(false),
      refreshCurrent: vi.fn(),
      tourActive: ref(false),
      startTour: vi.fn(),
      ...overrides,
    }
    const host = defineComponent({
      setup() {
        useWatchdog(deps)
        return () => null
      },
    })
    wrapper = mount(host)
    return deps
  }

  it('连续 3 次 data-source-error（http 在位）→ 回落 mock + 降级 + 上报 fallback', () => {
    const { sourceRef, isDegraded } = mountWatchdog()
    for (let i = 0; i < 2; i++) {
      reportMonitorEvent({ type: 'data-source-error', source: 'period-fetch', detail: 'e' })
    }
    expect(sourceRef.value?.kind).toBe('http')
    expect(isDegraded.value).toBe(false)

    reportMonitorEvent({ type: 'data-source-error', source: 'history-fetch', detail: 'e' })
    expect(sourceRef.value?.kind).toBe('mock')
    expect(isDegraded.value).toBe(true)
    expect(events.some((e) => e.type === 'data-source-error' && e.source === 'fallback')).toBe(true)
  })

  it('mock 源期间的 data-source-error 不计数、不触发降级', () => {
    const { sourceRef, isDegraded } = mountWatchdog({
      sourceRef: shallowRef(fakeSource('mock')),
    })
    for (let i = 0; i < 5; i++) {
      reportMonitorEvent({ type: 'data-source-error', source: 'period-fetch', detail: 'e' })
    }
    expect(sourceRef.value?.kind).toBe('mock')
    expect(isDegraded.value).toBe(false)
  })

  it('非数据类事件（style-load-error 等）不参与计数', () => {
    const { sourceRef, isDegraded } = mountWatchdog()
    for (let i = 0; i < 5; i++) {
      reportMonitorEvent({ type: 'style-load-error', detail: 'e' })
    }
    expect(sourceRef.value?.kind).toBe('http')
    expect(isDegraded.value).toBe(false)
  })

  it('回前台且离开超过 30min → 静默强刷当前期', () => {
    const refreshCurrent = vi.fn()
    mountWatchdog({ refreshCurrent })

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(REFRESH_AWAY_MS + 1000)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refreshCurrent).toHaveBeenCalledTimes(1)
  })

  it('回前台但离开不足 30min → 不刷新', () => {
    const refreshCurrent = vi.fn()
    mountWatchdog({ refreshCurrent })

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(60_000)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refreshCurrent).not.toHaveBeenCalled()
  })

  it('轮播启动过、退出后 60s 无交互 → 自动恢复轮播', async () => {
    const { tourActive, startTour } = mountWatchdog()
    tourActive.value = true
    await nextTick()
    tourActive.value = false
    await nextTick()

    vi.advanceTimersByTime(TOUR_IDLE_RECOVER_MS - 1)
    expect(startTour).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(startTour).toHaveBeenCalledTimes(1)
  })

  it('退出后的用户交互重置空闲计时（尊重现场操作员）', async () => {
    const { tourActive, startTour } = mountWatchdog()
    tourActive.value = true
    await nextTick()
    tourActive.value = false
    await nextTick()

    vi.advanceTimersByTime(TOUR_IDLE_RECOVER_MS - 1000) // t=59s
    window.dispatchEvent(new Event('pointerdown')) // 重置 → 新恢复点 t=59s+60s=119s
    vi.advanceTimersByTime(1000) // t=60s：原定时器时隙已作废
    expect(startTour).not.toHaveBeenCalled()
    vi.advanceTimersByTime(TOUR_IDLE_RECOVER_MS - 2000) // t=117s
    expect(startTour).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000) // t=119s：重置后的新恢复点
    expect(startTour).toHaveBeenCalledTimes(1)
  })

  it('轮播从未启动过时不误触发自恢复', () => {
    const { startTour } = mountWatchdog()
    vi.advanceTimersByTime(TOUR_IDLE_RECOVER_MS * 3)
    expect(startTour).not.toHaveBeenCalled()
  })
})
