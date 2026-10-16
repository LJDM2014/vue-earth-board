import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDataSource } from '../createDataSource'
import { HttpDataSource } from '../httpDataSource'
import { MockDataSource } from '../mockDataSource'
import { onMonitorEvent, type MonitorEvent } from '../monitor'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createDataSource 数据源工厂（M7.3）', () => {
  it('缺省/mock 模式：直接返回 MockDataSource，无降级', async () => {
    const handle = await createDataSource({})
    expect(handle.degraded).toBe(false)
    expect(handle.source).toBeInstanceOf(MockDataSource)
  })

  it('http 模式 + 预检通过：返回 HttpDataSource', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ['2025-01'] })),
    )
    const handle = await createDataSource({ VITE_DATA_SOURCE: 'http', VITE_API_BASE_URL: 'http://test' })
    expect(handle.degraded).toBe(false)
    expect(handle.source).toBeInstanceOf(HttpDataSource)
  })

  it('http 模式 + 预检失败：上报 fallback 并回落 mock（degraded=true）', async () => {
    const events: MonitorEvent[] = []
    const off = onMonitorEvent((e) => events.push(e))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused')
      }),
    )
    try {
      const handle = await createDataSource({ VITE_DATA_SOURCE: 'http', VITE_API_BASE_URL: 'http://bad' })
      expect(handle.degraded).toBe(true)
      expect(handle.source).toBeInstanceOf(MockDataSource)
      const fallback = events.find((e) => e.type === 'data-source-error' && e.source === 'fallback')
      expect(fallback?.type).toBe('data-source-error')
      expect(fallback?.detail).toContain('回落')
    } finally {
      off()
    }
  })
})
