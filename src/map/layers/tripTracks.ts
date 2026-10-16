import { TripsLayer } from '@deck.gl/geo-layers'
import { metricRamp } from '../../config/theme'
import { ARC_HEIGHT, type FlowPath } from './flightArcs'
import { normalize } from './metricScale'

/** 单条轨迹样本：三维路径（与静态弧线同一高度公式）+ 各采样点时刻 + 运量 */
export interface TripSample {
  path: [number, number, number][]
  timestamps: number[]
  volume: number
}

/**
 * 由飞线大圆路径构建带时序的轨迹样本（M2.3）：
 * 各轨迹按序错峰出发，均匀分布在 [0, cycle - duration]，
 * 保证 currentTime 单调推进一个周期时全部轨迹恰好飞完、循环无缝衔接。
 */
export function buildTrips(paths: FlowPath[], cycleSeconds: number): TripSample[] {
  return paths.map((p, i) => {
    const n = p.points.length
    const duration = cycleSeconds * 0.62
    const t0 = (i / paths.length) * (cycleSeconds - duration)
    const path: [number, number, number][] = []
    const timestamps: number[] = []
    for (let j = 0; j < n; j++) {
      const r = j / (n - 1)
      const [lng, lat] = p.points[j]
      // 与 deck 弧线着色器一致：z = sqrt(r(1-r)) × 距离 × getHeight × 0.5
      path.push([lng, lat, Math.sqrt(r * (1 - r)) * p.meters * ARC_HEIGHT * 0.5])
      timestamps.push(t0 + duration * r)
    }
    return { path, timestamps, volume: p.flow.volume }
  })
}

/** 创建动态轨迹层：currentTime 驱动拖尾回放，颜色按运量取指标色带 */
export function createTripLayer(
  trips: TripSample[],
  currentTime: number,
  cycleSeconds: number,
  volumeRange: [number, number],
  opacity = 1,
): TripsLayer<TripSample> {
  return new TripsLayer<TripSample>({
    id: 'flow-trips',
    data: trips,
    getPath: (d) => d.path,
    getTimestamps: (d) => d.timestamps,
    getColor: (d) => metricRamp(normalize(d.volume, volumeRange), 235),
    opacity: 0.9 * opacity,
    widthUnits: 'pixels',
    getWidth: 1.8,
    trailLength: cycleSeconds * 0.3,
    currentTime,
    fadeTrail: true,
    pickable: false,
  })
}
