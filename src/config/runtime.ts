import { ref } from 'vue'
import { z } from 'zod'
import { CAMERA_PRESETS, TOUR_PERIOD_EVERY, TOUR_STEP_MS } from './cameras'
import { setTheme, type ThemeId } from './theme'
import type { MetricKey } from '../mock/cities'
import { reportMonitorEvent } from '../services/monitor'

/**
 * 大屏运行配置（M9.4）：部署方改配置不改代码即可调整文案与运营节奏。
 * 来源优先级：`VITE_BOARD_CONFIG`（构建期内联 JSON）> `/board.config.json`（运行时 fetch）> 缺省。
 * 校验失败整体回退缺省并上报一次 `data-source-error/runtime-config`，缺省零行为变化。
 */
export interface BoardConfig {
  /** 标题栏文案（同步 document.title） */
  title: string
  /** 数据源模式 */
  dataSource: 'mock' | 'http'
  /** 轮询强刷间隔（毫秒），0 = 关闭轮询 */
  refreshIntervalMs: number
  /** 默认主题 */
  theme: ThemeId
  /** 默认激活指标 */
  defaultMetric: MetricKey
  /** 轮播单机位停留时长（毫秒） */
  tourStepMs: number
  /** 轮播每隔几个机位推进一期数据 */
  tourPeriodEvery: number
  /** 初始高亮的预设机位 id */
  defaultCameraId: string
}

/** 缺省配置：全部对齐既有常量（改前行为基线） */
export const BOARD_CONFIG_DEFAULTS: BoardConfig = {
  title: '寰宇 · 数字地球可视化大屏',
  dataSource: 'mock',
  refreshIntervalMs: 0,
  theme: 'deep-space',
  defaultMetric: 'heat',
  tourStepMs: TOUR_STEP_MS,
  tourPeriodEvery: TOUR_PERIOD_EVERY,
  defaultCameraId: CAMERA_PRESETS[0].id,
}

const runtimeSchema = z.object({
  title: z.string().min(1).default(BOARD_CONFIG_DEFAULTS.title),
  dataSource: z.enum(['mock', 'http']).default(BOARD_CONFIG_DEFAULTS.dataSource),
  refreshIntervalMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).default(BOARD_CONFIG_DEFAULTS.refreshIntervalMs),
  theme: z.enum(['deep-space', 'violet-night', 'aurora-teal']).default(BOARD_CONFIG_DEFAULTS.theme),
  defaultMetric: z.enum(['heat', 'passenger', 'economy']).default(BOARD_CONFIG_DEFAULTS.defaultMetric),
  tourStepMs: z.number().int().min(3000).default(BOARD_CONFIG_DEFAULTS.tourStepMs),
  tourPeriodEvery: z.number().int().min(1).max(20).default(BOARD_CONFIG_DEFAULTS.tourPeriodEvery),
  defaultCameraId: z.string().default(BOARD_CONFIG_DEFAULTS.defaultCameraId),
})

/** 全局响应式运行配置：应用启动时以缺省值初始化，initBoardConfig 加载后合并覆盖 */
export const boardConfig = ref<BoardConfig>({ ...BOARD_CONFIG_DEFAULTS })

/**
 * 解析并校验原始配置：未知字段忽略、已知字段缺省合并；
 * schema 校验失败返回 null（调用方回退缺省并上报）。
 * defaultCameraId 未命中预设机位时静默修正为「全国」。
 */
export function parseBoardConfig(raw: unknown): BoardConfig | null {
  const parsed = runtimeSchema.safeParse(raw)
  if (!parsed.success) return null
  const data = parsed.data
  if (!CAMERA_PRESETS.some((p) => p.id === data.defaultCameraId)) {
    data.defaultCameraId = BOARD_CONFIG_DEFAULTS.defaultCameraId
  }
  return data
}

function reportRuntimeConfigError(detail: string) {
  reportMonitorEvent({ type: 'data-source-error', source: 'runtime-config', detail })
}

/** 应用解析后的配置：更新响应式配置 + 标题 + 主题（SSR/测试环境无 DOM 时跳过） */
function applyBoardConfig(cfg: BoardConfig) {
  boardConfig.value = cfg
  if (typeof document !== 'undefined') {
    document.title = cfg.title
    setTheme(cfg.theme)
  }
}

/**
 * 启动时加载运行配置：先读内联 env，缺省时尝试 fetch /board.config.json
 * （404/网络异常静默——未部署配置文件属常态）；非法配置整体回退缺省并上报。
 */
export async function initBoardConfig(
  env: { VITE_BOARD_CONFIG?: string } = import.meta.env,
): Promise<BoardConfig> {
  let raw: unknown
  const inline = env.VITE_BOARD_CONFIG
  if (inline) {
    try {
      raw = JSON.parse(inline)
    } catch {
      reportRuntimeConfigError('VITE_BOARD_CONFIG 不是合法 JSON，已回退缺省配置')
    }
  } else if (typeof fetch === 'function') {
    try {
      const res = await fetch('/board.config.json', { cache: 'no-store' })
      if (res.ok) raw = await res.json()
    } catch {
      // 静默：配置文件不存在 / 内网不可达，维持缺省
    }
  }
  if (raw === undefined) return boardConfig.value
  const parsed = parseBoardConfig(raw)
  if (!parsed) {
    reportRuntimeConfigError('运行配置校验失败，已整体回退缺省配置')
    return boardConfig.value
  }
  applyBoardConfig(parsed)
  return boardConfig.value
}
