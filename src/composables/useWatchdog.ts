import { onUnmounted, watch, type Ref, type ShallowRef } from 'vue'
import type { BoardDataSource } from '../services/dataSource'
import { MockDataSource } from '../services/mockDataSource'
import { onMonitorEvent, reportMonitorEvent } from '../services/monitor'

/** 连续 http 数据错误降级阈值（M9.3） */
export const HTTP_ERROR_DEGRADE_THRESHOLD = 3
/** 回前台距上次隐藏超过该时长则静默刷新当前期（瓦片/长连接可能已被服务端断开） */
export const REFRESH_AWAY_MS = 30 * 60 * 1000
/** 轮播被人为退出后，无交互多久自动恢复轮播（展厅被打断后自愈） */
export const TOUR_IDLE_RECOVER_MS = 60 * 1000

export interface WatchdogDeps {
  /** 当前数据源：连续错误时被替换为 MockDataSource（触发 useBoardData 重新 init） */
  sourceRef: Ref<BoardDataSource | null> | ShallowRef<BoardDataSource | null>
  /** 降级标记：驱动 TitleBar 金色「演示数据」角标 */
  isDegraded: Ref<boolean>
  /** 回前台超时后的当前期强刷（useBoardData.refreshCurrent） */
  refreshCurrent: () => void
  /** 轮播状态与恢复入口 */
  tourActive: Ref<boolean>
  startTour: () => void
}

/**
 * 连续 http 数据错误计数（纯逻辑，抽出便于单测）：
 * 数据源非 http（mock/降级后）视为中断，计数清零；
 * 连续达到阈值返回 true 并自动复位，保证降级动作只触发一次。
 */
export function createHttpErrorCounter(threshold: number = HTTP_ERROR_DEGRADE_THRESHOLD) {
  let count = 0
  return {
    record(activeHttp: boolean): boolean {
      if (!activeHttp) {
        count = 0
        return false
      }
      count += 1
      if (count >= threshold) {
        count = 0
        return true
      }
      return false
    },
  }
}

/**
 * 无人值守看门狗（M9.3）：展厅 7×24 场景的自愈闭环——
 * ① 连续 3 次 data-source-error（http 源在位）→ 强制回落 MockDataSource + 降级角标 + 上报；
 * ② visibilitychange 回前台且离开超 30min → 静默强刷当前期；
 * ③ 轮播曾启动过、被人为退出后 60s 无交互（pointerdown/wheel/keydown 重置计时）→ 自动恢复轮播。
 * （context lost 自愈重载在 useMapLibre 内接线，走 services/reloadGuard 防循环。）
 */
export function useWatchdog(deps: WatchdogDeps) {
  const counter = createHttpErrorCounter()

  // ① 数据错误降级：监听监控总线，仅 http 源在位时计数
  const offMonitor = onMonitorEvent((event) => {
    if (event.type !== 'data-source-error') return
    const isHttp = deps.sourceRef.value?.kind === 'http'
    if (!counter.record(isHttp)) return
    deps.sourceRef.value = new MockDataSource()
    deps.isDegraded.value = true
    reportMonitorEvent({
      type: 'data-source-error',
      source: 'fallback',
      detail: `连续 ${HTTP_ERROR_DEGRADE_THRESHOLD} 次数据错误，看门狗已回落演示数据`,
    })
  })

  // ② 回前台静默刷新
  let hiddenAt = 0
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now()
      return
    }
    if (hiddenAt !== 0 && Date.now() - hiddenAt > REFRESH_AWAY_MS) deps.refreshCurrent()
    hiddenAt = 0
  }
  document.addEventListener('visibilitychange', onVisibility)

  // ③ 轮播自恢复：仅在轮播启动过之后生效（初始常态不误触发）
  let idleTimer: number | undefined
  const clearIdle = () => {
    window.clearTimeout(idleTimer)
    idleTimer = undefined
  }
  const armIdle = () => {
    clearIdle()
    idleTimer = window.setTimeout(() => {
      idleTimer = undefined
      if (!deps.tourActive.value) deps.startTour()
    }, TOUR_IDLE_RECOVER_MS)
  }
  /** 任何用户交互都重置空闲计时（打断自愈，尊重现场操作员） */
  const onUserGesture = () => {
    if (idleTimer !== undefined) armIdle()
  }
  let tourStartedOnce = false
  const stopTourWatch = watch(deps.tourActive, (on) => {
    if (on) {
      tourStartedOnce = true
      clearIdle()
      return
    }
    if (tourStartedOnce) armIdle()
  })
  for (const evt of ['pointerdown', 'wheel', 'keydown'] as const) {
    window.addEventListener(evt, onUserGesture, { passive: true })
  }

  onUnmounted(() => {
    offMonitor()
    document.removeEventListener('visibilitychange', onVisibility)
    stopTourWatch()
    clearIdle()
    for (const evt of ['pointerdown', 'wheel', 'keydown'] as const) {
      window.removeEventListener(evt, onUserGesture)
    }
  })
}
