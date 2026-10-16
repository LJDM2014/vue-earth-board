import { z } from 'zod'
import type { CityMetric } from '../mock/cities'
import type { FlowOD } from '../mock/flows'
import type { Period } from './dataSource'
import { reportMonitorEvent } from './monitor'

/**
 * 数据契约层（M7.1）：后端字段与前端领域模型解耦的唯一边界。
 * 后端改字段名/结构只需改本文件；校验失败的脏数据逐条跳过并上报
 * `data-source-error/contract`，不抛断大屏；整体响应失败才走降级链（7.3）。
 *
 * 契约约定：
 * - periods → `["2025-01", ...]` 字符串数组直出（升序）；
 * - cities/flows → 对象数组直出；history → 数字数组直出；
 * - 指标单位与 mock 口径一致：passenger 万人次 / economy 亿元 / heat 无量纲。
 */

/** 城市指标 DTO：indicators 三键缺省补 0；name/lnglat 为必填，缺失判脏跳过 */
const CityMetricSchema = z.object({
  name: z.string().min(1),
  province: z.string().catch(''),
  lnglat: z.tuple([z.number(), z.number()]),
  indicators: z.object({
    heat: z.number().catch(0),
    passenger: z.number().catch(0),
    economy: z.number().catch(0),
  }),
})

/** 航线 OD DTO：category 非法值回落客运，volume 非法值补 0 */
const FlowODSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  volume: z.number().catch(0),
  category: z.enum(['passenger', 'cargo']).catch('passenger'),
})

/** zod issue → 简洁错误明细（`path: message` 串联） */
function issueDetail(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
}

function reportContract(source: string, detail: string): void {
  reportMonitorEvent({ type: 'data-source-error', source: `contract/${source}`, detail })
}

/** 城市列表适配：逐条校验，脏条目跳过并上报，其余映射为领域模型 */
export function adaptCityMetrics(raw: unknown): CityMetric[] {
  if (!Array.isArray(raw)) {
    reportContract('cities', `响应应为数组，实际 ${typeof raw}`)
    return []
  }
  const out: CityMetric[] = []
  raw.forEach((item, i) => {
    const parsed = CityMetricSchema.safeParse(item)
    if (!parsed.success) {
      reportContract('cities', `cities[${i}] ${issueDetail(parsed.error)}`)
      return
    }
    const dto = parsed.data
    const indicators = { ...dto.indicators }
    out.push({
      name: dto.name,
      province: dto.province,
      lnglat: dto.lnglat,
      // 快照缺省为热度；App.vue 按激活指标重映射（与 MockDataSource 口径一致）
      value: indicators.heat,
      indicators,
    })
  })
  return out
}

/** 航线 OD 列表适配：逐条校验，脏条目跳过并上报 */
export function adaptFlows(raw: unknown): FlowOD[] {
  if (!Array.isArray(raw)) {
    reportContract('flows', `响应应为数组，实际 ${typeof raw}`)
    return []
  }
  const out: FlowOD[] = []
  raw.forEach((item, i) => {
    const parsed = FlowODSchema.safeParse(item)
    if (!parsed.success) {
      reportContract('flows', `flows[${i}] ${issueDetail(parsed.error)}`)
      return
    }
    out.push(parsed.data)
  })
  return out
}

/** 周期列表适配：仅保留非空字符串，去重升序 */
export function adaptPeriods(raw: unknown): Period[] {
  if (!Array.isArray(raw)) {
    reportContract('periods', `响应应为数组，实际 ${typeof raw}`)
    return []
  }
  return [...new Set(raw.filter((p): p is string => typeof p === 'string' && p.length > 0))].sort()
}

/** 历史序列适配：仅保留有限数字 */
export function adaptHistory(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    reportContract('history', `响应应为数组，实际 ${typeof raw}`)
    return []
  }
  return raw.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
}
