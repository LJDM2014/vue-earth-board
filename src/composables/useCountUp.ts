import { onScopeDispose, ref, watch, type Ref } from 'vue'

/** 数值滚动默认时长（毫秒） */
const DEFAULT_DURATION = 600

/**
 * count-up 数值滚动（M6.2）：source 变化时从旧值缓出动画到新值（easeOutCubic）。
 * 返回只读展示值（小数），由调用方决定取整/格式化。
 */
export function useCountUp(source: () => number, duration = DEFAULT_DURATION): Ref<number> {
  const display = ref(source())
  let raf = 0

  watch(source, (to) => {
    const from = display.value
    // 非有限值或等值直接落定，不起动画
    if (!Number.isFinite(to) || !Number.isFinite(from) || from === to) {
      display.value = to
      return
    }
    cancelAnimationFrame(raf)
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      display.value = from + (to - from) * ease
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  })

  onScopeDispose(() => cancelAnimationFrame(raf))
  return display
}
