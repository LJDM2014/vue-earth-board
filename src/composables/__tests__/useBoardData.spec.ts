import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { CityMetric } from '../../mock/cities'
import type { FlowOD } from '../../mock/flows'
import { HISTORY_COUNT } from '../../map/layers/boardLayers'
import type { BoardDataSource, Period } from '../../services/dataSource'
import { onMonitorEvent, type MonitorEvent } from '../../services/monitor'
import { useBoardData } from '../useBoardData'

/** 在真实组件 setup 作用域内执行 composable（watch/onUnmounted 生命周期生效） */
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T
  const wrapper = mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
  )
  return { result, unmount: () => wrapper.unmount() }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeCity(p: string): CityMetric {
  return {
    name: `城-${p}`,
    province: '测试省',
    lnglat: [100, 30],
    value: 1,
    indicators: { heat: 1, passenger: 2, economy: 3 },
  }
}

interface FakeCalls {
  cities: Map<string, number>
  flows: Map<string, number>
  history: number
}

/** 计数型假数据源：failPeriods 中的周期抛错（且不计数） */
function createFakeSource(periods: string[], failPeriods: Set<string> = new Set()) {
  const calls: FakeCalls = { cities: new Map(), flows: new Map(), history: 0 }
  /** 记录每次 getCityHistory 收到的 count 实参 */
  const historyCounts: number[] = []
  const source: BoardDataSource = {
    kind: 'mock',
    listPeriods: async () => [...periods],
    getCities: async (p: Period) => {
      if (failPeriods.has(p)) throw new Error(`boom-${p}`)
      calls.cities.set(p, (calls.cities.get(p) ?? 0) + 1)
      return [makeCity(p)]
    },
    getFlows: async (p: Period) => {
      calls.flows.set(p, (calls.flows.get(p) ?? 0) + 1)
      return [] as FlowOD[]
    },
    getCityHistory: async (_p: Period, _name: string, count?: number) => {
      calls.history += 1
      historyCounts.push(count ?? -1)
      return [1, 2, 3]
    },
  }
  return { source, calls, historyCounts }
}

/** 带推送能力的假数据源：记录订阅/退订序列 */
function createRealtimeSource(periods: string[]) {
  const { source, calls } = createFakeSource(periods)
  const subscribed: string[] = []
  const unsubscribed: string[] = []
  let pushCb: ((c: CityMetric[]) => void) | null = null
  const realtime = source as BoardDataSource & {
    subscribeCities: (p: Period, cb: (c: CityMetric[]) => void) => () => void
  }
  realtime.subscribeCities = vi.fn((p: Period, cb: (c: CityMetric[]) => void) => {
    subscribed.push(p)
    pushCb = cb
    return () => {
      unsubscribed.push(p)
    }
  })
  return { source, calls, subscribed, unsubscribed, getPushCb: () => pushCb }
}

describe('useBoardData 数据域（M7.5）', () => {
  it('初始化：周期列表加载并默认定位中期，快照+历史自动拉取', async () => {
    const { source, calls } = createFakeSource(['A', 'B', 'C'])
    const sourceRef = ref<BoardDataSource | null>(source)
    const { result, unmount } = withSetup(() => useBoardData(sourceRef))
    await flushPromises()
    expect(result.periods.value).toEqual(['A', 'B', 'C'])
    expect(result.period.value).toBe('B') // 中期
    expect(calls.cities.get('B')).toBe(1)
    expect(calls.flows.get('A')).toBe(1) // prevFlows 环比口径
    expect(result.cities.value[0].name).toBe('城-B')
    expect(result.cityHistory.value.get('城-B')).toEqual([1, 2, 3])
    unmount()
  })

  it('周期回切 A→B→A：二次进入命中 LRU 缓存零请求', async () => {
    const { source, calls } = createFakeSource(['A', 'B', 'C'])
    const sourceRef = ref<BoardDataSource | null>(source)
    const { result, unmount } = withSetup(() => useBoardData(sourceRef))
    await flushPromises()
    result.period.value = 'A'
    await flushPromises()
    expect(calls.cities.get('A')).toBe(1)
    result.period.value = 'B'
    await flushPromises()
    result.period.value = 'A'
    await flushPromises()
    // A/B 均命中缓存：A 仅初次拉取 1 次，B 仅 init 定位拉取 1 次
    expect(calls.cities.get('A')).toBe(1)
    expect(calls.cities.get('B')).toBe(1)
    expect(result.cities.value[0].name).toBe('城-A')
    unmount()
  })

  it('LRU 容量 12 期：超出后淘汰最旧周期，回访重新拉取', async () => {
    const periods = Array.from({ length: 13 }, (_, i) => `p${i}`)
    const { source, calls } = createFakeSource(periods)
    const sourceRef = ref<BoardDataSource | null>(source)
    const { result, unmount } = withSetup(() => useBoardData(sourceRef))
    await flushPromises()
    expect(result.period.value).toBe('p6') // 13 期取中期
    for (const p of [...periods.slice(0, 6), ...periods.slice(7)]) {
      result.period.value = p
      await flushPromises()
    }
    // 13 期全部写入后 p6（最早插入）被淘汰
    expect(calls.cities.get('p6')).toBe(1)
    result.period.value = 'p6'
    await flushPromises()
    expect(calls.cities.get('p6')).toBe(2) // 缓存已淘汰，重新拉取
    expect(calls.cities.get('p5')).toBe(1) // 其余仍在缓存
    unmount()
  })

  it('指标切换：历史序列按新口径重取', async () => {
    const { source, calls } = createFakeSource(['A', 'B', 'C'])
    const sourceRef = ref<BoardDataSource | null>(source)
    const { result, unmount } = withSetup(() => useBoardData(sourceRef))
    await flushPromises()
    const before = calls.history
    result.activeMetric.value = 'passenger'
    await flushPromises()
    expect(calls.history).toBe(before + 1)
    unmount()
  })

  it('实时推送：开关开启后订阅当前期，切期先退订旧期', async () => {
    const rt = createRealtimeSource(['A', 'B', 'C'])
    const sourceRef = ref<BoardDataSource | null>(rt.source)
    const { result, unmount } = withSetup(() => useBoardData(sourceRef, { realtimePush: true }))
    await flushPromises()
    expect(rt.subscribed).toEqual(['B'])
    rt.getPushCb()?.([makeCity('推送')])
    expect(result.cities.value[0].name).toBe('城-推送') // 推送快照直写
    result.period.value = 'A'
    await flushPromises()
    expect(rt.unsubscribed).toEqual(['B'])
    expect(rt.subscribed).toEqual(['B', 'A'])
    unmount()
    expect(rt.unsubscribed).toEqual(['B', 'A']) // 卸载收口退订
  })

  it('实时推送默认关闭：具备能力也不订阅，开关打开后恢复', async () => {
    const rt = createRealtimeSource(['A', 'B', 'C'])
    const sourceRef = ref<BoardDataSource | null>(rt.source)
    const enabled = ref(false)
    const { unmount } = withSetup(() => useBoardData(sourceRef, { realtimePush: enabled }))
    await flushPromises()
    expect(rt.subscribed).toEqual([]) // 默认不订阅
    enabled.value = true
    await flushPromises()
    expect(rt.subscribed).toEqual(['B']) // 开关打开后恢复订阅
    enabled.value = false
    await flushPromises()
    expect(rt.unsubscribed).toEqual(['B']) // 关闭即退订
    unmount()
  })

  it('无推送能力的数据源不触发订阅', async () => {
    const { source } = createFakeSource(['A', 'B', 'C'])
    const sourceRef = ref<BoardDataSource | null>(source)
    const { unmount } = withSetup(() => useBoardData(sourceRef))
    await flushPromises()
    unmount() // 全程不调用 subscribeCities、不抛错即通过
  })

  it('拉取失败：上报监控且不清空既有画面', async () => {
    const events: MonitorEvent[] = []
    const off = onMonitorEvent((e) => events.push(e))
    try {
      const { source, calls } = createFakeSource(['A', 'X', 'C'], new Set(['X']))
      const sourceRef = ref<BoardDataSource | null>(source)
      const { result, unmount } = withSetup(() => useBoardData(sourceRef))
      await flushPromises()
      // init 定位到 X（失败）：cities 保持为空但不抛断
      expect(result.period.value).toBe('X')
      expect(result.cities.value).toEqual([])
      expect(result.loading.value).toBe(false)
      expect(events.some((e) => e.type === 'data-source-error' && e.source === 'period-fetch')).toBe(true)
      // 失败后切换到可用期正常恢复
      result.period.value = 'A'
      await flushPromises()
      expect(result.cities.value[0].name).toBe('城-A')
      expect(calls.cities.get('A')).toBe(1)
      unmount()
    } finally {
      off()
    }
  })

  it('轮询刷新：refreshIntervalMs 开启后周期性强拉绕过缓存', async () => {
    const { source, calls } = createFakeSource(['A', 'B', 'C'])
    const sourceRef = ref<BoardDataSource | null>(source)
    const { result, unmount } = withSetup(() => useBoardData(sourceRef, { refreshIntervalMs: 30 }))
    await flushPromises()
    expect(calls.cities.get('B')).toBe(1)
    await sleep(100)
    expect(calls.cities.get('B')).toBeGreaterThanOrEqual(2) // 轮询强拉
    expect(result.loading.value).toBe(false)
    unmount()
  })

  it('历史序列按 HISTORY_COUNT 期数请求', async () => {
    const { source, historyCounts } = createFakeSource(['A', 'B', 'C'])
    const sourceRef = ref<BoardDataSource | null>(source)
    const { result, unmount } = withSetup(() => useBoardData(sourceRef))
    await flushPromises()
    expect(result.cityHistory.value.get('城-B')).toEqual([1, 2, 3])
    expect(historyCounts.length).toBeGreaterThan(0)
    expect(historyCounts.every((c) => c === HISTORY_COUNT)).toBe(true)
    unmount()
  })
})
