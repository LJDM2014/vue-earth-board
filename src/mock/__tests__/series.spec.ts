import { describe, expect, it } from 'vitest'
import { MOCK_CITIES } from '../cities'
import { cityMetricValue, flowVolumeValue } from '../series'

/** 2025 年中间月（无尖峰干扰的季节基准期） */
const MID = '2025-06'

describe('cityMetricValue 时序生成（M5.4）', () => {
  it('同 seed 可复现：同参数两次取值完全一致', () => {
    const a = cityMetricValue(MID, '上海', 'heat')
    const b = cityMetricValue(MID, '上海', 'heat')
    expect(a).toBe(b)
    expect(a).toBeGreaterThan(0)
  })

  it('未知城市返回 0（不抛错）', () => {
    expect(cityMetricValue(MID, '不存在', 'heat')).toBe(0)
  })

  it('Zipf 衰减：头部城市显著高于尾部城市', () => {
    const top = cityMetricValue(MID, '上海', 'heat')
    const tail = cityMetricValue(MID, '拉萨', 'heat')
    expect(top).toBeGreaterThan(tail * 5)
  })

  it('春运尖峰：1 月各城热度之和显著高于 4 月（噪声在聚合层面抵消）', () => {
    const sum = (p: string) => MOCK_CITIES.reduce((s, c) => s + cityMetricValue(p, c.name, 'heat'), 0)
    expect(sum('2025-01')).toBeGreaterThan(sum('2025-04') * 1.2)
  })

  it('年度趋势：12 月各城热度之和高于 3 月（季节相近、趋势抬升）', () => {
    const sum = (p: string) => MOCK_CITIES.reduce((s, c) => s + cityMetricValue(p, c.name, 'heat'), 0)
    expect(sum('2025-12')).toBeGreaterThan(sum('2025-03'))
  })

  it('指标量纲隔离：客流与经济是相互独立的两套序列', () => {
    const passenger = cityMetricValue(MID, '北京', 'passenger')
    const economy = cityMetricValue(MID, '北京', 'economy')
    expect(passenger).toBeGreaterThan(0)
    expect(economy).toBeGreaterThan(0)
    expect(passenger).not.toBe(economy)
  })

  it('数值非整齐数（Zipf × 抖动产出非整十整百）', () => {
    const nonRound = MOCK_CITIES.filter((c) => cityMetricValue(MID, c.name, 'heat') % 10 !== 0)
    expect(nonRound.length).toBeGreaterThan(MOCK_CITIES.length * 0.8)
  })
})

describe('flowVolumeValue OD 运量（M5.3/5.4）', () => {
  const flow = { from: '北京', to: '上海', volume: 900, category: 'passenger' as const }

  it('同 seed 可复现', () => {
    expect(flowVolumeValue(MID, flow)).toBe(flowVolumeValue(MID, flow))
  })

  it('当期运量为正且围绕基数波动（趋势 × 季节 × 噪声）', () => {
    const v = flowVolumeValue(MID, flow)
    expect(v).toBeGreaterThan(flow.volume * 0.7)
    expect(v).toBeLessThan(flow.volume * 1.5)
  })
})
