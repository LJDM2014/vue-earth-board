import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onMonitorEvent, type MonitorEvent } from '../../services/monitor'
import { activeThemeId, setTheme } from '../theme'
import { BOARD_CONFIG_DEFAULTS, boardConfig, initBoardConfig, parseBoardConfig } from '../runtime'

beforeEach(() => {
  // 每例恢复缺省配置与默认主题，避免用例间串扰
  boardConfig.value = { ...BOARD_CONFIG_DEFAULTS }
  setTheme('deep-space')
  document.title = BOARD_CONFIG_DEFAULTS.title
})

describe('parseBoardConfig 配置解析（M9.4）', () => {
  it('空对象输入全部回退缺省（缺省零行为变化）', () => {
    expect(parseBoardConfig({})).toEqual(BOARD_CONFIG_DEFAULTS)
    expect(parseBoardConfig(undefined)).toBeNull()
  })

  it('部分字段合并：仅覆盖给定义，其余保持缺省', () => {
    const cfg = parseBoardConfig({ title: '定制标题', tourStepMs: 8000 })
    expect(cfg).toEqual({ ...BOARD_CONFIG_DEFAULTS, title: '定制标题', tourStepMs: 8000 })
  })

  it('非法字段整体回退 null（调用方上报事件）', () => {
    expect(parseBoardConfig({ tourStepMs: 100 })).toBeNull()
    expect(parseBoardConfig({ theme: 'rainbow' })).toBeNull()
    expect(parseBoardConfig('not-an-object')).toBeNull()
  })

  it('未知字段忽略；defaultCameraId 未命中预设时静默修正为全国', () => {
    const cfg = parseBoardConfig({ hacker: true, defaultCameraId: 'nope' })
    expect(cfg).toEqual({ ...BOARD_CONFIG_DEFAULTS, defaultCameraId: 'nation' })
    expect('hacker' in (cfg as object)).toBe(false)
  })
})

describe('initBoardConfig 加载链（M9.4）', () => {
  let events: MonitorEvent[]
  let off: () => void

  beforeEach(() => {
    events = []
    off = onMonitorEvent((e) => events.push(e))
  })

  afterEach(() => {
    off()
    vi.unstubAllGlobals()
  })

  it('无内联配置且 fetch 404 → 缺省零变化、零事件', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))))
    const cfg = await initBoardConfig({})
    expect(cfg).toEqual(BOARD_CONFIG_DEFAULTS)
    expect(events).toHaveLength(0)
  })

  it('内联 JSON 合并：标题/主题/轮播节奏生效（document.title + setTheme 联动）', async () => {
    const cfg = await initBoardConfig({
      VITE_BOARD_CONFIG: JSON.stringify({ title: '定制标题', theme: 'aurora-teal', tourStepMs: 8000 }),
    })
    expect(cfg.title).toBe('定制标题')
    expect(activeThemeId.value).toBe('aurora-teal')
    expect(document.title).toBe('定制标题')
    expect(boardConfig.value.tourStepMs).toBe(8000)
  })

  it('内联非法 JSON → 回退缺省 + 上报 runtime-config 事件', async () => {
    const cfg = await initBoardConfig({ VITE_BOARD_CONFIG: '{broken' })
    expect(cfg).toEqual(BOARD_CONFIG_DEFAULTS)
    expect(events.some((e) => e.type === 'data-source-error' && e.source === 'runtime-config')).toBe(true)
  })

  it('内联合法 JSON 但 schema 失败 → 回退缺省 + 上报一次事件', async () => {
    const cfg = await initBoardConfig({ VITE_BOARD_CONFIG: '{"tourPeriodEvery": 99}' })
    expect(cfg).toEqual(BOARD_CONFIG_DEFAULTS)
    expect(
      events.filter((e) => e.type === 'data-source-error' && e.source === 'runtime-config'),
    ).toHaveLength(1)
  })

  it('无内联时运行时 fetch /board.config.json 合并', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ title: '运行时配置' }), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    const cfg = await initBoardConfig({})
    expect(fetchMock).toHaveBeenCalledWith('/board.config.json', { cache: 'no-store' })
    expect(cfg.title).toBe('运行时配置')
  })

  it('fetch 网络异常静默维持缺省', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    const cfg = await initBoardConfig({})
    expect(cfg).toEqual(BOARD_CONFIG_DEFAULTS)
    expect(events).toHaveLength(0)
  })
})
