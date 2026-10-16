import { describe, expect, it, vi } from 'vitest'
import { WsDataSource, type WsDataSourceConfig, type WebSocketCtor } from '../wsDataSource'

/** 测试桩 WebSocket：手动驱动 open/message/close，记录 send 调用 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  url: string
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  closedByClient = false

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.closedByClient = true
    this.onclose?.()
  }

  /** 测试驱动：连接建立 */
  simulateOpen() {
    this.readyState = 1
    this.onopen?.()
  }

  /** 测试驱动：收到文本帧 */
  simulateMessage(data: unknown) {
    this.onmessage?.({ data })
  }

  /** 测试驱动：连接断开（服务端侧） */
  simulateClose() {
    this.readyState = 3
    this.onclose?.()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeConfig(overrides: Partial<WsDataSourceConfig> = {}): WsDataSourceConfig {
  return {
    baseUrl: 'http://test',
    endpoints: { periods: '/p', cities: '/c', flows: '/f', history: '/h' },
    wsUrl: 'ws://test/push',
    retryDelays: [0, 0],
    reconnectBaseMs: 5,
    heartbeatMs: 0,
    WebSocketImpl: FakeWebSocket as unknown as WebSocketCtor,
    ...overrides,
  }
}

const CITIES_PAYLOAD = JSON.stringify({
  period: '2025-01',
  cities: [
    { name: '上海', province: '上海', lnglat: [121.47, 31.23], indicators: { heat: 88, passenger: 50, economy: 40 } },
    { name: '', lnglat: [0, 0] }, // 脏数据：适配后仅剩 1 城
  ],
})

describe('WsDataSource（M7.4）', () => {
  it('首订阅懒建连，消息经契约校验后分发', async () => {
    FakeWebSocket.instances = []
    const ds = new WsDataSource(makeConfig())
    const received: unknown[] = []
    ds.subscribeCities('2025-01', (c) => received.push(c))
    expect(FakeWebSocket.instances).toHaveLength(1)
    const ws = FakeWebSocket.instances[0]
    ws.simulateOpen()
    ws.simulateMessage(CITIES_PAYLOAD)
    expect(received).toHaveLength(1)
    expect((received[0] as { name: string }[])[0].name).toBe('上海')
    expect(received[0]).toHaveLength(1) // 脏条目被拦截
  })

  it('周期不匹配 / 非法 JSON 帧 / 空适配结果均不回调', () => {
    FakeWebSocket.instances = []
    const ds = new WsDataSource(makeConfig())
    const cb = vi.fn()
    ds.subscribeCities('2025-01', cb)
    const ws = FakeWebSocket.instances[0]
    ws.simulateOpen()
    ws.simulateMessage(JSON.stringify({ period: '2025-02', cities: [{ name: 'X', lnglat: [1, 2] }] }))
    ws.simulateMessage('not-json')
    ws.simulateMessage(JSON.stringify({ period: '2025-01', cities: [{ name: '', lnglat: [0, 0] }] }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('断线自动重连：退避后建新连接，重连后恢复分发', async () => {
    FakeWebSocket.instances = []
    const ds = new WsDataSource(makeConfig({ reconnectBaseMs: 5 }))
    const received: number[] = []
    ds.subscribeCities('2025-01', (c) => received.push(c.length))
    const first = FakeWebSocket.instances[0]
    first.simulateOpen()
    first.simulateClose()
    expect(FakeWebSocket.instances).toHaveLength(1)
    await sleep(40) // 退避 5ms 后重连
    expect(FakeWebSocket.instances).toHaveLength(2)
    FakeWebSocket.instances[1].simulateOpen()
    FakeWebSocket.instances[1].simulateMessage(CITIES_PAYLOAD)
    expect(received).toEqual([1])
  })

  it('全部退订：客户端主动断开且不再重连', async () => {
    FakeWebSocket.instances = []
    const ds = new WsDataSource(makeConfig())
    const unsub = ds.subscribeCities('2025-01', () => {})
    const ws = FakeWebSocket.instances[0]
    ws.simulateOpen()
    unsub()
    expect(ws.closedByClient).toBe(true)
    await sleep(30)
    expect(FakeWebSocket.instances).toHaveLength(1) // disposed 后 onclose 不触发重连
  })

  it('心跳：连接打开后按间隔发送 ping', async () => {
    FakeWebSocket.instances = []
    const ds = new WsDataSource(makeConfig({ heartbeatMs: 10 }))
    ds.subscribeCities('2025-01', () => {})
    FakeWebSocket.instances[0].simulateOpen()
    await sleep(35)
    expect(FakeWebSocket.instances[0].sent.filter((s) => s === 'ping').length).toBeGreaterThanOrEqual(2)
  })
})
