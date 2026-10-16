import type { CityMetric } from '../mock/cities'
import { MOCK_CITIES } from '../mock/cities'
import type { FlowOD } from '../mock/flows'
import { MOCK_FLOWS } from '../mock/flows'
import type { BoardDataSource, Period } from './dataSource'

/** 时间轴覆盖的月份数（2025-01 起连续 12 期） */
const PERIOD_COUNT = 12

/** mulberry32 伪随机数生成器：同一 seed 稳定复现，保证数据可回放 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 字符串散列（确定性 seed 来源） */
function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * 生成 12 期连续月份周期，格式 'YYYY-MM'（升序）。
 * 导出供 MockDataSource 与测试/演示复用。
 */
export function buildMockPeriods(): Period[] {
  return Array.from({ length: PERIOD_COUNT }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`)
}

/**
 * Mock 数据源：以 M1 内置数据为基准，按周期用确定性伪随机扰动指标值，
 * 模拟「同一城市集、逐期变化」的时间轴数据切片。
 */
export class MockDataSource implements BoardDataSource {
  readonly kind = 'mock' as const

  private readonly periods: Period[] = buildMockPeriods()

  async listPeriods(): Promise<Period[]> {
    return [...this.periods]
  }

  async getCities(period: Period): Promise<CityMetric[]> {
    // 城市坐标/名单固定，仅热度指标随周期波动（0.5~1.25 倍基准）
    return MOCK_CITIES.map((city) => ({
      ...city,
      value: Math.round(city.value * this.factor(period, city.name, 0.5, 1.25)),
    }))
  }

  async getFlows(period: Period): Promise<FlowOD[]> {
    // OD 拓扑固定，运量随周期波动（0.45~1.35 倍基准）
    return MOCK_FLOWS.map((flow) => ({
      ...flow,
      volume: Math.round(flow.volume * this.factor(period, `${flow.from}-${flow.to}`, 0.45, 1.35)),
    }))
  }

  async getCityHistory(period: Period, name: string, count = 12): Promise<number[]> {
    const idx = this.periods.indexOf(period)
    const base = MOCK_CITIES.find((c) => c.name === name)?.value
    if (idx < 0 || base === undefined) return []
    // 以 period 为末期向回取 count 期（不足时环形回卷），计算口径与 getCities 一致
    const out: number[] = []
    for (let i = count - 1; i >= 0; i--) {
      const p = this.periods[(idx - i + this.periods.length * 2) % this.periods.length]
      out.push(Math.round(base * this.factor(p, name, 0.5, 1.25)))
    }
    return out
  }

  /** 确定性波动系数：seed = hash(周期+主体名)，区间 [min, max] */
  private factor(period: Period, subject: string, min: number, max: number): number {
    const rand = mulberry32(hashSeed(`${period}#${subject}`))
    return min + rand() * (max - min)
  }
}
