/**
 * Admin API fetch 封装（A3）：
 * - 统一错误归一：非 2xx 解析 {error:{code,message}} 抛 ApiError；网络层失败抛 NETWORK_ERROR；
 * - 视图层只需 catch 后展示 err.message，与后端错误体口径一致（docs/admin-module-plan.md §4）。
 */
import type { CityRecord, FlowRecord, HealthInfo } from '../types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** ADMIN_TOKEN 门禁启用时（服务端设置 ADMIN_TOKEN env），前端经 VITE_ADMIN_TOKEN 构建注入自动携带 */
const ADMIN_TOKEN: string = import.meta.env.VITE_ADMIN_TOKEN ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (ADMIN_TOKEN !== '') headers.set('x-admin-token', ADMIN_TOKEN)
  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '网络异常：无法连接 API 服务')
  }
  if (!res.ok) {
    let code = `HTTP_${res.status}`
    let message = `请求失败（HTTP ${res.status}）`
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } }
      if (body.error) {
        code = body.error.code ?? code
        message = body.error.message ?? message
      }
    } catch {
      // 非 JSON 错误体（网关/代理错误页），保留默认文案
    }
    throw new ApiError(res.status, code, message)
  }
  return (await res.json()) as T
}

/** JSON 请求 init 快捷构造 */
function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export interface CityCreatePayload {
  name: string
  province: string
  lnglat: [number, number]
  rank?: number
  /** 指标初始化：省略 = 全周期置 0；提供 = 该组数值（onlyLastPeriod 决定复制范围） */
  metrics?: { heat: number; passenger: number; economy: number }
  /** true：仅写入最新一期，其余期置 0；缺省：复制到全部周期 */
  onlyLastPeriod?: boolean
}

export interface CityUpdatePayload {
  province?: string
  lnglat?: [number, number]
  rank?: number
  /** 指定周期指标写入（单期编辑传 1 项；「批量填充其他期」传 N 期） */
  metrics?: Array<{ period: string; heat: number; passenger: number; economy: number }>
}

/** DELETE /api/admin/cities/:name 响应（confirm=0 试探 / confirm=1 真删同构） */
export interface DeleteCityResult {
  city: string
  cascadeFlows: number
}

export type FlowCategory = 'passenger' | 'cargo'

export interface FlowCreatePayload {
  from: string
  to: string
  category: FlowCategory
  /** 周期 → 运量；未提供的周期置 0 */
  volumes?: Record<string, number>
}

export interface FlowUpdatePayload {
  from?: string
  to?: string
  category?: FlowCategory
  volumes?: Record<string, number>
}

/* ---------------- A7 导入导出 ---------------- */

export type ExportScope = 'all' | 'cities' | 'flows'
export type ImportMode = 'merge' | 'replace'

/** A7 导入错误明细（行标签 + 脏行原因） */
export interface ImportErrorItem {
  row: string
  detail: string
}

/** POST /api/import 响应（docs/admin-module-plan.md §4.3） */
export interface ImportResult {
  total: number
  accepted: number
  skipped: number
  errors: ImportErrorItem[]
  /** replace 模式清除的关联航线数（scope=all 全量清空 / cities 级联删除） */
  cascadeFlows?: number
  /** true：脏行数超出明细回显上限，errors 仅为前 100 条 */
  errorsTruncated?: boolean
}

/** 导出下载地址（Content-Disposition 由服务端设置；供 downloadExport 取数） */
function exportUrl(scope: ExportScope, format: 'json' | 'csv', template = false): string {
  const params = new URLSearchParams({ scope, format })
  if (template) params.set('template', '1')
  return `/api/export?${params.toString()}`
}

/**
 * 导出文件下载（fetch + blob 触发保存）。不用 <a href> 直下：
 * 服务端启用 ADMIN_TOKEN 门禁后导出端点同样要求 x-admin-token 头，<a> 无法携带自定义头。
 */
export async function downloadExport(scope: ExportScope, format: 'json' | 'csv', template = false): Promise<void> {
  let res: Response
  try {
    res = await fetch(exportUrl(scope, format, template), {
      headers: ADMIN_TOKEN !== '' ? { 'x-admin-token': ADMIN_TOKEN } : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '网络异常：无法连接 API 服务')
  }
  if (!res.ok) {
    let message = `导出失败（HTTP ${res.status}）`
    try {
      const body = (await res.json()) as { error?: { message?: string } }
      if (body.error?.message) message = body.error.message
    } catch {
      // 非 JSON 错误体（网关/代理错误页），保留默认文案
    }
    throw new ApiError(res.status, `HTTP_${res.status}`, message)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `board-${scope}${template ? '-template' : ''}.${format}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 管理端 API 集合（A5 城市 CRUD / A6 航线 CRUD / A7 导入导出与周期管理） */
export const api = {
  /** 服务健康（顶栏状态徽标，10s 轮询） */
  getHealth: (): Promise<HealthInfo> => request<HealthInfo>('/api/health'),
  /** 大屏周期列表（升序，board 读端点复用） */
  getPeriods: (): Promise<string[]> => request<string[]>('/api/periods'),
  /** 管理端全量城市（档案 + 各期 metrics，供列表与图表前端聚合） */
  getAdminCities: (): Promise<CityRecord[]> => request<CityRecord[]>('/api/admin/cities'),
  /** 管理端全量航线（OD + 各期 volumes） */
  getAdminFlows: (): Promise<FlowRecord[]> => request<FlowRecord[]>('/api/admin/flows'),

  /** A5 建城：重名 409 DUPLICATE */
  createCity: (payload: CityCreatePayload): Promise<CityRecord> =>
    request<CityRecord>('/api/admin/cities', jsonInit('POST', payload)),
  /** A5 更新城市（name 不可改）：未知城市 404、未知周期 400 */
  updateCity: (name: string, payload: CityUpdatePayload): Promise<CityRecord> =>
    request<CityRecord>(`/api/admin/cities/${encodeURIComponent(name)}`, jsonInit('PUT', payload)),
  /**
   * A5 删除城市（级联删除关联航线）：
   * confirm=false 试探 → 仅返回将级联的航线数；confirm=true 真删。前端用试探结果弹二次确认。
   */
  deleteCity: (name: string, confirm: boolean): Promise<DeleteCityResult> =>
    request<DeleteCityResult>(`/api/admin/cities/${encodeURIComponent(name)}?confirm=${confirm ? '1' : '0'}`, {
      method: 'DELETE',
    }),

  /** A6 新建 OD：from/to 不存在 400、同城 400、同拓扑同类别重复 409 */
  createFlow: (payload: FlowCreatePayload): Promise<FlowRecord> =>
    request<FlowRecord>('/api/admin/flows', jsonInit('POST', payload)),
  /** A6 更新 OD：未知 id 404、城市不存在/同城 400、未知周期 400 */
  updateFlow: (id: number, payload: FlowUpdatePayload): Promise<FlowRecord> =>
    request<FlowRecord>(`/api/admin/flows/${id}`, jsonInit('PUT', payload)),
  /** A6 删除单条航线（无级联） */
  deleteFlow: (id: number): Promise<{ id: number; deleted: boolean }> =>
    request<{ id: number; deleted: boolean }>(`/api/admin/flows/${id}`, { method: 'DELETE' }),

  /** A7 追加周期（409 重复、格式 400；初始值 = 复制最后一期到全部城市/航线） */
  addPeriod: (period: string): Promise<{ period: string; periods: string[] }> =>
    request('/api/admin/periods', jsonInit('POST', { period })),
  /** A7 删除周期（404 未知、最后一期 400；级联清理该期指标/运量） */
  deletePeriod: (period: string): Promise<{ period: string; periods: string[] }> =>
    request(`/api/admin/periods/${encodeURIComponent(period)}`, { method: 'DELETE' }),
  /** A7 重置种子数据（危险操作：丢弃当前数据回到种子态） */
  resetDb: (): Promise<HealthInfo> => request<HealthInfo>('/api/admin/reset', { method: 'POST' }),
  /** A7 导入：JSON 对象按 application/json、CSV 文本按 text/plain 发送，服务端嗅探解析 */
  importData: (mode: ImportMode, content: string | Record<string, unknown>): Promise<ImportResult> => {
    const isText = typeof content === 'string'
    return request<ImportResult>(`/api/import?mode=${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': isText ? 'text/plain' : 'application/json' },
      body: isText ? content : JSON.stringify(content),
    })
  },
}
