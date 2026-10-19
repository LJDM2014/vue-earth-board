/**
 * 后台管理数据类型（A3）：与 server/db.ts 存储结构一一对应（JSON 传输反序列化后的视图）。
 * 周期键统一为 'YYYY-MM' 字符串；城市唯一键 name、航线唯一键 id。
 */

export type FlowCategory = 'passenger' | 'cargo'

/** 三指标键（与大屏 MetricKey 口径一致，admin 侧独立定义避免运行时耦合 src/mock） */
export type MetricKey = 'heat' | 'passenger' | 'economy'

/** 城市三指标（显式数值，按周期键控） */
export interface CityMetrics {
  heat: number
  passenger: number
  economy: number
}

/** 城市档案 + 各期指标（name 为唯一键） */
export interface CityRecord {
  name: string
  province: string
  lnglat: [number, number]
  /** 全国 GDP 排位（展示用） */
  rank: number
  metrics: Record<string, CityMetrics>
}

/** 航线 OD + 各期运量（id 为唯一键，服务端自增） */
export interface FlowRecord {
  id: number
  from: string
  to: string
  category: FlowCategory
  volumes: Record<string, number>
}

/** GET /api/health 响应（计数口径） */
export interface HealthInfo {
  ok: boolean
  periods: number
  cities: number
  flows: number
  updatedAt: string
}
