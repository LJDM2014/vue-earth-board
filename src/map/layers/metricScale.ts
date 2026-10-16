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

/** 线性分位数（values 需非空；内部排序，q ∈ [0,1]） */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = Math.min(Math.max(q, 0), 1) * (sorted.length - 1)
  const i0 = Math.floor(pos)
  const frac = pos - i0
  const a = sorted[i0]
  const b = sorted[Math.min(i0 + 1, sorted.length - 1)]
  return a + (b - a) * frac
}

/** 运量分位档 [P50, P90] */
export type FlowWidthTiers = [number, number]

/** 由运量全集计算宽度分位档（M5.3：分位映射替代 max 归一，避免头部垄断视觉） */
export function flowWidthTiers(volumes: number[]): FlowWidthTiers {
  return [quantile(volumes, 0.5), quantile(volumes, 0.9)]
}

/** 弧线宽度三档（px）：中位以下细线、中位到 P90 中等、P90 以上粗线 */
export function flowWidth(volume: number, tiers: FlowWidthTiers): number {
  const [t50, t90] = tiers
  if (volume < t50) return 1.2
  if (volume < t90) return 2.3
  return 3.4
}
