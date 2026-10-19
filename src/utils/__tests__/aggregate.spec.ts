import { describe, expect, it } from 'vitest'
import type { CityMetric } from '../../mock/cities'
import { aggregateProvinces, metricTotal, PROVINCE_TOP_N } from '../aggregate'

/** 组造测试城市：province 按序循环分配，heat 值递增保证可排序 */
function makeCities(values: number[], provinces: string[]): CityMetric[] {
  return values.map((heat, i) => ({
    name: `城-${i}`,
    province: provinces[i % provinces.length],
    lnglat: [100 + i, 30] as [number, number],
    value: heat,
    indicators: { heat, passenger: heat * 2, economy: heat * 3 },
  }))
}

describe('aggregate 纯聚合（大屏 KPI/玫瑰图）', () => {
  it('metricTotal：按指定指标求和', () => {
    const cities = makeCities([1, 2, 3], ['广东省'])
    expect(metricTotal(cities, 'heat')).toBe(6)
    expect(metricTotal(cities, 'passenger')).toBe(12)
    expect(metricTotal(cities, 'economy')).toBe(18)
  })

  it('metricTotal：空数组为 0', () => {
    expect(metricTotal([], 'heat')).toBe(0)
  })

  it('aggregateProvinces：同省求和并降序', () => {
    const rows = aggregateProvinces(
      makeCities([5, 1, 4, 3], ['江苏省', '江苏省', '广东省', '广东省']),
      'heat',
    )
    expect(rows).toEqual([
      { name: '广东省', value: 7, count: 2 },
      { name: '江苏省', value: 6, count: 2 },
    ])
  })

  it('aggregateProvinces：省份数 ≤ 上限时全量返回', () => {
    const provinces = Array.from({ length: PROVINCE_TOP_N }, (_, i) => `省${i}`)
    const rows = aggregateProvinces(makeCities([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], provinces), 'heat')
    expect(rows).toHaveLength(PROVINCE_TOP_N)
    expect(rows[0].name).toBe('省9')
  })

  it('aggregateProvinces：超出上限时截取 TOP N 丢弃尾部', () => {
    const provinces = Array.from({ length: PROVINCE_TOP_N + 3 }, (_, i) => `省${i}`)
    const values = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    const rows = aggregateProvinces(makeCities(values, provinces), 'heat')
    expect(rows).toHaveLength(PROVINCE_TOP_N)
    expect(rows.some((r) => r.name === '省10')).toBe(false)
    expect(rows[0]).toEqual({ name: '省0', value: 13, count: 1 })
    expect(rows.at(-1)).toEqual({ name: '省9', value: 4, count: 1 })
  })

  it('aggregateProvinces：空数组为空', () => {
    expect(aggregateProvinces([], 'heat')).toEqual([])
  })
})
