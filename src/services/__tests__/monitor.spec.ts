import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpReporter } from '../monitor'

/** 从 sendBeacon/fetch 调用参数中解析整包报文（sendBeacon 实参为 Blob） */
async function parseBody(call: unknown[]): Promise<ReturnType<typeof JSON.parse>> {
  const arg = call[1] as string | Blob
  const text = arg instanceof Blob ? await arg.text() : (arg as string)
  return JSON.parse(text)
}

let sendBeacon: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  sendBeacon = vi.fn(() => true)
  fetchMock = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { sendBeacon })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('HttpReporter 批量缓冲（M9.2）', () => {
  it('未满批不发送；满 10 条立即 flush', async () => {
    const reporter = new HttpReporter('/api/monitor')
    for (let i = 0; i < 9; i++) {
      reporter.report({ type: 'data-source-error', source: 'http', detail: `e${i}` })
    }
    expect(sendBeacon).not.toHaveBeenCalled()

    reporter.report({ type: 'style-load-error' })
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const call = sendBeacon.mock.calls[0]
    expect(call[0]).toBe('/api/monitor')
    const body = await parseBody(call)
    expect(body.events).toHaveLength(10)
    expect(body.events[0]).toMatchObject({ type: 'data-source-error', source: 'http', detail: 'e0' })
  })

  it('定时 flush：未满批 5s 后统一上报并清空缓冲', async () => {
    const reporter = new HttpReporter('/api/monitor')
    reporter.report({ type: 'webgl-context-lost' })
    vi.advanceTimersByTime(4999)
    expect(sendBeacon).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect((await parseBody(sendBeacon.mock.calls[0])).events).toHaveLength(1)

    // 缓冲已清空：再次手动 flush 不应重复发送
    reporter.flush()
    expect(sendBeacon).toHaveBeenCalledTimes(1)
  })

  it('flush 后重置定时器：满批发送后未到 5s 不再重复发送', () => {
    const reporter = new HttpReporter('/api/monitor')
    for (let i = 0; i < 10; i++) reporter.report({ type: 'data-source-error', source: 'http' })
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    expect(sendBeacon).toHaveBeenCalledTimes(1)
  })

  it('报文结构：sessionId 字符串、dwellMs 非负、事件带 ts', async () => {
    const reporter = new HttpReporter('/api/monitor')
    reporter.report({ type: 'data-source-error', source: 'contract/cities', detail: 'bad' })
    vi.advanceTimersByTime(5000)
    const body = await parseBody(sendBeacon.mock.calls[0])
    expect(typeof body.sessionId).toBe('string')
    expect(body.sessionId.length).toBeGreaterThan(2)
    expect(body.dwellMs).toBeGreaterThanOrEqual(0)
    expect(body.events[0].ts).toBeTypeOf('number')
    expect(body.events[0]).toMatchObject({ type: 'data-source-error', source: 'contract/cities', detail: 'bad' })
  })

  it('sendBeacon 返回 false 回落 fetch keepalive', () => {
    sendBeacon.mockReturnValue(false)
    const reporter = new HttpReporter('/api/monitor')
    reporter.report({ type: 'webgl-context-lost' })
    reporter.flush()
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.keepalive).toBe(true)
    expect(init.method).toBe('POST')
  })

  it('上报失败静默：sendBeacon 抛错、fetch 拒绝均不向外抛出', async () => {
    sendBeacon.mockImplementation(() => {
      throw new Error('beacon blocked')
    })
    fetchMock.mockImplementation(() => Promise.reject(new Error('network down')))
    const reporter = new HttpReporter('/api/monitor')
    expect(() => {
      reporter.report({ type: 'style-load-error', detail: 'x' })
      reporter.flush()
    }).not.toThrow()
    // 等待 fetch promise 拒绝落进 catch，确认无未处理拒绝
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('无 sendBeacon 的环境直接走 fetch keepalive', () => {
    vi.stubGlobal('navigator', {})
    const reporter = new HttpReporter('/api/monitor')
    reporter.report({ type: 'webgl-context-lost' })
    reporter.flush()
    expect(sendBeacon).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('空缓冲 flush 为空操作', () => {
    const reporter = new HttpReporter('/api/monitor')
    reporter.flush()
    expect(sendBeacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
