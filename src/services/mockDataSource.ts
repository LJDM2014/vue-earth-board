import { MOCK_CITIES, type CityMetric, type MetricKey } from '../mock/cities'
import type { FlowOD } from '../mock/flows'
import { MOCK_FLOWS } from '../mock/flows'
import { cityMetricValue, flowVolumeValue } from '../mock/series'
import type { BoardDataSource, Period, RealtimeCapable } from './dataSource'

/** 时间轴覆盖的月份数（2025-01 起连续 12 期） */
const PERIOD_COUNT = 12

/** 推送间隔毫秒（M7.4 本地演示链路：TOP5 数值自动微变） */
const PUSH_INTERVAL_MS = 5000

/** 微扰动幅度（±1%，推送演化不参与口径统计） */
const PUSH_JITTER = 0.01

/** 指标微扰动：乘性 ±PUSH_JITTER，保持正值；取整避免长小数泄入地图标注 */
function jitter(v: number): number {
  return Math.round(Math.max(v * (1 + (Math.random() * 2 - 1) * PUSH_JITTER), 0))
}

/**
 * 生成 12 期连续月份周期，格式 'YYYY-MM'（升序）。
 * 导出供 MockDataSource 与测试/演示复用。
 */
export function buildMockPeriods(): Period[] {
  return Array.from({ length: PERIOD_COUNT }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`)
}

/**
 * Mock 数据源（M5）：数值与拓扑全部由 `mock/series.ts` 时序生成核心产出——
 * Zipf 基数 × 年增趋势 × 春运/暑期/黄金周尖峰 ± 可复现噪声，
 * getCities / getCityHistory / getFlows 同源同口径。
 */
export class MockDataSource implements BoardDataSource, RealtimeCapable {
  readonly kind = 'mock' as const

  private readonly periods: Period[] = buildMockPeriods()

  /** 推送订阅表（M7.4）：period → 回调集合 */
  private readonly pushSubs = new Map<Period, Set<(cities: CityMetric[]) => void>>()
  /** 各周期最新快照：推送演化的基线 */
  private readonly snapshots = new Map<Period, CityMetric[]>()
  private pushTimer: number | undefined

  async listPeriods(): Promise<Period[]> {
    return [...this.periods]
  }

  async getCities(period: Period): Promise<CityMetric[]> {
    return MOCK_CITIES.map((city) => {
      // 取整：数值直接进入地图 symbol 标注 text-field，长小数会原样上屏
      const indicators = {
        heat: Math.round(cityMetricValue(period, city.name, 'heat')),
        passenger: Math.round(cityMetricValue(period, city.name, 'passenger')),
        economy: Math.round(cityMetricValue(period, city.name, 'economy')),
      }
      return {
        name: city.name,
        province: city.province,
        lnglat: city.lnglat,
        // 快照缺省为热度；App.vue 会按 activeMetric 重映射
        value: indicators.heat,
        indicators,
      }
    })
  }

  async getFlows(period: Period): Promise<FlowOD[]> {
    // OD 拓扑与类别固定，运量随周期按类别口径波动
    return MOCK_FLOWS.map((flow) => ({ ...flow, volume: flowVolumeValue(period, flow) }))
  }

  async getCityHistory(
    period: Period,
    name: string,
    count = 12,
    metric: MetricKey = 'heat',
  ): Promise<number[]> {
    const idx = this.periods.indexOf(period)
    if (idx < 0 || !MOCK_CITIES.some((c) => c.name === name)) return []
    // 以 period 为末期向回取 count 期（不足时环形回卷），口径与 getCities 完全一致
    const out: number[] = []
    for (let i = count - 1; i >= 0; i--) {
      const p = this.periods[(idx - i + this.periods.length * 2) % this.periods.length]
      out.push(cityMetricValue(p, name, metric))
    }
    return out
  }

  /**
   * 订阅城市指标推送（M7.4）：首个订阅者触发快照加载与定时器，
   * 每 5s 对快照做 ±1% 微扰后全量推送；全部退订后停表。
   */
  subscribeCities(period: Period, cb: (cities: CityMetric[]) => void): () => void {
    let subs = this.pushSubs.get(period)
    if (!subs) {
      subs = new Set()
      this.pushSubs.set(period, subs)
    }
    subs.add(cb)
    if (subs.size === 1) {
      void this.getCities(period).then((cities) => {
        // 快照返回前订阅者可能已全部退订（竞态防护）
        if (!this.pushSubs.get(period)?.size) return
        this.snapshots.set(period, cities)
        cb(cities)
        this.ensurePushTimer()
      })
    }
    return () => {
      const cur = this.pushSubs.get(period)
      if (!cur) return
      cur.delete(cb)
      if (cur.size === 0) {
        this.pushSubs.delete(period)
        this.snapshots.delete(period)
      }
      if (this.pushSubs.size === 0) this.stopPushTimer()
    }
  }

  private ensurePushTimer() {
    if (this.pushTimer !== undefined) return
    this.pushTimer = window.setInterval(() => this.tickPush(), PUSH_INTERVAL_MS)
  }

  private stopPushTimer() {
    if (this.pushTimer === undefined) return
    window.clearInterval(this.pushTimer)
    this.pushTimer = undefined
  }

  /** 推送演化：各指标乘性微扰后全量广播 */
  private tickPush() {
    for (const [period, subs] of this.pushSubs) {
      const snap = this.snapshots.get(period)
      if (!snap || subs.size === 0) continue
      const next = snap.map((c) => {
        const indicators = {
          heat: jitter(c.indicators.heat),
          passenger: jitter(c.indicators.passenger),
          economy: jitter(c.indicators.economy),
        }
        return { ...c, value: indicators.heat, indicators }
      })
      this.snapshots.set(period, next)
      for (const cb of subs) cb(next)
    }
  }
}
