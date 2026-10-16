import { Map as MapLibreMap, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { markRaw, onMounted, onUnmounted, ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import { ACTIVE_BASEMAP, type BasemapOption } from '../config/basemap'
import type { CameraPreset } from '../config/cameras'
import { reportMonitorEvent } from '../services/monitor'
import { scheduleContextLostReload } from '../services/reloadGuard'

/** symbol 标注所需的 glyph 字体服务（免 key、含 CJK）：统一样式的 glyphs 来源 */
const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'

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
  /** 地球自转开关：关闭后交互暂停也不再自动恢复 */
  const autoRotate = ref(true)
  /** 样式版本计数：底图切换 / glyphs 归一化完成后 +1，驱动自定义 source/layer 重新挂载 */
  const styleVersion = ref(0)
  /** 底图样式加载失败（内网/弱网）：首屏降级提示用，样式就绪后不再置位 */
  const loadError = ref(false)

  let resizeObserver: ResizeObserver | null = null
  /** WebGL 上下文丢失监听的解除函数（M4.6 监控接线） */
  let detachContextLost: (() => void) | null = null
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

  /** 飞往预设机位（M3.2 区域导航 / M3.6 轮播共用）：平滑过渡并按交互规则暂停自转 */
  function flyToCamera(preset: CameraPreset) {
    pauseForInteraction()
    mapInstance.value?.flyTo({
      center: preset.center,
      zoom: preset.zoom,
      duration: 2400,
      essential: true,
    })
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
    if (!autoRotate.value || rotating) return
    rotating = true
    lastRotateTs = 0
    rafId = requestAnimationFrame(rotateStep)
  }

  function stopRotation() {
    rotating = false
    cancelAnimationFrame(rafId)
  }

  /** 用户交互时暂停自转，交互结束 5 秒后恢复（开关关闭时不恢复） */
  function pauseForInteraction() {
    stopRotation()
    window.clearTimeout(resumeTimer)
    resumeTimer = window.setTimeout(() => startRotation(), RESUME_DELAY)
  }

  /** 切换地球自转开关：开启立即自转，关闭立即停止并取消恢复计时 */
  function setAutoRotate(on: boolean) {
    autoRotate.value = on
    window.clearTimeout(resumeTimer)
    if (on) startRotation()
    else stopRotation()
  }

  onMounted(() => {
    const el = container.value
    if (!el) return

    const map = markRaw(
      new MapLibreMap({
        container: el,
        style: ACTIVE_BASEMAP.styleUrl,
        center: INITIAL_CENTER,
        // 开场自更远处推近（M8.3）：load 后 flyTo 到正式机位，呈现「入场推进」感
        zoom: INITIAL_ZOOM - 0.9,
        attributionControl: { compact: true },
      }),
    )
    mapInstance.value = map

    // 样式就绪后先归一化 glyphs（城市中文标注依赖，部分底图缺失或字体不含 CJK），
    // setStyle 会再次触发 style.load；第二次 glyphs 已一致，才恢复投影并推进版本号
    map.on('style.load', () => {
      const style = map.getStyle()
      if (style.glyphs !== GLYPHS_URL) {
        map.setStyle({ ...style, glyphs: GLYPHS_URL }, { diff: false })
        return
      }
      map.setProjection({ type: currentMode === '3d' ? 'globe' : 'mercator' })
      styleVersion.value += 1
    })

    // OpenFreeMap 样式 sprite 偶有缺失图标（如 circle-11），注入透明占位避免控制台警告
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) {
        map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) })
      }
    })

    // 样式未就绪阶段的 error 基本都是样式/字体请求失败（内网、弱网），
    // 置位降级标记供首屏提示并上报监控；就绪后的瓦片偶发错误交给 maplibre 自身日志
    map.on('error', (e) => {
      if (!mapReady.value) {
        loadError.value = true
        reportMonitorEvent({ type: 'style-load-error', detail: e.error?.message })
      }
    })

    // WebGL 上下文丢失：显卡驱动重置 / GPU 资源耗尽时大屏会黑屏，上报位供现场快速定位（M4.6）；
    // 生产构建 3s 后整页自愈重载，10 分钟窗口 >3 次自动停止防崩溃循环（M9.3）
    const canvas = map.getCanvas()
    const onContextLost = (e: Event) => {
      e.preventDefault()
      reportMonitorEvent({ type: 'webgl-context-lost' })
      scheduleContextLostReload()
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    detachContextLost = () => canvas.removeEventListener('webglcontextlost', onContextLost)

    // 地图就绪后开场推近（M8.3），推近结束再启动自转——
    // moveend 桥接避免自转 rAF setCenter 与 flyTo 补间打架
    map.on('load', () => {
      mapReady.value = map
      map.flyTo({ center: INITIAL_CENTER, zoom: INITIAL_ZOOM, duration: 2500, essential: true })
      map.once('moveend', () => startRotation())
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
    detachContextLost?.()
    detachContextLost = null
    resizeObserver?.disconnect()
    mapInstance.value?.remove()
    mapInstance.value = null
  })

  return {
    mapInstance,
    mapReady,
    styleVersion,
    autoRotate,
    loadError,
    setMode,
    setBasemap,
    setAutoRotate,
    zoomIn,
    zoomOut,
    resetNorth,
    resetView,
    flyToCamera,
  }
}
