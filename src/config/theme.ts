/**
 * 大屏主题：深色科技风色板
 * CSS 侧使用 hex/rgba 字符串；deck.gl 图层侧使用 RGBA 数组（0-255）。
 */
export const THEME = {
  /** 深空底色 */
  bgDeep: '#040b18',
  /** 面板底色（半透明） */
  bgPanel: 'rgba(7, 19, 38, 0.82)',
  /** 面板/装饰描边 */
  borderGlow: 'rgba(0, 229, 255, 0.22)',
  /** 主高亮青色 */
  cyan: '#00e5ff',
  /** 柔和青色 */
  cyanSoft: '#7be8ff',
  /** 主文字色 */
  text: '#d7f5ff',
  /** 次级文字色 */
  textDim: '#5f7d93',
  /** 榜单第一强调金 */
  gold: '#ffc24d',
} as const

/** deck.gl 图层色板（RGBA 只读元组，0-255，满足 deck 9.4 Color 类型约束） */
export const DECK_COLORS = {
  /** 城市散点填充 */
  cityFill: [0, 229, 255, 200] as const,
  /** 城市散点核心亮斑 */
  cityCore: [228, 253, 255, 235] as const,
  /** TOP1 城市金色 */
  topCityFill: [255, 194, 77, 228] as const,
  /** 飞线弧基础色（青色半透明） */
  arcColor: [0, 229, 255, 110] as const,
  /** 彗星头部亮白 */
  cometHead: [210, 251, 255, 255] as const,
  regionFill: [10, 32, 60, 36] as const,
  regionLine: [0, 229, 255, 66] as const,
  regionHoverFill: [0, 229, 255, 52] as const,
  regionHoverLine: [0, 245, 255, 235] as const,
}

/** 热力图色带：深蓝 → 青 → 金 → 红 */
export const HEATMAP_COLOR_RANGE: [number, number, number, number][] = [
  [8, 29, 63, 0],
  [23, 106, 153, 128],
  [0, 178, 216, 176],
  [122, 255, 205, 210],
  [222, 255, 130, 235],
  [255, 196, 77, 245],
  [255, 96, 52, 255],
]

/** 指标色带控制点（RGB）：与热力色带同族的青→金→红渐变 */
const METRIC_RAMP: [number, number, number][] = [
  [8, 86, 130],
  [0, 178, 216],
  [122, 255, 205],
  [255, 196, 77],
  [255, 96, 52],
]

/** 按归一化指标 t∈[0,1] 取色带插值色（RGBA） */
export function metricRamp(t: number, alpha = 255): [number, number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (METRIC_RAMP.length - 1)
  const i = Math.min(Math.floor(x), METRIC_RAMP.length - 2)
  const f = x - i
  const a = METRIC_RAMP[i]
  const b = METRIC_RAMP[i + 1]
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    alpha,
  ]
}
