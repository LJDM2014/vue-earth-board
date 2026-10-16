import { describe, expect, it } from 'vitest'
import { normalize, valueRange } from '../metricScale'

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
