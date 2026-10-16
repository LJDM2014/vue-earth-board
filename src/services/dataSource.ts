import type { CityMetric, MetricKey } from '../mock/cities'
import type { FlowOD } from '../mock/flows'

/** 数据切片周期（如 '2025-01'），时间轴播放器按期切换 */
export type Period = string

/**
 * 大屏数据源抽象：面板与图层只依赖本接口，
 * 切换 mock / REST / WS 实现时无需改动消费方。
 */
export interface BoardDataSource {
  /** 数据源类型标识（调试与降级提示用） */
  readonly kind: 'mock' | 'http' | 'ws'
  /** 全部可选周期（升序） */
  listPeriods(): Promise<Period[]>
  /** 指定周期的城市指标 */
  getCities(period: Period): Promise<CityMetric[]>
  /** 指定周期的航线 OD 数据 */
  getFlows(period: Period): Promise<FlowOD[]>
  /**
   * 指定城市以 period 为末期的近 count 期指标序列（升序，供 tooltip sparkline）。
   * metric 指定指标口径（M5.2，缺省热度）。无历史或城市未知时返回空数组。
   */
  getCityHistory(period: Period, name: string, count?: number, metric?: MetricKey): Promise<number[]>
}

/**
 * 实时推送能力接口（M7.4，可选实现）：数据源支持推送时消费方订阅替代轮询。
 * 返回退订函数，契约与 onMonitorEvent 一致。
 */
export interface RealtimeCapable {
  /** 订阅指定周期的城市指标推送（全量快照，回调频率由实现方决定） */
  subscribeCities(period: Period, cb: (cities: CityMetric[]) => void): () => void
}

/** 运行时能力探测：数据源是否具备推送能力 */
export function isRealtimeCapable(source: BoardDataSource): source is BoardDataSource & RealtimeCapable {
  return typeof (source as Partial<RealtimeCapable>).subscribeCities === 'function'
}
