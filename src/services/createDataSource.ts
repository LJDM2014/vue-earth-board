import type { BoardDataSource } from './dataSource'
import { reportMonitorEvent } from './monitor'
import { HttpDataSource } from './httpDataSource'
import { MockDataSource } from './mockDataSource'

/** 数据源选择相关环境变量（vite-env.d.ts 已声明到 ImportMetaEnv） */
export interface DataSourceEnv {
  VITE_DATA_SOURCE?: string
  VITE_API_BASE_URL?: string
}

/** 数据源装配结果：degraded=true 表示 http 模式首拉失败已回落 mock */
export interface DataSourceHandle {
  source: BoardDataSource
  degraded: boolean
}

/** REST 端点默认值（后端路径调整时改这里或拆 env） */
const DEFAULT_ENDPOINTS = {
  periods: '/api/periods',
  cities: '/api/cities',
  flows: '/api/flows',
  history: '/api/history',
}

/**
 * 数据源工厂（M7.3）：按 `VITE_DATA_SOURCE`（mock|http，缺省 mock）装配实现。
 * http 模式先做 listPeriods 连通预检——失败上报 `data-source-error/fallback`
 * 并回落 MockDataSource（degraded=true），大屏永不白屏。
 */
export async function createDataSource(env: DataSourceEnv = import.meta.env): Promise<DataSourceHandle> {
  if (env.VITE_DATA_SOURCE !== 'http') {
    return { source: new MockDataSource(), degraded: false }
  }
  const http = new HttpDataSource({
    baseUrl: env.VITE_API_BASE_URL ?? '',
    endpoints: DEFAULT_ENDPOINTS,
  })
  try {
    await http.listPeriods()
    return { source: http, degraded: false }
  } catch (err) {
    reportMonitorEvent({
      type: 'data-source-error',
      source: 'fallback',
      detail: `HTTP 数据源不可用，已回落演示数据：${String(err)}`,
    })
    return { source: new MockDataSource(), degraded: true }
  }
}
