/**
 * 崩溃自愈重载防护（M9.3）：大屏无用户态，WebGL 上下文丢失等致命故障
 * 以整页 location.reload() 恢复最简可靠；但若故障在加载后立即复现会形成
 * 崩溃循环，因此用 sessionStorage 记录 10 分钟窗口内的重载次数，超限后
 * 停止自动重载、仅保留监控上报，等待人工介入。
 */

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'xb-reload-guard'
/** 防循环窗口（毫秒） */
export const RELOAD_WINDOW_MS = 10 * 60 * 1000
/** 窗口内允许的最大自动重载次数 */
export const MAX_RELOADS = 3

/**
 * 记录一次自动重载，返回本次是否允许执行：
 * 10 分钟窗口内已达上限则拒绝（false）；存储异常时放行（fail-open，重载总比黑屏好）。
 */
export function recordReload(storage: StorageLike, now: number = Date.now()): boolean {
  try {
    const stamps = (JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as number[]).filter(
      (t) => now - t < RELOAD_WINDOW_MS,
    )
    if (stamps.length >= MAX_RELOADS) {
      storage.setItem(STORAGE_KEY, JSON.stringify(stamps))
      return false
    }
    stamps.push(now)
    storage.setItem(STORAGE_KEY, JSON.stringify(stamps))
    return true
  } catch {
    return true
  }
}

/**
 * WebGL 上下文丢失自愈入口（M9.3）：仅生产构建生效（开发态重载反而打断调试），
 * 延迟 3s 重载（给监控上报留出发送窗口），防循环拒绝时不调度。
 * 返回是否已调度重载。
 */
export function scheduleContextLostReload(
  storage: StorageLike = sessionStorage,
  delayMs = 3000,
): boolean {
  if (!import.meta.env.PROD) return false
  if (!recordReload(storage)) return false
  window.setTimeout(() => window.location.reload(), delayMs)
  return true
}
