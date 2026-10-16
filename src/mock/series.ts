/**
 * Mock 时序生成核心（M5.4）：
 *   value(period, subject) = base × trend × season × (1 + noise)
 * - base：Zipf 权重（GDP rank 衰减）+ 城市固定 seed 抖动，非整齐数
 * - trend：月度线性增长（城市差异化年增 6%~16%）
 * - season：春运（1–2 月）/ 暑期（7–8 月）/ 黄金周（10 月）尖峰，客货不同幅度
 * - noise：mulberry32（seed = period+subject）±幅度平滑噪声，同 seed 可复现
 * getCities 与 getCityHistory 共用同一函数，sparkline 与当期数值连续（延续 M3 口径）。
 */
import { MOCK_CITIES, type CityBase, type MetricKey } from './cities'
import type { FlowOD } from './flows'

/** mulberry32 伪随机数生成器：同一 seed 稳定复现，保证数据可回放 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 字符串散列（确定性 seed 来源） */
export function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 城市档案索引（名称 → 档案） */
const CITY_INDEX = new Map<string, CityBase>(MOCK_CITIES.map((c) => [c.name, c]))

/** Zipf 基数：scale × rank^-α × (1 ± jitter)，rank 衰减 + 固定 seed 抖动避免完全单调 */
function zipfBase(city: CityBase, scale: number, alpha: number, jitter = 0.08): number {
  const rand = mulberry32(hashSeed(`base#${city.name}`))
  const decay = Math.pow(city.rank, -alpha)
  return scale * decay * (1 - jitter + rand() * 2 * jitter)
}

/** 指标基数标定：热度（指数）/ 客流（万人次）/ 经济（亿元） */
const CITY_BASE_PARAMS: Record<MetricKey, { scale: number; alpha: number }> = {
  heat: { scale: 980, alpha: 0.82 },
  passenger: { scale: 5200, alpha: 0.88 },
  economy: { scale: 3200, alpha: 0.85 },
}

/** 城市指标基数（同期内不变，模块级缓存） */
const cityBaseCache = new Map<string, number>()
function cityBase(name: string, metric: MetricKey): number {
  const key = `${metric}#${name}`
  let base = cityBaseCache.get(key)
  if (base === undefined) {
    const city = CITY_INDEX.get(name)
    if (!city) return 0
    const { scale, alpha } = CITY_BASE_PARAMS[metric]
    base = zipfBase(city, scale, alpha)
    cityBaseCache.set(key, base)
  }
  return base
}

/** 解析 'YYYY-MM' → 月序（1–12，非法时回 1） */
function monthOf(period: string): number {
  const m = Number.parseInt(period.slice(5, 7), 10)
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1
}

/** 周期在 2025 年内的月下标（0 起），供趋势线性插值 */
function monthIndexOf(period: string): number {
  return monthOf(period) - 1
}

/** 城市差异化年增速（6%~16%，seed 固定） */
function cityGrowth(name: string): number {
  const rand = mulberry32(hashSeed(`growth#${name}`))
  return 0.06 + rand() * 0.1
}

/** 趋势因子：以 1 月为基期线性增长至年末（1 + growth × m/11） */
function trendFactor(period: string, growth: number): number {
  return 1 + (growth * monthIndexOf(period)) / 11
}

/** 季节因子表（月序 1–12）：春运尖峰 / 暑期高峰 / 黄金周脉冲 / 经济弱波动 */
const SEASON_TABLE: Record<'heat' | 'passenger' | 'economy', number[]> = {
  heat: [1.32, 1.26, 0.98, 1.0, 1.02, 0.99, 1.14, 1.16, 1.0, 1.18, 1.02, 0.96],
  passenger: [1.38, 1.3, 0.97, 1.0, 1.02, 0.98, 1.18, 1.2, 0.99, 1.22, 1.0, 0.94],
  economy: [0.96, 1.02, 1.04, 1.05, 1.03, 1.05, 1.04, 1.05, 1.06, 1.05, 1.03, 0.94],
}

/** OD 季节口径：客运随客流、货运随经济 */
const FLOW_SEASON_KEY: Record<FlowOD['category'], 'passenger' | 'economy'> = {
  passenger: 'passenger',
  cargo: 'economy',
}

/** 噪声因子：seed = period+subject，对称区间 ±amp */
function noiseFactor(period: string, subject: string, amp: number): number {
  const rand = mulberry32(hashSeed(`${period}#${subject}`))
  return 1 + (rand() - 0.5) * 2 * amp
}

/** 指标噪声幅度 */
const NOISE_AMP: Record<MetricKey, number> = { heat: 0.05, passenger: 0.06, economy: 0.04 }
const FLOW_NOISE_AMP = 0.08

/** 城市当期指标值（getCities / getCityHistory 共用入口） */
export function cityMetricValue(period: string, name: string, metric: MetricKey): number {
  const base = cityBase(name, metric)
  if (base === 0) return 0
  const trend = trendFactor(period, cityGrowth(name))
  const season = SEASON_TABLE[metric][monthOf(period) - 1]
  const noise = noiseFactor(period, `${metric}:${name}`, NOISE_AMP[metric])
  return Math.round(base * trend * season * noise)
}

/** OD 当期运量（getFlows 与干线统计共用） */
export function flowVolumeValue(period: string, flow: FlowOD): number {
  const trend = trendFactor(period, 0.1)
  const season = SEASON_TABLE[FLOW_SEASON_KEY[flow.category]][monthOf(period) - 1]
  const noise = noiseFactor(period, `flow:${flow.from}-${flow.to}`, FLOW_NOISE_AMP)
  return Math.round(flow.volume * trend * season * noise)
}
