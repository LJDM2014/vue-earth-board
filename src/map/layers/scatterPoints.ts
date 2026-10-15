import { ScatterplotLayer } from '@deck.gl/layers'
import { DECK_COLORS } from '../../config/theme'
import type { CityMetric } from '../../mock/cities'

/** 创建城市散点图层：半径与颜色按热度指标映射，TOP1 城市金色强调 */
export function createCityPointLayer(cities: CityMetric[]): ScatterplotLayer<CityMetric> {
  const [minV, maxV] = valueRange(cities)
  const span = Math.max(maxV - minV, 1)
  const topName = cities.reduce((top, c) => (c.value > top.value ? c : top), cities[0])?.name

  return new ScatterplotLayer<CityMetric>({
    id: 'city-points',
    data: cities,
    pickable: true,
    getPosition: (d) => d.lnglat,
    getRadius: (d) => 24000 + ((d.value - minV) / span) * 110000,
    getFillColor: (d) => (d.name === topName ? DECK_COLORS.topCityFill : DECK_COLORS.cityFill),
    getLineColor: [228, 253, 255, 150],
    radiusUnits: 'meters',
    radiusMinPixels: 4,
    radiusMaxPixels: 34,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
    stroked: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 120],
  })
}

/** 创建城市中心亮斑图层：让散点有“光核”层次感 */
export function createCityCoreLayer(cities: CityMetric[]): ScatterplotLayer<CityMetric> {
  const [minV, maxV] = valueRange(cities)
  const span = Math.max(maxV - minV, 1)

  return new ScatterplotLayer<CityMetric>({
    id: 'city-cores',
    data: cities,
    pickable: false,
    getPosition: (d) => d.lnglat,
    getRadius: (d) => 6000 + ((d.value - minV) / span) * 26000,
    getFillColor: DECK_COLORS.cityCore,
    radiusUnits: 'meters',
    radiusMinPixels: 1.5,
    radiusMaxPixels: 10,
    stroked: false,
  })
}

/** 指标极值区间（空数据时返回安全区间） */
function valueRange(cities: CityMetric[]): [number, number] {
  if (cities.length === 0) return [0, 1]
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const c of cities) {
    min = Math.min(min, c.value)
    max = Math.max(max, c.value)
  }
  return [min, max]
}
