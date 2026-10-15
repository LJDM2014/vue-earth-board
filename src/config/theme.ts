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
