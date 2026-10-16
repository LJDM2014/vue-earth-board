import { describe, expect, it } from 'vitest'
import { buildTrips, createTripLayer } from '../tripTracks'
import type { FlowPath } from '../flightArcs'

/** 合成 11 采样点直线路径，meters=1000 */
function syntheticPath(volume: number): FlowPath {
  const points: [number, number][] = []
  for (let j = 0; j < 11; j++) points.push([100 + j, 30 + j])
  return {
    flow: { from: 'a', to: 'b', volume, category: 'passenger' },
    points,
    meters: 1000,
  }
}

describe('buildTrips 轨迹样本构建', () => {
  it('时序单调递增且总时长 = cycle × 0.62', () => {
    const trips = buildTrips([syntheticPath(50)], 16)
    expect(trips).toHaveLength(1)
    const ts = trips[0].timestamps
    for (let j = 1; j < ts.length; j++) expect(ts[j]).toBeGreaterThan(ts[j - 1])
    expect(ts[ts.length - 1]).toBeCloseTo(16 * 0.62, 10)
    expect(ts[0]).toBeCloseTo(0, 10)
  })

  it('多轨迹按序错峰，全部落在 [0, cycle] 内无缝衔接', () => {
    const trips = buildTrips([syntheticPath(10), syntheticPath(20), syntheticPath(30)], 16)
    const duration = 16 * 0.62
    trips.forEach((trip, i) => {
      const t0 = (i / trips.length) * (16 - duration)
      expect(trip.timestamps[0]).toBeCloseTo(t0, 10)
      expect(trip.timestamps[trip.timestamps.length - 1]).toBeCloseTo(t0 + duration, 10)
      expect(trip.timestamps[trip.timestamps.length - 1]).toBeLessThanOrEqual(16)
    })
  })

  it('路径海拔与弧线着色器公式一致（中点最高）', () => {
    const [trip] = buildTrips([syntheticPath(50)], 16)
    const alts = trip.path.map((p) => p[2])
    const mid = alts[Math.floor(alts.length / 2)]
    expect(mid).toBeCloseTo(Math.sqrt(0.25) * 1000 * 0.55 * 0.5, 6)
    expect(alts[0]).toBeCloseTo(0, 6)
    expect(alts[alts.length - 1]).toBeCloseTo(0, 6)
    // 中点为全路径最高点
    expect(mid).toBeCloseTo(Math.max(...alts), 6)
  })

  it('volume 沿用飞线运量', () => {
    const [trip] = buildTrips([syntheticPath(77)], 16)
    expect(trip.volume).toBe(77)
  })

  it('空路径返回空数组', () => {
    expect(buildTrips([], 16)).toEqual([])
  })
})

describe('createTripLayer 轨迹层', () => {
  it('实例 id 与拖尾时长符合约定', () => {
    const trips = buildTrips([syntheticPath(50)], 16)
    const layer = createTripLayer(trips, 5, 16, [0, 100], 0.5)
    expect(layer.id).toBe('flow-trips')
    expect(layer.props.currentTime).toBe(5)
    expect(layer.props.trailLength).toBeCloseTo(16 * 0.3, 10)
    expect(layer.props.opacity).toBeCloseTo(0.45, 10)
    expect(layer.props.fadeTrail).toBe(true)
  })
})
