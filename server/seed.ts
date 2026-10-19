/**
 * 种子数据生成（后台数据管理模块 A1）：
 * 复用大屏 mock 时序生成核心（src/mock/series.ts 纯函数），把 12 期 × 75 城 × 3 指标
 * + 46 条 OD × 12 期全部物化为显式数值——种子态下与现行大屏演示数据完全一致，
 * 此后管理端编辑的都是实际值（生成式 → 显式值的接管点）。
 */
import { MOCK_CITIES } from '../src/mock/cities'
import { MOCK_FLOWS } from '../src/mock/flows'
import { cityMetricValue, flowVolumeValue } from '../src/mock/series'
import type { DbData } from './db'

/** 时间轴覆盖的月份数（2025-01 起连续 12 期，与 MockDataSource.PERIOD_COUNT 口径一致） */
const PERIOD_COUNT = 12

/** 生成 12 期连续月份周期，格式 'YYYY-MM'（升序） */
export function buildSeedPeriods(): string[] {
  return Array.from({ length: PERIOD_COUNT }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`)
}

/** 构建完整种子库：档案 + 逐期显式数值（同 seed 同结果，可复现） */
export function buildSeedDb(now = new Date()): DbData {
  const periods = buildSeedPeriods()
  const seededAt = now.toISOString()

  const cities = MOCK_CITIES.map((city) => ({
    name: city.name,
    province: city.province,
    lnglat: city.lnglat,
    rank: city.rank,
    metrics: Object.fromEntries(
      periods.map((p) => [
        p,
        {
          heat: cityMetricValue(p, city.name, 'heat'),
          passenger: cityMetricValue(p, city.name, 'passenger'),
          economy: cityMetricValue(p, city.name, 'economy'),
        },
      ]),
    ),
  }))

  const flows = MOCK_FLOWS.map((flow, i) => ({
    id: i + 1,
    from: flow.from,
    to: flow.to,
    category: flow.category,
    volumes: Object.fromEntries(periods.map((p) => [p, flowVolumeValue(p, flow)])),
  }))

  return {
    version: 1,
    meta: { seededAt, updatedAt: seededAt, nextFlowId: flows.length + 1 },
    periods,
    cities,
    flows,
  }
}
