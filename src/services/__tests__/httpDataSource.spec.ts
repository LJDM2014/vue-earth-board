import { describe, expect, it, vi } from 'vitest'
import { HttpDataSource, type HttpDataSourceConfig } from '../httpDataSource'

/** 构造 fetchImpl：okJson 直接返回 JSON；注入 retryDelays:[0,0] 免退避等待 */
function makeConfig(overrides: Partial<HttpDataSourceConfig>): HttpDataSourceConfig {
  return {
    baseUrl: 'http://test',
    endpoints: { periods: '/p', cities: '/c', flows: '/f', history: '/h' },
    retryDelays: [0, 0],
    ...overrides,
  }
}

const okJson = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload })
const failStatus = (status: number) => ({ ok: false, status, json: async () => ({}) })

describe('HttpDataSource 契约校验（M7.2）', () => {
  it('正常响应经 dto 适配：脏条目拦截，好数据通过', async () => {
    const fetchImpl = vi.fn(async () =>
      okJson([
        { name: '上海', province: '上海', lnglat: [121.47, 31.23], indicators: { heat: 88, passenger: 50, economy: 40 } },
        { name: '', lnglat: [0, 0] }, // 脏：缺 name
      ]),
    )
    const ds = new HttpDataSource(makeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch }))
    const cities = await ds.getCities('2025-01')
    expect(cities).toHaveLength(1)
    expect(cities[0].name).toBe('上海')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('HttpDataSource 超时与重试', () => {
  it('网络错误重试后成功：共调用 2 次', async () => {
    const fetchImpl = vi
      .fn<(url: string | URL | Request) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(okJson(['2025-01', '2025-02']))
    const ds = new HttpDataSource(makeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch }))
    expect(await ds.listPeriods()).toEqual(['2025-01', '2025-02'])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('重试耗尽后抛错：1 次首发 + 2 次重试 = 3 次调用', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down')
    })
    const ds = new HttpDataSource(makeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch }))
    await expect(ds.listPeriods()).rejects.toThrow('network down')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('4xx（除 404/408/429）不重试：仅调用 1 次', async () => {
    const fetchImpl = vi.fn(async () => failStatus(403))
    const ds = new HttpDataSource(makeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch }))
    await expect(ds.listPeriods()).rejects.toThrow('HTTP 403')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('404 允许重试后仍失败抛出', async () => {
    const fetchImpl = vi.fn(async () => failStatus(404))
    const ds = new HttpDataSource(makeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch }))
    await expect(ds.listPeriods()).rejects.toThrow('HTTP 404')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('超时（fetch 不响应 abort 信号路径除外）：超时后按重试序列失败', async () => {
    // 模拟永不返回的请求，监听 abort 信号拒绝
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<never>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('This operation was aborted')))
        }),
    )
    const ds = new HttpDataSource(
      makeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 20, retryDelays: [] }),
    )
    await expect(ds.listPeriods()).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('HttpDataSource.getCityHistory 404 静默', () => {
  it('history 端点 404 返回空数组（sparkline 静默隐藏）', async () => {
    const fetchImpl = vi.fn(async () => failStatus(404))
    const ds = new HttpDataSource(makeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch }))
    expect(await ds.getCityHistory('2025-01', '上海')).toEqual([])
  })

  it('history 端点其他错误照常抛出', async () => {
    const fetchImpl = vi.fn(async () => failStatus(500))
    const ds = new HttpDataSource(makeConfig({ fetchImpl: fetchImpl as unknown as typeof fetch }))
    await expect(ds.getCityHistory('2025-01', '上海')).rejects.toThrow('HTTP 500')
  })
})
