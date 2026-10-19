/**
 * 管理端聚合纯函数单测（A8，docs/admin-module-plan.md §5.2 图表数据源）：
 * 趋势求和 / TOP N 排序截断 / 航线标签与类别透传 / 客货占比 / 省份覆盖计数（缺期 0 兜底）。
 */
import { describe, expect, it } from 'vitest'
import { categoryShare, metricSeries, provinceCoverage, topCities, topFlows } from '../useAdminData'
import type { CityRecord, FlowRecord } from '../../types'

const city = (name: string, province: string, metrics: CityRecord['metrics']): CityRecord => ({
  name,
  province,
  lnglat: [0, 0],
  rank: 0,
  metrics,
})

const flow = (id: number, from: string, to: string, category: FlowRecord['category'], volumes: FlowRecord['volumes']): FlowRecord => ({
  id,
  from,
  to,
  category,
  volumes,
})

const PERIODS = ['2025-01', '2025-02', '2025-03']

describe('metricSeries 趋势求和', () => {
  it('各期跨城市求和，输出与 periods 对齐', () => {
    const cities = [
      city('甲', 'P1', { '2025-01': { heat: 1, passenger: 0, economy: 0 }, '2025-02': { heat: 2, passenger: 0, economy: 0 } }),
      city('乙', 'P1', { '2025-01': { heat: 10, passenger: 0, economy: 0 } }),
    ]
    expect(metricSeries(cities, PERIODS, 'heat')).toEqual([11, 2, 0])
  })

  it('缺期/缺指标按 0 兜底', () => {
    expect(metricSeries([city('甲', 'P1', {})], ['2025-09'], 'economy')).toEqual([0])
  })
})

describe('topCities 城市指标 TOP N', () => {
  const cities = [
    city('甲', 'P1', { '2025-01': { heat: 5, passenger: 0, economy: 0 } }),
    city('乙', 'P2', { '2025-01': { heat: 30, passenger: 0, economy: 0 } }),
    city('丙', 'P2', { '2025-01': { heat: 12, passenger: 0, economy: 0 } }),
    city('丁', 'P3', {}), // 缺期 → 0
  ]

  it('降序排列', () => {
    expect(topCities(cities, '2025-01', 'heat')).toEqual([
      { name: '乙', value: 30 },
      { name: '丙', value: 12 },
      { name: '甲', value: 5 },
      { name: '丁', value: 0 },
    ])
  })

  it('n 截断', () => {
    expect(topCities(cities, '2025-01', 'heat', 2)).toEqual([
      { name: '乙', value: 30 },
      { name: '丙', value: 12 },
    ])
  })
})

describe('topFlows 航线运量 TOP N', () => {
  const flows = [
    flow(1, '北京', '上海', 'passenger', { '2025-01': 900 }),
    flow(2, '广州', '深圳', 'cargo', { '2025-01': 500 }),
    flow(3, '成都', '重庆', 'cargo', {}),
  ]

  it('from → to 标签 + category 透传 + 降序', () => {
    expect(topFlows(flows, '2025-01', 2)).toEqual([
      { name: '北京 → 上海', value: 900, category: 'passenger' },
      { name: '广州 → 深圳', value: 500, category: 'cargo' },
    ])
  })

  it('缺期运量按 0 兜底（保持输入顺序）', () => {
    expect(topFlows(flows, '2099-01')).toEqual([
      { name: '北京 → 上海', value: 0, category: 'passenger' },
      { name: '广州 → 深圳', value: 0, category: 'cargo' },
      { name: '成都 → 重庆', value: 0, category: 'cargo' },
    ])
  })
})

describe('categoryShare 客货占比', () => {
  it('按类别分桶求和，缺期 0 兜底', () => {
    const flows = [
      flow(1, '北京', '上海', 'passenger', { '2025-01': 100 }),
      flow(2, '广州', '深圳', 'cargo', { '2025-01': 40 }),
      flow(3, '成都', '重庆', 'passenger', {}),
    ]
    expect(categoryShare(flows, '2025-01')).toEqual({ passenger: 100, cargo: 40 })
    expect(categoryShare(flows, '2099-01')).toEqual({ passenger: 0, cargo: 0 })
  })
})

describe('provinceCoverage 省份覆盖', () => {
  it('按省份计数并降序', () => {
    const cities = [
      city('甲', '浙江', {}),
      city('乙', '浙江', {}),
      city('丙', '浙江', {}),
      city('丁', '江苏', {}),
      city('戊', '广东', {}),
    ]
    expect(provinceCoverage(cities)).toEqual([
      { name: '浙江', value: 3 },
      { name: '江苏', value: 1 },
      { name: '广东', value: 1 },
    ])
  })
})
