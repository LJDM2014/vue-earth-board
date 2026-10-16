import { onUnmounted, ref, type Ref } from 'vue'

/**
 * 全局循环进度 composable：requestAnimationFrame 驱动 0→1 循环，
 * 供彗星尾迹、TripsLayer 轨迹回放等按帧动画的图层共用同一时间基准。
 */
export function useLoopProgress(loopSeconds: number): Ref<number> {
  const progress = ref(0)
  let rafId = 0
  let lastTs = 0

  function tick(ts: number) {
    if (lastTs !== 0) {
      progress.value = (progress.value + (ts - lastTs) / 1000 / loopSeconds) % 1
    }
    lastTs = ts
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)

  onUnmounted(() => cancelAnimationFrame(rafId))
  return progress
}
