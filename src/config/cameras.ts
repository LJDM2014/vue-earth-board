/**
 * 预设机位配置（M3.2 区域快捷导航）：
 * 每个机位是一组相机参数，点击后经 map.flyTo 平滑过渡；
 * 同时供大屏轮播模式（M3.6）定时巡航使用。
 */
export interface CameraPreset {
  /** 唯一标识 */
  id: string
  /** 界面显示名 */
  label: string
  /** 相机中心 [经度, 纬度] */
  center: [number, number]
  /** 缩放层级 */
  zoom: number
}

/** 预设机位列表（首项「全国」与 useMapLibre 初始视角一致） */
export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'nation', label: '全国', center: [105.5, 36], zoom: 2.2 },
  { id: 'east', label: '华东', center: [119.8, 31.2], zoom: 4.1 },
  { id: 'south', label: '华南', center: [113.2, 22.9], zoom: 4.4 },
  { id: 'chengyu', label: '成渝', center: [105.2, 30.2], zoom: 4.5 },
  { id: 'west', label: '西部', center: [93.5, 33.5], zoom: 3.0 },
  { id: 'northeast', label: '东北', center: [124.5, 44.5], zoom: 3.3 },
]

/** 轮播模式单机位停留时长（毫秒） */
export const TOUR_STEP_MS = 12000

/** 轮播模式每隔几个机位推进一期数据切片 */
export const TOUR_PERIOD_EVERY = 2
