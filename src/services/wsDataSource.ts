import type { CityMetric } from '../mock/cities'
import type { BoardDataSource, Period, RealtimeCapable } from './dataSource'
import { adaptCityMetrics } from './dto'
import { HttpDataSource, type HttpDataSourceConfig } from './httpDataSource'

/** WS 消息契约：城市指标全量快照推送 */
interface CitiesPushMessage {
  period: Period
  cities: unknown
}

/** WebSocket 构造器最小契约（测试可注入桩实现） */
export type WebSocketCtor = new (url: string | URL, protocols?: string | string[]) => WebSocket

export interface WsDataSourceConfig extends HttpDataSourceConfig {
  /** WebSocket 服务地址 */
  wsUrl: string
  /** WebSocket 构造注入（测试用，缺省 globalThis.WebSocket） */
  WebSocketImpl?: WebSocketCtor
  /** 重连退避基数毫秒（默认 1000，翻倍至上限 30s） */
  reconnectBaseMs?: number
  /** 心跳间隔毫秒（默认 20000；0 关闭） */
  heartbeatMs?: number
}

/** 重连退避上限 */
const RECONNECT_MAX_MS = 30_000

/**
 * WS 实时推送数据源（M7.4）：REST 拉取沿用 HttpDataSource，
 * 城市指标经 subscribeCities 走 WebSocket 推送——断线自动重连（退避上限 30s）
 * + 心跳保活，消息经 dto 契约校验后回调，脏数据逐条拦截。
 */
export class WsDataSource extends HttpDataSource implements BoardDataSource, RealtimeCapable {
  readonly kind = 'ws' as const

  private readonly wsUrl: string
  private readonly WebSocketImpl: WebSocketCtor
  private readonly reconnectBaseMs: number
  private readonly heartbeatMs: number

  /** period → 回调集合 */
  private readonly subs = new Map<Period, Set<(cities: CityMetric[]) => void>>()
  private ws: WebSocket | null = null
  private reconnectAttempt = 0
  private reconnectTimer: number | undefined
  private heartbeatTimer: number | undefined
  private disposed = false

  constructor(config: WsDataSourceConfig) {
    super(config)
    this.wsUrl = config.wsUrl
    this.WebSocketImpl = config.WebSocketImpl ?? WebSocket
    this.reconnectBaseMs = config.reconnectBaseMs ?? 1000
    this.heartbeatMs = config.heartbeatMs ?? 20_000
  }

  subscribeCities(period: Period, cb: (cities: CityMetric[]) => void): () => void {
    let set = this.subs.get(period)
    if (!set) {
      set = new Set()
      this.subs.set(period, set)
    }
    set.add(cb)
    this.ensureOpen()

    return () => {
      const cur = this.subs.get(period)
      if (!cur) return
      cur.delete(cb)
      if (cur.size === 0) this.subs.delete(period)
      if (this.subs.size === 0) this.close()
    }
  }

  /** 懒建连：首个订阅者触发；连接已开/重连中则复用 */
  private ensureOpen() {
    if (this.disposed || this.ws || this.reconnectTimer !== undefined) return
    this.open()
  }

  private open() {
    const ws = new this.WebSocketImpl(this.wsUrl)
    this.ws = ws
    ws.onopen = () => {
      this.reconnectAttempt = 0
      this.startHeartbeat()
    }
    ws.onmessage = (ev: MessageEvent) => this.onMessage(ev.data)
    ws.onclose = () => {
      this.stopHeartbeat()
      this.ws = null
      // 仍有订阅者时按指数退避重连（上限 30s）
      if (!this.disposed && this.subs.size > 0) {
        const delay = Math.min(this.reconnectBaseMs * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
        this.reconnectAttempt += 1
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = undefined
          if (this.subs.size > 0) this.open()
        }, delay)
      }
    }
  }

  private onMessage(raw: unknown) {
    let msg: CitiesPushMessage
    try {
      msg = JSON.parse(String(raw)) as CitiesPushMessage
    } catch {
      return // 非法帧静默丢弃
    }
    const subs = this.subs.get(msg.period)
    if (!subs || subs.size === 0) return
    const cities = adaptCityMetrics(msg.cities)
    if (cities.length === 0) return
    for (const cb of subs) cb(cities)
  }

  private startHeartbeat() {
    if (!this.heartbeatMs) return
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      // readyState=1(OPEN)；连接半开时发送抛错由 onclose 兜底重连
      if (this.ws?.readyState === 1) this.ws.send('ping')
    }, this.heartbeatMs)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== undefined) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  /** 全部退订：断开连接并清理重连/心跳（实例不可复用为 disposed） */
  private close() {
    this.disposed = true
    this.stopHeartbeat()
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    this.ws?.close()
    this.ws = null
  }
}
