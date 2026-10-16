import { describe, expect, it } from 'vitest'
import { flowWidth, flowWidthTiers, normalize, quantile, valueRange } from '../metricScale'

describe('valueRange 指标极值区间', () => {
  it('空数据返回安全区间 [0,1]', () => {
    expect(valueRange([])).toEqual([0, 1])
  })

  it('正常数据返回 [min, max]', () => {
    expect(valueRange([3, 7, 1, 9])).toEqual([1, 9])
  })

  it('单值区间 min === max', () => {
    expect(valueRange([5])).toEqual([5, 5])
  })

  it('负值正确处理', () => {
    expect(valueRange([-2, -8, -5])).toEqual([-8, -2])
  })
})

describe('normalize 指标归一化', () => {
  it('映射到 [0,1] 区间', () => {
    expect(normalize(1, [1, 9])).toBe(0)
    expect(normalize(9, [1, 9])).toBe(1)
    expect(normalize(5, [1, 9])).toBe(0.5)
  })

  it('区间宽度为 0 时返回中位值偏移（span 被 EPSILON 兜底）', () => {
    // span 兜底为 EPSILON 后，(value-min)/EPSILON 在 value===min 时为 0
    expect(normalize(5, [5, 5])).toBe(0)
  })

  it('超出区间的值允许溢出（调用方自行 clamp）', () => {
    expect(normalize(11, [1, 9])).toBeCloseTo(1.25, 10)
  })
})

describe('quantile 线性分位数', () => {
  it('1..10 的 P50 = 5.5，P0 = 1，P100 = 10', () => {
    const v = [10, 1, 5, 3, 7, 9, 2, 8, 4, 6]
    expect(quantile(v, 0.5)).toBeCloseTo(5.5, 10)
    expect(quantile(v, 0)).toBe(1)
    expect(quantile(v, 1)).toBe(10)
  })

  it('空数组返回 0', () => {
    expect(quantile([], 0.5)).toBe(0)
  })
})

describe('flowWidth 运量分位宽度（M5.3）', () => {
  const tiers = flowWidthTiers([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])

  it('分位档计算正确', () => {
    expect(tiers).toEqual([55, 91])
  })

  it('三档映射：<P50 细线、P50~P90 中档、≥P90 粗线', () => {
    expect(flowWidth(30, tiers)).toBe(1.2)
    expect(flowWidth(70, tiers)).toBe(2.3)
    expect(flowWidth(95, tiers)).toBe(3.4)
  })
})
