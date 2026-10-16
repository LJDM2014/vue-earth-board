import { describe, expect, it } from 'vitest'
import { adaptCityMetrics, adaptFlows, adaptHistory, adaptPeriods } from '../dto'
import { onMonitorEvent, type MonitorEvent } from '../monitor'

/** 采集契约上报事件（用后释放，避免污染其他用例） */
function captureEvents(): { events: MonitorEvent[]; off: () => void } {
  const events: MonitorEvent[] = []
  const off = onMonitorEvent((e) => events.push(e))
  return { events, off }
}

describe('adaptCityMetrics 城市契约适配（M7.1）', () => {
  it('完整样本：字段直出，value 快照 = heat', () => {
    const out = adaptCityMetrics([
      {
        name: '上海',
        province: '上海',
        lnglat: [121.47, 31.23],
        indicators: { heat: 88, passenger: 50, economy: 40 },
      },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({
      name: '上海',
      province: '上海',
      lnglat: [121.47, 31.23],
      value: 88,
      indicators: { heat: 88, passenger: 50, economy: 40 },
    })
  })

  it('缺省补齐：province 缺省空串、指标缺省补 0，不判脏', () => {
    const out = adaptCityMetrics([{ name: '杭州', lnglat: [120.15, 30.28], indicators: { heat: 70 } }])
    expect(out).toHaveLength(1)
    expect(out[0].province).toBe('')
    expect(out[0].indicators).toEqual({ heat: 70, passenger: 0, economy: 0 })
  })

  it('脏数据逐条跳过并上报 contract/cities，好数据不受影响', () => {
    const { events, off } = captureEvents()
    try {
      const out = adaptCityMetrics([
        { name: '', lnglat: [0, 0], indicators: {} }, // name 空 → 脏
        { name: '北京', province: '北京', lnglat: [116.4, 39.9], indicators: { heat: 90, passenger: 60, economy: 45 } },
        { lnglat: [100, 20] }, // 缺 name → 脏
      ])
      expect(out).toHaveLength(1)
      expect(out[0].name).toBe('北京')
      const contractEvents = events.filter(
        (e) => e.type === 'data-source-error' && e.source === 'contract/cities',
      )
      expect(contractEvents).toHaveLength(2)
      expect(contractEvents[0].detail).toContain('cities[0]')
      expect(contractEvents[1].detail).toContain('cities[2]')
    } finally {
      off()
    }
  })

  it('响应非数组：整体判脏返回空数组并上报', () => {
    const { events, off } = captureEvents()
    try {
      expect(adaptCityMetrics({ foo: 1 })).toEqual([])
      expect(events.some((e) => e.type === 'data-source-error' && e.source === 'contract/cities')).toBe(true)
    } finally {
      off()
    }
  })
})

describe('adaptFlows 航线契约适配', () => {
  it('category 非法回落客运、volume 缺省补 0', () => {
    const out = adaptFlows([{ from: '北京', to: '上海', volume: 12.5, category: 'cargo' }, { from: 'A', to: 'B' }])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ from: '北京', to: '上海', volume: 12.5, category: 'cargo' })
    expect(out[1]).toEqual({ from: 'A', to: 'B', volume: 0, category: 'passenger' })
  })

  it('from/to 缺失判脏跳过并上报 contract/flows', () => {
    const { events, off } = captureEvents()
    try {
      const out = adaptFlows([{ from: '', to: 'C', volume: 1, category: 'passenger' }])
      expect(out).toEqual([])
      expect(events.some((e) => e.type === 'data-source-error' && e.source === 'contract/flows')).toBe(true)
    } finally {
      off()
    }
  })
})

describe('adaptPeriods / adaptHistory 基础适配', () => {
  it('periods：过滤非字符串与空串，去重升序', () => {
    expect(adaptPeriods(['2025-03', '2025-01', '', 42, '2025-01'])).toEqual(['2025-01', '2025-03'])
  })

  it('history：仅保留有限数字', () => {
    expect(adaptHistory([1, 'x', Number.NaN, 3, Number.POSITIVE_INFINITY])).toEqual([1, 3])
  })
})
