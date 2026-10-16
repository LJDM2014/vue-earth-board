import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers'
import { distance } from '@turf/distance'
import { greatCircle } from '@turf/great-circle'
import { DECK_COLORS } from '../../config/theme'
import type { CityMetric } from '../../mock/cities'
import type { FlowCategory, FlowOD } from '../../mock/flows'
import { flowWidth, type FlowWidthTiers } from './metricScale'

/** 预计算后的飞线路径：大圆采样点 + 球面距离，供弧线与动画彗星共用 */
export interface FlowPath {
  flow: FlowOD
  /** 大圆路径采样点（等角距，含首尾） */
  points: [number, number][]
  /** 大圆距离（米），与 deck 弧线高度公式对齐 */
  meters: number
}

/** 大圆采样点数量 */
const PATH_SAMPLES = 96
/** 弧线高度系数：deck 弧顶高度 = 0.5 × 大圆距离 × getHeight（导出供轨迹层复用同一公式） */
export const ARC_HEIGHT = 0.55

/** 由 OD 数据构建大圆路径（turf 球面插值，与 deck 弧线轨迹一致） */
export function buildFlowPaths(flows: FlowOD[], cityMap: Map<string, CityMetric>): FlowPath[] {
  const paths: FlowPath[] = []
  for (const flow of flows) {
    const from = cityMap.get(flow.from)
    const to = cityMap.get(flow.to)
    if (!from || !to) continue
    const line = greatCircle(from.lnglat, to.lnglat, { npoints: PATH_SAMPLES })
    paths.push({
      flow,
      points: line.geometry.coordinates as [number, number][],
      meters: distance(from.lnglat, to.lnglat, { units: 'meters' }),
    })
  }
  return paths
}

/** deck Color 只读四元组 */
type Color4 = readonly [number, number, number, number]

/** OD 类别 → 弧线起/终色（M5.3：客运主题主色 / 货运金；随主题实时读取，M8.2） */
function arcColors(category: FlowCategory): { source: Color4; target: Color4 } {
  if (category === 'cargo') {
    return { source: DECK_COLORS.arcCargo, target: DECK_COLORS.arcCargoTarget }
  }
  return { source: DECK_COLORS.arcColor, target: DECK_COLORS.arcTarget }
}

/** hover 高亮态弧色（M6.3：命中行提亮；客运随主题主色、货运金恒定） */
function arcHighlight(category: FlowCategory): { source: Color4; target: Color4 } {
  if (category === 'cargo') {
    return { source: [255, 214, 130, 235], target: [255, 238, 190, 245] }
  }
  return { source: DECK_COLORS.regionHoverLine, target: DECK_COLORS.cometHead }
}

/** hover 高亮态下未命中弧线的压暗 alpha */
const DIM_ALPHA = 36

function dimColor(c: Color4): Color4 {
  return [c[0], c[1], c[2], DIM_ALPHA]
}

/** OD 类别 → 彗星尾迹色（客运随主题主色 / 货运金；头部统一亮白） */
function cometTail(category: FlowCategory): readonly [number, number, number] {
  if (category === 'cargo') return DECK_COLORS.cometCargoTail
  const c = DECK_COLORS.arcColor
  return [c[0], c[1], c[2]]
}

/** 航线唯一键（M6.3 面板联动协议：`起点→终点`） */
export function flowKey(flow: Pick<FlowOD, 'from' | 'to'>): string {
  return `${flow.from}→${flow.to}`
}

/** 创建静态飞线弧层：显式开启 greatCircle，保证 2D/3D 模式轨迹一致；
 * 宽度按运量分位三档映射（M5.3），避免头部航线垄断视觉；
 * highlight（M6.3）：面板 hover 航线时命中弧线提亮、其余压暗 */
export function createFlowArcLayer(
  paths: FlowPath[],
  tiers: FlowWidthTiers,
  opacity = 1,
  highlight: string | null = null,
): ArcLayer<FlowPath> {
  const pickColor = (
    d: FlowPath,
    normal: Color4,
    lit: Color4,
  ): Color4 => {
    if (!highlight) return normal
    return flowKey(d.flow) === highlight ? lit : dimColor(normal)
  }
  return new ArcLayer<FlowPath>({
    id: 'flow-arcs',
    data: paths,
    greatCircle: true,
    getSourcePosition: (d) => d.points[0],
    getTargetPosition: (d) => d.points[d.points.length - 1],
    getHeight: ARC_HEIGHT,
    getSourceColor: (d) => pickColor(d, arcColors(d.flow.category).source, arcHighlight(d.flow.category).source),
    getTargetColor: (d) => pickColor(d, arcColors(d.flow.category).target, arcHighlight(d.flow.category).target),
    getWidth: (d) => (highlight && flowKey(d.flow) === highlight
      ? flowWidth(d.flow.volume, tiers) + 1.1
      : flowWidth(d.flow.volume, tiers)),
    widthUnits: 'pixels',
    widthMinPixels: 1,
    pickable: false,
    opacity: 0.9 * opacity,
  })
}

/** 彗星尾迹单点：三维位置 + 半径 + 颜色（带透明度渐隐） */
export interface CometPoint {
  /** [经度, 纬度, 海拔(米)]，海拔与弧线着色器公式一致 */
  position: [number, number, number]
  radius: number
  color: [number, number, number, number]
}

/** 尾迹点数 */
const TRAIL_STEPS = 9
/** 相邻尾迹点的进度间隔 */
const TRAIL_GAP = 0.022

/** 依据全局进度生成彗星尾迹采样点（沿弧线飞行的高亮光点，尾色随 OD 类别）；
 * highlight（M6.3）：联动模式下未命中航线的尾迹压暗，命中保持原亮度 */
export function buildCometPoints(paths: FlowPath[], progress: number, highlight: string | null = null): CometPoint[] {
  const pts: CometPoint[] = []
  paths.forEach((path, i) => {
    const tail = cometTail(path.flow.category)
    const dimmed = highlight !== null && flowKey(path.flow) !== highlight
    // 各条飞线按序错峰出发，避免齐刷刷起步
    const phase = (((progress - i / paths.length) % 1) + 1) % 1
    for (let j = 0; j < TRAIL_STEPS; j++) {
      const t = phase - j * TRAIL_GAP
      if (t < 0) continue // 尾迹尚未“出发”，本周期从原点重新生长
      const r = smoothstep(t)
      const pos = interpolatePath(path.points, r)
      // 与 deck 弧线着色器一致：z = sqrt(r(1-r)) × 距离 × getHeight
      const alt = Math.sqrt(r * (1 - r)) * path.meters * ARC_HEIGHT * 0.5
      const fade = 1 - j / TRAIL_STEPS
      const head = DECK_COLORS.cometHead
      const k = 1 - fade // 头部亮白 → 尾部类别色渐隐
      pts.push({
        position: [pos[0], pos[1], alt],
        radius: 9000 + fade * 30000,
        color: [
          Math.round(head[0] + (tail[0] - head[0]) * k),
          Math.round(head[1] + (tail[1] - head[1]) * k),
          Math.round(head[2] + (tail[2] - head[2]) * k),
          Math.round(255 * Math.pow(fade, 1.5) * (dimmed ? 0.3 : 1)),
        ],
      })
    }
  })
  return pts
}

/** 创建飞线彗星层：带海拔的发光尾迹，跟随弧线飞行 */
export function createFlowCometLayer(
  points: CometPoint[],
  opacity = 1,
): ScatterplotLayer<CometPoint> {
  return new ScatterplotLayer<CometPoint>({
    id: 'flow-comet',
    data: points,
    getPosition: (d) => d.position,
    getRadius: (d) => d.radius,
    getFillColor: (d) => d.color,
    radiusUnits: 'meters',
    radiusMinPixels: 1.5,
    radiusMaxPixels: 9,
    stroked: false,
    pickable: false,
    opacity,
  })
}

/** deck 弧线参数缓动：smoothstep，与着色器 getSegmentRatio 一致 */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

/** 在大圆采样点序列上按比例插值（采样间距远大于单帧位移，需线性内插保证平滑） */
function interpolatePath(points: [number, number][], r: number): [number, number] {
  const n = points.length
  const idxF = r * (n - 1)
  const i0 = Math.min(Math.floor(idxF), n - 2)
  const frac = idxF - i0
  const a = points[i0]
  const b = points[i0 + 1]
  return [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]
}
