import { Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { markRaw, onMounted, onUnmounted, shallowRef, type Ref, type ShallowRef } from 'vue'
import { ACTIVE_BASEMAP, type BasemapOption } from '../config/basemap'

/** 大屏展示模式：3D = globe 投影，2D = mercator 投影 */
export type ScreenMode = '3d' | '2d'

/** 自转速率（度/秒），缓慢自西向东 */
const ROTATE_SPEED = 1.8
/** 用户停止交互后恢复自转的延时（毫秒） */
const RESUME_DELAY = 5000
/** 初始相机：俯瞰中国 */
const INITIAL_CENTER: [number, number] = [105.5, 36]
const INITIAL_ZOOM = 2.2
/** 触发自转暂停的用户交互事件 */
const INTERACTION_EVENTS = ['mousedown', 'touchstart', 'wheel', 'dragstart', 'dblclick'] as const

/**
 * MapLibre 地图初始化 composable：
 * 实例持有（shallowRef + markRaw）、投影切换、容器自适应、自动自转与卸载清理。
 */
export function useMapLibre(container: Ref<HTMLElement | null>) {
  /**
   * MapLibre 地图实例。
   * 必须用 shallowRef + markRaw：深层响应式代理会破坏 WebGL 内部状态导致渲染异常。
   */
  const mapInstance: ShallowRef<MapLibreMap | null> = shallowRef(null)
  /**
   * 地图样式完全就绪后的实例引用（'load' 事件置值）。
   * deck.gl MapboxOverlay 初始化时会读取 map.getProjection()，
   * maplibre v5 中该调用在样式未初始化前会抛错，因此 overlay 必须等此信号。
   */
  const mapReady: ShallowRef<MapLibreMap | null> = shallowRef(null)

  let resizeObserver: ResizeObserver | null = null
  let rafId = 0
  let resumeTimer: number | undefined
  let lastRotateTs = 0
  /** 当前投影模式：样式重载（切换底图）后按此恢复投影 */
  let currentMode: ScreenMode = '3d'
  /** 当前底图样式：用于避免重复 setStyle */
  let currentStyleUrl: string | StyleSpecification = ACTIVE_BASEMAP.styleUrl

  /** 切换投影模式（setProjection 会保持相机中心不变） */
  function setMode(mode: ScreenMode) {
    currentMode = mode
    mapInstance.value?.setProjection({ type: mode === '3d' ? 'globe' : 'mercator' })
  }

  /** 切换底图样式；样式重载触发 style.load 后投影按当前模式自动恢复 */
  function setBasemap(option: BasemapOption) {
    const map = mapInstance.value
    if (!map || option.styleUrl === currentStyleUrl) return
    currentStyleUrl = option.styleUrl
    map.setStyle(option.styleUrl)
  }

  /** 按钮化地图操作：统一视为用户交互，暂停自转 5 秒后恢复 */
  function zoomIn() {
    pauseForInteraction()
    mapInstance.value?.zoomIn()
  }

  function zoomOut() {
    pauseForInteraction()
    mapInstance.value?.zoomOut()
  }

  /** 回正北方向（保持中心与缩放） */
  function resetNorth() {
    pauseForInteraction()
    mapInstance.value?.rotateTo(0)
  }

  /** 复位到初始视角（俯瞰中国，含方位角与俯仰角归零） */
  function resetView() {
    pauseForInteraction()
    mapInstance.value?.jumpTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM, bearing: 0, pitch: 0 })
  }

  /** 自转主循环：每帧按时间增量推进中心经度 */
  function rotateStep(ts: number) {
    if (!rotating) return
    const map = mapInstance.value
    if (!map) return
    if (lastRotateTs === 0) lastRotateTs = ts
    const dt = Math.min(ts - lastRotateTs, 100) / 1000
    lastRotateTs = ts
    let lng = map.getCenter().lng + ROTATE_SPEED * dt
    if (lng > 180) lng -= 360
    map.setCenter([lng, map.getCenter().lat])
    rafId = requestAnimationFrame(rotateStep)
  }

  let rotating = false

  function startRotation() {
    if (rotating) return
    rotating = true
    lastRotateTs = 0
    rafId = requestAnimationFrame(rotateStep)
  }

  function stopRotation() {
    rotating = false
    cancelAnimationFrame(rafId)
  }

  /** 用户交互时暂停自转，交互结束 5 秒后恢复 */
  function pauseForInteraction() {
    stopRotation()
    window.clearTimeout(resumeTimer)
    resumeTimer = window.setTimeout(() => startRotation(), RESUME_DELAY)
  }

  onMounted(() => {
    const el = container.value
    if (!el) return

    const map = markRaw(
      new MapLibreMap({
        container: el,
        style: ACTIVE_BASEMAP.styleUrl,
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        attributionControl: { compact: true },
      }),
    )
    mapInstance.value = map

    // 样式就绪后按当前模式启用投影（首次加载为 globe；切换底图重载样式后同样生效）
    map.on('style.load', () => {
      map.setProjection({ type: currentMode === '3d' ? 'globe' : 'mercator' })
    })

    // OpenFreeMap 样式 sprite 偶有缺失图标（如 circle-11），注入透明占位避免控制台警告
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) {
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) })
      }
    })

    // 地图就绪后启动自转；任意用户交互暂停 5 秒后恢复
    map.on('load', () => {
      mapReady.value = map
      startRotation()
    })
    for (const evt of INTERACTION_EVENTS) {
      map.on(evt, pauseForInteraction)
    }

    // 容器尺寸变化时触发地图重排，避免开发热重载后画布错位
    resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(el)
  })

  onUnmounted(() => {
    window.clearTimeout(resumeTimer)
    stopRotation()
    resizeObserver?.disconnect()
    mapInstance.value?.remove()
    mapInstance.value = null
  })

  return {
    mapInstance,
    mapReady,
    setMode,
    setBasemap,
    zoomIn,
    zoomOut,
    resetNorth,
    resetView,
  }
}
