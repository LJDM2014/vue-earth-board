/**
 * 大屏多主题（M8.2）：三套主题注册表 + reactive 令牌对象。
 * - CSS 侧：组件样式全部消费 :root 上的 --xb-* 变量（style.css 定义，data-theme 切换）；
 * - JS/deck 侧：读取 reactive 的 THEME / DECK_COLORS，setTheme 后图层 build 重新取色。
 * deck.gl 图层色使用 RGBA 数组（0-255）；CSS 令牌使用 hex / rgb 通道字符串。
 */
import { reactive, ref } from 'vue'
import type { MetricKey } from '../mock/cities'

export type ThemeId = 'deep-space' | 'violet-night' | 'aurora-teal'

/** RGBA 通道串（空格分隔），供 `rgb(var(--x)/a)` 语法使用 */
type RgbChannels = string
type Rgba4 = readonly [number, number, number, number]
type Rgb3 = readonly [number, number, number]

/** UI 令牌（CSS --xb-* 变量与 JS tooltip 共用同一套来源） */
export interface UiPalette {
  /** 深空底色 */
  bgDeep: string
  /** 面板底色通道（配合 /0.82 透明度） */
  panelChannels: RgbChannels
  /** 深空底色通道 */
  bgDeepChannels: RgbChannels
  /** 主高亮色通道 */
  cyanChannels: RgbChannels
  /** 金色通道 */
  goldChannels: RgbChannels
  /** 面板角标辉光通道 */
  panelCornerChannels: RgbChannels
  /** 面板/装饰描边（半透明，完整值，JS 侧用） */
  borderGlow: string
  /** 主高亮青色 */
  cyan: string
  /** 柔和高亮 */
  cyanSoft: string
  /** 主文字色 */
  text: string
  /** 次级文字色 */
  textDim: string
  /** 榜单第一强调金（语义色，三主题恒定） */
  gold: string
  /** 面板四角角标辉光色 */
  panelCorner: string
  /** 面板标题槽强调色 */
  titleAccent: string
}

/** deck.gl 图层色板（RGBA 只读元组，0-255，满足 deck 9.4 Color 类型约束） */
export interface DeckPalette {
  /** 城市散点填充 */
  cityFill: Rgba4
  /** 城市散点核心亮斑 */
  cityCore: Rgba4
  /** TOP1 城市金色 */
  topCityFill: Rgba4
  /** 飞线弧基础色（客运·半透明） */
  arcColor: Rgba4
  /** 飞线弧目标端色（客运，略亮） */
  arcTarget: Rgba4
  /** 飞线弧基础色（货运·金色半透明，M5.3 类别着色） */
  arcCargo: Rgba4
  /** 飞线弧目标端色（货运，略亮） */
  arcCargoTarget: Rgba4
  /** 货运彗星尾迹色 */
  cometCargoTail: Rgb3
  /** 彗星头部亮白 */
  cometHead: Rgba4
  regionFill: Rgba4
  regionLine: Rgba4
  regionHoverFill: Rgba4
  regionHoverLine: Rgba4
}

export interface ThemePalette {
  /** 主题显示名（切换器 title） */
  label: string
  ui: UiPalette
  deck: DeckPalette
}

/** 三主题注册表：gold 为语义色（货运/TOP1/降级警示）三主题恒定不变 */
export const THEMES: Record<ThemeId, ThemePalette> = {
  'deep-space': {
    label: '深空青',
    ui: {
      bgDeep: '#040b18',
      panelChannels: '7 19 38',
      bgDeepChannels: '4 11 24',
      cyanChannels: '0 229 255',
      goldChannels: '255 194 77',
      panelCornerChannels: '55 242 255',
      borderGlow: 'rgba(0, 229, 255, 0.22)',
      cyan: '#00e5ff',
      cyanSoft: '#7be8ff',
      text: '#d7f5ff',
      textDim: '#5f7d93',
      gold: '#ffc24d',
      panelCorner: '#37f2ff',
      titleAccent: '#00e5ff',
    },
    deck: {
      cityFill: [0, 229, 255, 200],
      cityCore: [228, 253, 255, 235],
      topCityFill: [255, 194, 77, 228],
      arcColor: [0, 229, 255, 110],
      arcTarget: [168, 242, 255, 150],
      arcCargo: [255, 196, 77, 110],
      arcCargoTarget: [255, 228, 170, 150],
      cometCargoTail: [255, 196, 77],
      cometHead: [210, 251, 255, 255],
      regionFill: [10, 32, 60, 36],
      regionLine: [0, 229, 255, 66],
      regionHoverFill: [0, 229, 255, 52],
      regionHoverLine: [0, 245, 255, 235],
    },
  },
  'violet-night': {
    label: '紫夜',
    ui: {
      bgDeep: '#0a0718',
      panelChannels: '16 10 36',
      bgDeepChannels: '10 7 24',
      cyanChannels: '180 124 255',
      goldChannels: '255 194 77',
      panelCornerChannels: '201 139 255',
      borderGlow: 'rgba(180, 124, 255, 0.25)',
      cyan: '#b47cff',
      cyanSoft: '#d3aaff',
      text: '#ecdfff',
      textDim: '#8a7ba8',
      gold: '#ffc24d',
      panelCorner: '#c98bff',
      titleAccent: '#b47cff',
    },
    deck: {
      cityFill: [180, 124, 255, 200],
      cityCore: [243, 231, 255, 235],
      topCityFill: [255, 194, 77, 228],
      arcColor: [180, 124, 255, 110],
      arcTarget: [224, 196, 255, 150],
      arcCargo: [255, 196, 77, 110],
      arcCargoTarget: [255, 228, 170, 150],
      cometCargoTail: [255, 196, 77],
      cometHead: [240, 230, 255, 255],
      regionFill: [26, 16, 56, 36],
      regionLine: [180, 124, 255, 66],
      regionHoverFill: [180, 124, 255, 52],
      regionHoverLine: [200, 148, 255, 235],
    },
  },
  'aurora-teal': {
    label: '极光青',
    ui: {
      bgDeep: '#03120f',
      panelChannels: '6 26 24',
      bgDeepChannels: '3 18 15',
      cyanChannels: '46 255 180',
      goldChannels: '255 194 77',
      panelCornerChannels: '92 255 208',
      borderGlow: 'rgba(46, 255, 180, 0.24)',
      cyan: '#2effb4',
      cyanSoft: '#8affd9',
      text: '#dcfff2',
      textDim: '#5f9384',
      gold: '#ffc24d',
      panelCorner: '#5cffd0',
      titleAccent: '#2effb4',
    },
    deck: {
      cityFill: [46, 255, 180, 200],
      cityCore: [224, 255, 242, 235],
      topCityFill: [255, 194, 77, 228],
      arcColor: [46, 255, 180, 110],
      arcTarget: [176, 255, 219, 150],
      arcCargo: [255, 196, 77, 110],
      arcCargoTarget: [255, 228, 170, 150],
      cometCargoTail: [255, 196, 77],
      cometHead: [222, 255, 241, 255],
      regionFill: [8, 42, 36, 36],
      regionLine: [46, 255, 180, 66],
      regionHoverFill: [46, 255, 180, 52],
      regionHoverLine: [90, 255, 205, 235],
    },
  },
}

/** 当前激活主题（UI 切换器消费） */
export const activeThemeId = ref<ThemeId>('deep-space')

/** CSS 侧令牌（reactive：setTheme 时整体覆盖；样式已全部走 --xb-* 变量，此处供 JS 场景读取） */
export const THEME = reactive<UiPalette>({ ...THEMES['deep-space'].ui })

/** deck.gl 图层色板（reactive：图层 build 在重绘时重新读取，M8.2） */
export const DECK_COLORS = reactive<DeckPalette>({ ...THEMES['deep-space'].deck })

/** 切换主题：覆盖令牌对象 + 置 html data-theme 驱动 CSS 变量切换 */
export function setTheme(id: ThemeId): void {
  const palette = THEMES[id]
  if (!palette) return
  activeThemeId.value = id
  Object.assign(THEME, palette.ui)
  Object.assign(DECK_COLORS, palette.deck)
  document.documentElement.dataset.theme = id
}

/** hex(#rrggbb) → rgba() 字符串（deck tooltip 内联样式用，随 reactive THEME 实时取值） */
export function hexToRgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 指标 → 界面强调色（M6.2/6.4：tooltip 指标色条、微缩行色点，全局恒定不随主题切换） */
export const METRIC_TINT: Record<MetricKey, string> = {
  heat: '#00e5ff',
  passenger: '#7bffd4',
  economy: '#ffc24d',
}

/** 热力图色带：深蓝 → 青 → 金 → 红（全局恒定） */
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
