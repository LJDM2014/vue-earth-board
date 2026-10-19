/**
 * 管理端 CRUD 契约校验（A5 起使用，A7 导入复用部分 schema）：
 * - 校验失败统一 400 VALIDATION_ERROR（取首个 issue 文案），重名 409、未知资源 404 由路由层判定；
 * - 业务口径：经纬度限地理范围，指标/运量非负；周期必须已存在于 db.periods。
 */
import { z } from 'zod'

/** 非负指标值（热度/客流/经济/运量共用） */
export const metricValueSchema = z.number('指标需为数字').min(0, '指标不能为负数')

/**
 * CSV 公式注入防护：以 = + - @ 或制表/回车开头的文本，经 /api/export 导出 CSV
 * 在 Excel 中打开会被按公式执行（DDE）。入库时拒绝（治本），导出侧 csvEscape 另有转义（防御纵深）。
 */
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/
const FORMULA_PREFIX_MSG = '不能以 = + - @ 开头（导出 CSV 会被 Excel 按公式执行）'

export const lngLatSchema = z.tuple([
  z.number('经度需为数字').min(-180, '经度范围 -180 ~ 180').max(180, '经度范围 -180 ~ 180'),
  z.number('纬度需为数字').min(-90, '纬度范围 -90 ~ 90').max(90, '纬度范围 -90 ~ 90'),
])

/** 单期三指标写入项（PUT cities 批量：数组可传 1 ~ N 期） */
export const metricsPointSchema = z.object({
  period: z.string().min(1, '周期不能为空'),
  heat: metricValueSchema,
  passenger: metricValueSchema,
  economy: metricValueSchema,
})

/**
 * POST /api/admin/cities 建城（指标初始化策略，docs/admin-module-plan.md §4.2）：
 * - metrics 省略 → 全部周期置 0（「全部置 0」策略）；
 * - metrics 提供 + onlyLastPeriod 缺省/false → 该组数值复制到全部周期（「复制指定期」策略，
 *   表单以最新一期作为「当期」）；onlyLastPeriod = true → 仅写入最新一期，其余期置 0。
 */
export const cityCreateSchema = z.object({
  name: z.string('城市名需为字符串').trim().min(1, '城市名不能为空').max(24, '城市名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG),
  province: z.string('省份需为字符串').trim().min(1, '省份不能为空').max(24, '省份名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG),
  lnglat: lngLatSchema,
  rank: z.number().int('排位需为整数').min(0, '排位不能为负数').optional(),
  metrics: z
    .object({
      heat: metricValueSchema,
      passenger: metricValueSchema,
      economy: metricValueSchema,
    })
    .optional(),
  onlyLastPeriod: z.boolean().optional(),
})

/** PUT /api/admin/cities/:name：档案和/或指定周期指标，按需携带 */
export const cityUpdateSchema = z.object({
  province: z.string().trim().min(1, '省份不能为空').max(24, '省份名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG).optional(),
  lnglat: lngLatSchema.optional(),
  rank: z.number().int('排位需为整数').min(0, '排位不能为负数').optional(),
  metrics: z.array(metricsPointSchema).max(64, '单次更新期数过多').optional(),
})

const flowCategorySchema = z.enum(['passenger', 'cargo'], '类别需为 passenger 或 cargo')

/** POST /api/admin/flows 新建 OD：volumes 键为周期 'YYYY-MM'（未提供的周期置 0） */
export const flowCreateSchema = z.object({
  from: z.string().trim().min(1, '请选择起点城市').max(24, '城市名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG),
  to: z.string().trim().min(1, '请选择终点城市').max(24, '城市名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG),
  category: flowCategorySchema,
  volumes: z.record(z.string().min(1, '周期不能为空'), metricValueSchema).optional(),
})

/** PUT /api/admin/flows/:id：拓扑/类别和/或指定周期运量，按需携带 */
export const flowUpdateSchema = z.object({
  from: z.string().trim().min(1, '请选择起点城市').max(24, '城市名过长').optional(),
  to: z.string().trim().min(1, '请选择终点城市').max(24, '城市名过长').optional(),
  category: flowCategorySchema.optional(),
  volumes: z.record(z.string().min(1, '周期不能为空'), metricValueSchema).optional(),
})

/** 从 zod safeParse 结果提取首个可读错误文案 */
export function firstZodMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return '请求参数不合法'
  const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
  return `${path}${issue.message}`
}

/* ---------------- A7：周期管理与导入行校验 ---------------- */

/** POST /api/admin/periods 追加周期 body */
export const periodCreateSchema = z.object({
  period: z.string('周期需为字符串').regex(/^\d{4}-(0[1-9]|1[0-2])$/, '周期格式需为 YYYY-MM（月份 01-12）'),
})

/** 导入单期指标：键缺省 → 路由补 0（计划 §6.2「指标缺失补 0」），值非负 */
const importMetricsSchema = z.object({
  heat: metricValueSchema.optional(),
  passenger: metricValueSchema.optional(),
  economy: metricValueSchema.optional(),
})

const periodKeySchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '周期格式需为 YYYY-MM（月份 01-12）')

/**
 * 导入城市行（JSON 行 / CSV 行归一后同构）：lnglat 必填缺失判脏，
 * province 缺省由路由回落「未知」，指标缺失补 0。
 */
export const cityImportRowSchema = z.object({
  name: z.string('城市名需为字符串').trim().min(1, '城市名不能为空').max(24, '城市名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG),
  province: z.string('省份需为字符串').trim().max(24, '省份名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG).optional(),
  lnglat: lngLatSchema,
  rank: z.number('排位需为数字').int('排位需为整数').min(0, '排位不能为负数').optional(),
  metrics: z.record(periodKeySchema, importMetricsSchema).optional(),
})

/**
 * 导入航线行：category 不入 schema（非法值由路由回落 passenger，计划 §6.2）；
 * id 存在则按 id upsert（OD 唯一键），缺省按 from+to+category 匹配。
 */
export const flowImportRowSchema = z.object({
  id: z.number('航线 id 需为数字').int('航线 id 需为整数').positive('航线 id 需为正数').optional(),
  from: z.string('起点需为字符串').trim().min(1, '起点城市不能为空').max(24, '城市名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG),
  to: z.string('终点需为字符串').trim().min(1, '终点城市不能为空').max(24, '城市名过长').refine((v) => !FORMULA_PREFIX_RE.test(v), FORMULA_PREFIX_MSG),
  volumes: z.record(periodKeySchema, metricValueSchema.optional()).optional(),
})
