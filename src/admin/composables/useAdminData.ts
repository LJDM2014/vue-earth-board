/**
 * 管理端全量数据加载与聚合（A4）：
 * - 一次拉取 /api/admin/cities + /api/admin/flows + /api/periods（+health 取 updatedAt），
 *   数据量小（75 城 × 12 期 × 3 指标 + 45 OD），周期/指标切换纯前端计算零请求；
 * - 模块级单例状态：页面间切换不重复拉取，refresh() 供 CRUD 保存后重取；
 * - 聚合函数均为导出的纯函数（A8 单测覆盖：趋势求和 / TOP10 排序 / 占比 / 省份覆盖）。
 */
import { ref } from 'vue'
import type { CityRecord, FlowRecord, MetricKey } from '../types'
import { api } from '../api/client'

const cities = ref<CityRecord[]>([])
const flows = ref<FlowRecord[]>([])
const periods = ref<string[]>([])
const updatedAt = ref('')
const loading = ref(false)
const error = ref('')

/** 模块级加载 promise：并发调用与跨页面切换只发一轮请求 */
let inflight: Promise<void> | null = null

async function doRefresh(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [cityList, flowList, periodList, health] = await Promise.all([
      api.getAdminCities(),
      api.getAdminFlows(),
      api.getPeriods(),
      api.getHealth(),
    ])
    cities.value = cityList
    flows.value = flowList
    periods.value = periodList
    updatedAt.value = health.updatedAt
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    loading.value = false
    inflight = null
  }
}

/** 管理端数据单例（A4）：视图解构后直接消费 ref 状态 */
export function useAdminData() {
  return {
    cities,
    flows,
    periods,
    updatedAt,
    loading,
    error,
    /** 首次调用拉取；inflight 去重，CRUD 保存后可强制重取 */
    refresh(force = false): Promise<void> {
      if (inflight) return inflight
      if (!force && cities.value.length > 0) return Promise.resolve()
      inflight = doRefresh()
      return inflight
    },
  }
}

/* ---------------- 纯聚合函数（图表数据源，A8 单测覆盖） ---------------- */

/** 各期指标总和（三指标全国趋势）：periods 升序输出对齐 */
export function metricSeries(cities: CityRecord[], periods: string[], metric: MetricKey): number[] {
  return periods.map((p) => cities.reduce((sum, c) => sum + (c.metrics[p]?.[metric] ?? 0), 0))
}

export interface NameValue {
  name: string
  value: number
}

/** 城市指标 TOP N（选中周期 + 指标），降序 */
export function topCities(
  cities: CityRecord[],
  period: string,
  metric: MetricKey,
  n = 10,
): NameValue[] {
  return cities
    .map((c) => ({ name: c.name, value: c.metrics[period]?.[metric] ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}

export interface FlowTop extends NameValue {
  category: 'passenger' | 'cargo'
}

/** 航线运量 TOP N（选中周期），from → to 标签，降序 */
export function topFlows(flows: FlowRecord[], period: string, n = 10): FlowTop[] {
  return flows
    .map((f) => ({
      name: `${f.from} → ${f.to}`,
      value: f.volumes[period] ?? 0,
      category: f.category,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
}

/** 客货运量占比（选中周期 Σpassenger vs Σcargo） */
export function categoryShare(
  flows: FlowRecord[],
  period: string,
): { passenger: number; cargo: number } {
  let passenger = 0
  let cargo = 0
  for (const f of flows) {
    const v = f.volumes[period] ?? 0
    if (f.category === 'passenger') passenger += v
    else cargo += v
  }
  return { passenger, cargo }
}

/** 省份覆盖城市数（31 省条形），降序 */
export function provinceCoverage(cities: CityRecord[]): NameValue[] {
  const count = new Map<string, number>()
  for (const c of cities) count.set(c.province, (count.get(c.province) ?? 0) + 1)
  return [...count.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}
