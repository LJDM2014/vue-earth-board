import { describe, expect, it } from 'vitest'
import { DECK_COLORS } from '../../../config/theme'
import type { CityMetric } from '../../../mock/cities'
import type { FlowOD } from '../../../mock/flows'
import {
  ARC_HEIGHT,
  buildCometPoints,
  buildFlowPaths,
  createFlowArcLayer,
  type FlowPath,
} from '../flightArcs'

/** 北京/上海近似坐标（真实经纬度，验证 turf 球面计算） */
const BEIJING: CityMetric = {
  name: '北京',
  province: '北京市',
  value: 100,
  lnglat: [116.4, 39.9],
  indicators: { heat: 100, passenger: 400, economy: 300 },
}
const SHANGHAI: CityMetric = {
  name: '上海',
  province: '上海市',
  value: 90,
  lnglat: [121.47, 31.23],
  indicators: { heat: 90, passenger: 380, economy: 320 },
}

function cityMap(): Map<string, CityMetric> {
  return new Map([
    ['北京', BEIJING],
    ['上海', SHANGHAI],
  ])
}

describe('ARC_HEIGHT 弧高系数', () => {
  it('与 deck 弧线高度公式及轨迹层共用一致', () => {
    expect(ARC_HEIGHT).toBe(0.55)
  })
})

describe('buildFlowPaths 大圆路径构建', () => {
  it('首尾采样点与 OD 起讫一致，距离为球面米', () => {
    const flows: FlowOD[] = [{ from: '北京', to: '上海', volume: 100, category: 'passenger' }]
    const paths = buildFlowPaths(flows, cityMap())
    expect(paths).toHaveLength(1)
    const [p] = paths
    expect(p.points[0][0]).toBeCloseTo(116.4, 6)
    expect(p.points[0][1]).toBeCloseTo(39.9, 6)
    const last = p.points[p.points.length - 1]
    expect(last[0]).toBeCloseTo(121.47, 6)
    expect(last[1]).toBeCloseTo(31.23, 6)
    // 北京—上海大圆距离约 1067km
    expect(p.meters).toBeGreaterThan(1_000_000)
    expect(p.meters).toBeLessThan(1_100_000)
  })

  it('采样点数量与 PATH_SAMPLES 对齐（96 采样 + 终点）', () => {
    const flows: FlowOD[] = [{ from: '北京', to: '上海', volume: 100, category: 'passenger' }]
    const [p] = buildFlowPaths(flows, cityMap())
    expect(p.points.length).toBeGreaterThanOrEqual(96)
    expect(p.points.length).toBeLessThanOrEqual(97)
  })

  it('缺起讫城市的 OD 被跳过（不抛错）', () => {
    const flows: FlowOD[] = [
      { from: '北京', to: '上海', volume: 100, category: 'passenger' },
      { from: '北京', to: '不存在的城市', volume: 50, category: 'cargo' },
      { from: '未知城市', to: '上海', volume: 50, category: 'cargo' },
    ]
    const paths = buildFlowPaths(flows, cityMap())
    expect(paths).toHaveLength(1)
    expect(paths[0].flow.volume).toBe(100)
  })

  it('空 OD 返回空数组', () => {
    expect(buildFlowPaths([], cityMap())).toEqual([])
  })
})

/** 合成路径（避开 turf，专注彗星几何逻辑） */
function syntheticPath(index: number, category: FlowOD['category'] = 'passenger'): FlowPath {
  const points: [number, number][] = []
  for (let j = 0; j < 11; j++) points.push([index * 10 + j, index * 5 + j])
  return { flow: { from: 'a', to: 'b', volume: index * 10, category }, points, meters: 1000 }
}

describe('buildCometPoints 彗星尾迹', () => {
  const paths = [syntheticPath(0), syntheticPath(1)]

  it('各飞线按序错峰：progress=0 时首条在起点、次条已过半程', () => {
    const pts = buildCometPoints(paths, 0)
    // 头点（每组第一个点）位置应与相位一致
    const head0 = pts[0]
    expect(head0.position[0]).toBeCloseTo(0, 6)
    expect(head0.position[1]).toBeCloseTo(0, 6)
    // 头点海拔 r≈0 → 0
    expect(head0.position[2]).toBeCloseTo(0, 6)
    // 次条相位 0.5 → r=smoothstep(0.5)=0.5 → 位于合成路径 (x=10+j) 的中点 x=15
    const head1 = pts.find((p) => p.position[0] > 14.9 && p.position[0] < 15.1)
    expect(head1).toBeTruthy()
    expect(head1!.position[1]).toBeCloseTo(10, 6)
  })

  it('中点海拔与弧线着色器公式一致 z = sqrt(r(1-r))·d·H·0.5', () => {
    const pts = buildCometPoints([paths[0]], 0.5)
    const head = pts[0]
    // phase = (0.5 - 0/1) % 1 = 0.5 → r = smoothstep(0.5) = 0.5
    expect(head.position[2]).toBeCloseTo(Math.sqrt(0.25) * 1000 * ARC_HEIGHT * 0.5, 6)
  })

  it('尾迹渐隐：头部不透明、尾部 alpha 严格递减', () => {
    const pts = buildCometPoints([paths[0]], 0.5)
    expect(pts[0].color[3]).toBe(255)
    for (let j = 1; j < pts.length; j++) {
      expect(pts[j].color[3]).toBeLessThan(pts[j - 1].color[3])
    }
  })

  it('尾迹未出发时段不产生点位（相位回卷从原点生长）', () => {
    // 单条飞线 progress=0 → 仅 j=0 的 t=0 点位存在
    const pts = buildCometPoints([paths[0]], 0)
    expect(pts).toHaveLength(1)
  })

  it('空路径返回空数组', () => {
    expect(buildCometPoints([], 0.5)).toEqual([])
  })
})

describe('createFlowArcLayer 静态弧层', () => {
  it('实例 id 与透明度系数符合约定', () => {
    const layer = createFlowArcLayer([syntheticPath(0)], [0, 100], 0.5)
    expect(layer.id).toBe('flow-arcs')
    expect(layer.props.opacity).toBeCloseTo(0.45, 10)
    expect(layer.props.greatCircle).toBe(true)
  })
})

/** 直调 accessor（accessor 上下文参数在本测试中无关，可省略） */
function sourceColorOf(layer: ReturnType<typeof createFlowArcLayer>, path: FlowPath): number[] {
  const acc = layer.props.getSourceColor as unknown as (d: FlowPath) => number[]
  return acc(path)
}

describe('弧线联动高亮（M6.3）', () => {
  // 第二条改 key 为 c→d，避免与第一条 a→b 同键命中
  const paths = [
    syntheticPath(0),
    { ...syntheticPath(1, 'cargo'), flow: { from: 'c', to: 'd', volume: 20, category: 'cargo' as const } },
  ]

  it('无高亮时保持类别原色', () => {
    const layer = createFlowArcLayer(paths, [50, 90], 1, null)
    expect(sourceColorOf(layer, paths[0])).toEqual([0, 229, 255, 110])
    expect(sourceColorOf(layer, paths[1])).toEqual([255, 196, 77, 110])
  })

  it('命中航线提亮加粗，未命中压暗', () => {
    const layer = createFlowArcLayer(paths, [50, 90], 1, 'a→b·passenger')
    // 客运高亮随主题主色（M8.2）：取 DECK_COLORS.regionHoverLine
    expect(sourceColorOf(layer, paths[0])).toEqual([...DECK_COLORS.regionHoverLine])
    // 未命中：压暗为 DIM_ALPHA
    expect(sourceColorOf(layer, paths[1])).toEqual([255, 196, 77, 36])
    const width = layer.props.getWidth as (d: FlowPath) => number
    expect(width(paths[0])).toBe(2.3) // 命中：<P50 细线 1.2 + 1.1
    expect(width(paths[1])).toBe(1.2)
  })

  it('彗星尾迹：命中保持亮度，未命中压暗至 30%', () => {
    const lit = buildCometPoints([paths[0]], 0.5, 'a→b·passenger')
    expect(lit[0].color[3]).toBe(255)
    const dim = buildCometPoints([paths[0]], 0.5, '其他→航线')
    expect(dim[0].color[3]).toBe(Math.round(255 * 0.3))
  })
})
