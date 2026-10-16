import { describe, expect, it } from 'vitest'
import {
  MAX_RELOADS,
  RELOAD_WINDOW_MS,
  recordReload,
  scheduleContextLostReload,
} from '../reloadGuard'

/** 内存存储替身（接口与 sessionStorage 一致） */
function memStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  }
}

describe('recordReload 防循环窗口（M9.3）', () => {
  it('窗口内前 3 次放行、第 4 次拒绝', () => {
    const store = memStorage()
    const t0 = 1_000_000
    for (let i = 0; i < MAX_RELOADS; i++) {
      expect(recordReload(store, t0 + i)).toBe(true)
    }
    expect(recordReload(store, t0 + MAX_RELOADS)).toBe(false)
    // 拒绝后记录不再增长：窗口内继续拒绝
    expect(recordReload(store, t0 + MAX_RELOADS + 1)).toBe(false)
  })

  it('窗口过期剪枝：最早记录滑出 10 分钟后重新放行', () => {
    const store = memStorage()
    const t0 = 2_000_000
    for (let i = 0; i < MAX_RELOADS; i++) recordReload(store, t0 + i)
    expect(recordReload(store, t0 + MAX_RELOADS)).toBe(false)
    // 最早的 t0 已滑出窗口，容量腾出一格
    expect(recordReload(store, t0 + RELOAD_WINDOW_MS + 1)).toBe(true)
  })

  it('存储异常时 fail-open 放行（重载总比黑屏好）', () => {
    const broken = {
      getItem: () => {
        throw new Error('quota')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(recordReload(broken)).toBe(true)
  })
})

describe('scheduleContextLostReload 生产门禁（M9.3）', () => {
  it('非生产构建不调度重载（vitest 环境 PROD=false）', () => {
    expect(scheduleContextLostReload(memStorage(), 3000)).toBe(false)
  })
})
