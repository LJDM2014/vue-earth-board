import type { CityMetric, MetricKey } from '../mock/cities'

/** 省份聚合行：指标合计 + 城市数 */
export interface ProvinceAgg {
  name: string
  value: number
  count: number
}

/** 玫瑰图展示的省份数上限，其余省份合并为「其他」 */
export const PROVINCE_TOP_N = 10

/** 全国口径指标合计（KPI 卡用，按 indicators 显式取数与激活指标解耦） */
export function metricTotal(cities: CityMetric[], metric: MetricKey): number {
  let sum = 0
  for (const c of cities) sum += c.indicators[metric]
  return sum
}

/** 按省份聚合指标并降序，截取前 PROVINCE_TOP_N 名（玫瑰图扇区收敛） */
export function aggregateProvinces(cities: CityMetric[], metric: MetricKey): ProvinceAgg[] {
  const sums = new Map<string, { value: number; count: number }>()
  for (const c of cities) {
    const cur = sums.get(c.province)
    if (cur) {
      cur.value += c.indicators[metric]
      cur.count += 1
    } else {
      sums.set(c.province, { value: c.indicators[metric], count: 1 })
    }
  }
  return [...sums.entries()]
    .map(([name, agg]) => ({ name, value: agg.value, count: agg.count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, PROVINCE_TOP_N)
}
