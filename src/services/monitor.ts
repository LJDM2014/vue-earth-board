/**
 * 运行时监控钩子（M4.6）：大屏现场（展厅/内网）快速定位问题的预留上报位。
 * 默认仅 console.warn 留痕；接入真实上报后端时调用 onMonitorEvent 注册
 * reporter（如 fetch 埋点、Sentry、自建日志服务），业务代码无需改动。
 */

/** 监控事件类型：覆盖大屏运行期的三类致命降级场景 */
export type MonitorEvent =
  | { type: 'webgl-context-lost'; detail?: string }
  | { type: 'style-load-error'; detail?: string }
  | { type: 'data-source-error'; source: string; detail?: string }

/** 外部上报器：返回的事件交给部署方自行处理 */
export type MonitorReporter = (event: MonitorEvent) => void

const reporters = new Set<MonitorReporter>()

/** 注册监控上报器，返回取消订阅函数 */
export function onMonitorEvent(reporter: MonitorReporter): () => void {
  reporters.add(reporter)
  return () => reporters.delete(reporter)
}

/** 上报监控事件：console 留痕（现场可见）+ 分发给已注册的外部上报器 */
export function reportMonitorEvent(event: MonitorEvent): void {
  console.warn(`[monitor] ${event.type}`, 'detail' in event ? event.detail : '')
  for (const reporter of reporters) {
    try {
      reporter(event)
    } catch (err) {
      // 上报器自身异常不能影响大屏主流程
      console.warn('[monitor] reporter 执行异常', err)
    }
  }
}

/** HttpReporter 上报报文中的单条事件（附时间戳） */
export interface MonitorEventPayload {
  type: string
  detail?: string
  source?: string
  ts: number
}

/** HttpReporter 整包报文：会话标识 + 页面停留时长 + 事件批次 */
export interface MonitorReportBody {
  sessionId: string
  dwellMs: number
  events: MonitorEventPayload[]
}

export interface HttpReporterOptions {
  /** 缓冲上限（满即 flush），默认 10 */
  maxBatch?: number
  /** 定时 flush 间隔（毫秒），默认 5000 */
  flushIntervalMs?: number
}

/** 会话标识：每次页面加载生成一次，后端据此聚合同一会话的事件 */
function makeSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 批量缓冲上报器（M9.2）：监控事件先入缓冲，满批或定时统一上报。
 * sendBeacon 优先（页面关闭也能送达），返回 false / 抛错回落 fetch keepalive；
 * 上报失败一律静默——上报通道自身不产生监控事件，避免风暴。
 */
export class HttpReporter {
  private readonly url: string
  private readonly maxBatch: number
  private readonly flushIntervalMs: number
  private readonly sessionId = makeSessionId()
  private readonly startedAt = Date.now()
  private buffer: MonitorEventPayload[] = []
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(url: string, options: HttpReporterOptions = {}) {
    this.url = url
    this.maxBatch = options.maxBatch ?? 10
    this.flushIntervalMs = options.flushIntervalMs ?? 5000
  }

  /** MonitorReporter 入口（箭头属性：可直接作为回调传递，无需 bind） */
  readonly report = (event: MonitorEvent): void => {
    this.buffer.push({
      type: event.type,
      ...('detail' in event && event.detail !== undefined ? { detail: event.detail } : {}),
      ...('source' in event ? { source: event.source } : {}),
      ts: Date.now(),
    })
    if (this.buffer.length >= this.maxBatch) {
      this.flush()
      return
    }
    if (this.timer === undefined) {
      this.timer = setTimeout(() => {
        this.timer = undefined
        this.flush()
      }, this.flushIntervalMs)
    }
  }

  /** 立即清空缓冲并上报；无缓冲时为空操作（也顺带清理定时器） */
  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    if (this.buffer.length === 0) return
    const body: MonitorReportBody = {
      sessionId: this.sessionId,
      dwellMs: Date.now() - this.startedAt,
      events: this.buffer,
    }
    this.buffer = []
    const text = JSON.stringify(body)
    // sendBeacon 优先（页面关闭也能送达）；返回 false / 抛错 / 环境缺失均回落 fetch keepalive
    let sent = false
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        sent = navigator.sendBeacon(this.url, new Blob([text], { type: 'application/json' }))
      } catch {
        sent = false
      }
    }
    if (!sent) {
      // keepalive 保证页面卸载后请求仍能发出；上报失败静默，不产生监控风暴
      void fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
        keepalive: true,
      }).catch(() => {})
    }
  }
}
