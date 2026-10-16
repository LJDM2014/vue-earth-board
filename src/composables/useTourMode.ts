import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import { CAMERA_PRESETS, type CameraPreset } from '../config/cameras'
import { boardConfig } from '../config/runtime'
import type { Period } from '../services/dataSource'

/**
 * 大屏轮播域（M7.6 自 App.vue 抽离）：定时轮播预设机位 + 每 N 步推进一期数据，
 * ESC 退出；进入轮播先退出下钻并停转，退出后恢复原自转状态。
 */
export function useTourMode(deps: {
  autoRotate: Ref<boolean>
  setAutoRotate: (on: boolean) => void
  periods: Ref<Period[]>
  period: Ref<Period>
  drillProvince: Ref<{ name: string; adcode: number } | null>
  exitDrill: () => void
  flyToPreset: (preset: CameraPreset) => void
}) {
  const tourActive = ref(false)
  const tourIndex = ref(0)
  const tourLabel = computed(
    () => CAMERA_PRESETS[tourIndex.value % CAMERA_PRESETS.length].label,
  )
  let tourTimer: number | undefined
  let rotateBeforeTour: boolean | null = null

  function startTour() {
    if (deps.drillProvince.value) deps.exitDrill()
    rotateBeforeTour = deps.autoRotate.value
    deps.setAutoRotate(false)
    tourIndex.value = 0
    tourActive.value = true
    deps.flyToPreset(CAMERA_PRESETS[0])
    // 轮播节奏随运行配置（M9.4）：缺省与原常量一致
    tourTimer = window.setInterval(stepTour, boardConfig.value.tourStepMs)
  }

  function stepTour() {
    tourIndex.value += 1
    deps.flyToPreset(CAMERA_PRESETS[tourIndex.value % CAMERA_PRESETS.length])
    // 每隔 N 个机位推进一期数据切片，形成「机位 + 数据」联合巡览
    if (tourIndex.value % boardConfig.value.tourPeriodEvery === 0) advancePeriod()
  }

  function advancePeriod() {
    const list = deps.periods.value
    if (list.length === 0) return
    const idx = list.indexOf(deps.period.value)
    deps.period.value = list[(idx + 1) % list.length] ?? list[0]
  }

  function stopTour() {
    window.clearInterval(tourTimer)
    tourTimer = undefined
    tourActive.value = false
    if (rotateBeforeTour !== null) {
      deps.setAutoRotate(rotateBeforeTour)
      rotateBeforeTour = null
    }
  }

  function onTourKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') stopTour()
  }

  watch(tourActive, (on) => {
    if (on) window.addEventListener('keydown', onTourKeydown)
    else window.removeEventListener('keydown', onTourKeydown)
  })

  onUnmounted(() => {
    window.clearInterval(tourTimer)
    window.removeEventListener('keydown', onTourKeydown)
  })

  return { tourActive, tourLabel, startTour, stopTour }
}
