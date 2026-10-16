/** 指标极值区间（空数据时返回安全区间），供半径/高度/颜色归一化共用 */
export function valueRange(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1]
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const v of values) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  return [min, max]
}

/** 指标归一化到 [0,1]（区间宽度为 0 时返回 0.5 中位） */
export function normalize(value: number, range: [number, number]): number {
  const span = Math.max(range[1] - range[0], Number.EPSILON)
  return (value - range[0]) / span
}
