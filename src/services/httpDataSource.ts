import type { CityMetric } from '../mock/cities'
import type { FlowOD } from '../mock/flows'
import type { BoardDataSource, Period } from './dataSource'

/** REST 端点描述：真实后端就绪后仅需填充 baseUrl 并实现拉取细节 */
export interface HttpDataSourceConfig {
  baseUrl: string
  endpoints: {
    periods: string
    cities: string
    flows: string
  }
}

/**
 * HTTP 数据源占位：仅声明端点结构与接口实现骨架，
 * 不做网络实现（遵循 ROADMAP M2.7——面板与图层只依赖 BoardDataSource 接口）。
 */
export class HttpDataSource implements BoardDataSource {
  readonly kind = 'http' as const

  private readonly config: HttpDataSourceConfig

  constructor(config: HttpDataSourceConfig) {
    this.config = config
  }

  /** 端点地址拼装（实现网络拉取时的基础工具） */
  private url(endpoint: string, period?: Period): string {
    const query = period ? `?period=${encodeURIComponent(period)}` : ''
    return `${this.config.baseUrl}${endpoint}${query}`
  }

  async listPeriods(): Promise<Period[]> {
    void this.url(this.config.endpoints.periods)
    return Promise.reject(new Error('HttpDataSource 未实现：等待真实 REST 端点'))
  }

  async getCities(_period: Period): Promise<CityMetric[]> {
    void this.url(this.config.endpoints.cities, _period)
    return Promise.reject(new Error('HttpDataSource 未实现：等待真实 REST 端点'))
  }

  async getFlows(_period: Period): Promise<FlowOD[]> {
    void this.url(this.config.endpoints.flows, _period)
    return Promise.reject(new Error('HttpDataSource 未实现：等待真实 REST 端点'))
  }

  async getCityHistory(_period: Period, _name: string, _count?: number): Promise<number[]> {
    void this.url(this.config.endpoints.cities, _period)
    void _name
    void _count
    return Promise.reject(new Error('HttpDataSource 未实现：等待真实 REST 端点'))
  }
}
