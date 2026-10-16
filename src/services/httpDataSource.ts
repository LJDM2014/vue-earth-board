import type { CityMetric, MetricKey } from '../mock/cities'
import type { FlowOD } from '../mock/flows'
import type { BoardDataSource, Period } from './dataSource'
import { adaptCityMetrics, adaptFlows, adaptHistory, adaptPeriods } from './dto'

/** REST 端点描述：真实后端就绪后仅需填充 baseUrl 并实现拉取细节 */
export interface HttpDataSourceConfig {
  baseUrl: string
  endpoints: {
    periods: string
    cities: string
    flows: string
    /** 城市指标历史序列（后端无此端点时 getCityHistory 返回空数组，sparkline 静默隐藏） */
    history: string
  }
  /** 请求超时毫秒数（默认 8s） */
  timeoutMs?: number
  /** 重试退避毫秒序列（默认 200/800，测试注入 [0,0] 免等待） */
  retryDelays?: number[]
  /** fetch 注入点（测试用，缺省 globalThis.fetch） */
  fetchImpl?: typeof fetch
}

/** 单次请求失败上限 = 1 次首发 + retryDelays 次重试 */
function fetchWithRetry(
  url: string,
  timeoutMs: number,
  retryDelays: number[],
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const attempt = (index: number): Promise<unknown> =>
    new Promise<unknown>((resolve, reject) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      fetchImpl(url, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status })
          resolve(await res.json())
        })
        .catch((err: unknown) => {
          const status = (err as { status?: number }).status
          // 4xx 属契约外错误（除 404/408/429），重试无意义直接失败
          const noRetry = typeof status === 'number' && status >= 400 && status < 500
            && status !== 404 && status !== 408 && status !== 429
          if (noRetry || index >= retryDelays.length) {
            reject(err)
            return
          }
          setTimeout(() => attempt(index + 1).then(resolve, reject), retryDelays[index])
        })
        .finally(() => clearTimeout(timer))
    })
  return attempt(0)
}

/**
 * HTTP 数据源（M7.2 生产实现）：fetch + AbortController 超时 + 指数退避重试，
 * 响应统一经 dto.ts 契约校验适配；脏数据逐条拦截不抛断，整体失败由降级链接管。
 */
export class HttpDataSource implements BoardDataSource {
  /** 数据源类型标识：子类（WsDataSource）可覆写为 'ws' */
  readonly kind: BoardDataSource['kind'] = 'http'

  private readonly config: Required<Pick<HttpDataSourceConfig, 'baseUrl' | 'endpoints' | 'timeoutMs' | 'retryDelays'>>
  private readonly fetchImpl: typeof fetch

  constructor(config: HttpDataSourceConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      endpoints: config.endpoints,
      timeoutMs: config.timeoutMs ?? 8000,
      retryDelays: config.retryDelays ?? [200, 800],
    }
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args))
  }

  /** 端点地址拼装 */
  private url(endpoint: string, params?: Record<string, string>): string {
    const query = params ? `?${new URLSearchParams(params).toString()}` : ''
    return `${this.config.baseUrl}${endpoint}${query}`
  }

  private get(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    return fetchWithRetry(
      this.url(endpoint, params),
      this.config.timeoutMs,
      this.config.retryDelays,
      this.fetchImpl,
    )
  }

  async listPeriods(): Promise<Period[]> {
    return adaptPeriods(await this.get(this.config.endpoints.periods))
  }

  async getCities(period: Period): Promise<CityMetric[]> {
    return adaptCityMetrics(await this.get(this.config.endpoints.cities, { period }))
  }

  async getFlows(period: Period): Promise<FlowOD[]> {
    return adaptFlows(await this.get(this.config.endpoints.flows, { period }))
  }

  /** 后端未提供 history 端点（404）时返回空数组，sparkline 静默隐藏不报错 */
  async getCityHistory(period: Period, name: string, count = 12, metric: MetricKey = 'heat'): Promise<number[]> {
    try {
      return adaptHistory(
        await this.get(this.config.endpoints.history, {
          period,
          city: name,
          count: String(count),
          metric,
        }),
      )
    } catch (err) {
      if ((err as { status?: number }).status === 404) return []
      throw err
    }
  }
}
