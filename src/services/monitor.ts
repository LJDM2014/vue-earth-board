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
