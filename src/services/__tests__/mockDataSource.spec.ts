import { afterEach, describe, expect, it, vi } from 'vitest'
import { MockDataSource, buildMockPeriods } from '../mockDataSource'
import { MOCK_CITIES } from '../../mock/cities'
import { MOCK_FLOWS } from '../../mock/flows'

describe('buildMockPeriods 周期列表', () => {
  it('12 期连续升序（2025-01 ~ 2025-12）', () => {
    const periods = buildMockPeriods()
    expect(periods).toHaveLength(12)
    expect(periods[0]).toBe('2025-01')
    expect(periods[11]).toBe('2025-12')
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i] > periods[i - 1]).toBe(true)
    }
  })
})

describe('MockDataSource 城市数据（M5）', () => {
  const ds = new MockDataSource()

  it('城市样本扩容：75 座且含全部三指标', async () => {
    const cities = await ds.getCities('2025-06')
    expect(cities).toHaveLength(MOCK_CITIES.length)
    expect(cities.length).toBeGreaterThanOrEqual(60)
    for (const c of cities) {
      expect(c.indicators.heat).toBeGreaterThan(0)
      expect(c.indicators.passenger).toBeGreaterThan(0)
      expect(c.indicators.economy).toBeGreaterThan(0)
      expect(c.value).toBe(c.indicators.heat)
    }
  })

  it('OD 网络：多枢纽 + 客货两类齐备', async () => {
    const flows = await ds.getFlows('2025-06')
    expect(flows).toHaveLength(MOCK_FLOWS.length)
    expect(flows.length).toBeGreaterThanOrEqual(40)
    expect(new Set(flows.map((f) => f.from)).size).toBeGreaterThanOrEqual(5)
    expect(new Set(flows.map((f) => f.category))).toEqual(new Set(['passenger', 'cargo']))
    for (const f of flows) expect(f.volume).toBeGreaterThan(0)
  })

  it('历史与当期同口径：末期值与 getCities 完全一致', async () => {
    const period = '2025-06'
    const cities = await ds.getCities(period)
    for (const metric of ['heat', 'passenger', 'economy'] as const) {
      const history = await ds.getCityHistory(period, cities[0].name, 12, metric)
      expect(history).toHaveLength(12)
      expect(history[history.length - 1]).toBe(cities[0].indicators[metric])
    }
  })

  it('未知城市历史返回空数组', async () => {
    expect(await ds.getCityHistory('2025-06', '不存在')).toEqual([])
  })
})

describe('MockDataSource 实时推送（M7.4）', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('订阅后立即推快照，每 5s 微扰推送（±1% 内）', async () => {
    vi.useFakeTimers()
    const src = new MockDataSource()
    const received: Awaited<ReturnType<MockDataSource['getCities']>>[] = []
    src.subscribeCities('2025-06', (c) => received.push(c))
    await vi.advanceTimersByTimeAsync(0) // 冲刷快照加载微任务
    expect(received).toHaveLength(1)
    const base = received[0][0]
    await vi.advanceTimersByTimeAsync(5000)
    expect(received).toHaveLength(2)
    const pushed = received[1][0]
    expect(pushed.name).toBe(base.name)
    // 乘性微扰幅度 ±1%，且保持非负
    expect(pushed.indicators.heat).toBeGreaterThanOrEqual(base.indicators.heat * 0.99)
    expect(pushed.indicators.heat).toBeLessThanOrEqual(base.indicators.heat * 1.01)
  })

  it('全部退订后停表：不再推送', async () => {
    vi.useFakeTimers()
    const src = new MockDataSource()
    const received: unknown[] = []
    const unsub = src.subscribeCities('2025-06', (c) => received.push(c))
    await vi.advanceTimersByTimeAsync(0)
    expect(received).toHaveLength(1)
    unsub()
    await vi.advanceTimersByTimeAsync(20000)
    expect(received).toHaveLength(1)
  })

  it('多周期订阅互不串扰，单期退订不影响其他期', async () => {
    vi.useFakeTimers()
    const src = new MockDataSource()
    const june: unknown[] = []
    const july: unknown[] = []
    const unsubJune = src.subscribeCities('2025-06', (c) => june.push(c))
    src.subscribeCities('2025-07', (c) => july.push(c))
    await vi.advanceTimersByTimeAsync(0)
    expect(june).toHaveLength(1)
    expect(july).toHaveLength(1)
    unsubJune()
    await vi.advanceTimersByTimeAsync(5000)
    expect(june).toHaveLength(1) // 6 月已退订不再推送
    expect(july).toHaveLength(2) // 7 月仍按表推送
  })
})
