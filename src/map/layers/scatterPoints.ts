import { ScatterplotLayer } from '@deck.gl/layers'
import { DECK_COLORS } from '../../config/theme'
import type { CityMetric } from '../../mock/cities'
import { normalize, valueRange } from './metricScale'

/** 城市点状图层交互选项：面板联动高亮 + 点击回调（M3.3） */
export interface CityLayerInteraction {
  /** 高亮城市在数据中的下标（-1 = 无高亮） */
  hoverIndex?: number
  /** 点击城市回调 */
  onClick?: (city: CityMetric) => void
}

/** 创建城市散点图层：半径与颜色按热度指标映射，TOP1 城市金色强调 */
export function createCityPointLayer(
  cities: CityMetric[],
  opacity = 1,
  interaction: CityLayerInteraction = {},
): ScatterplotLayer<CityMetric> {
  const range = valueRange(cities.map((c) => c.value))
  const topName = cities.reduce((top, c) => (c.value > top.value ? c : top), cities[0])?.name

  return new ScatterplotLayer<CityMetric>({
    id: 'city-points',
    data: cities,
    pickable: true,
    getPosition: (d) => d.lnglat,
    getRadius: (d) => 24000 + normalize(d.value, range) * 110000,
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
    opacity,
    highlightedObjectIndex: interaction.hoverIndex ?? -1,
    onClick: (info) => {
      if (info.object && interaction.onClick) interaction.onClick(info.object)
      return false
    },
  })
}

/** 创建城市中心亮斑图层：让散点有“光核”层次感 */
export function createCityCoreLayer(
  cities: CityMetric[],
  opacity = 1,
): ScatterplotLayer<CityMetric> {
  const range = valueRange(cities.map((c) => c.value))

  return new ScatterplotLayer<CityMetric>({
    id: 'city-cores',
    data: cities,
    pickable: false,
    getPosition: (d) => d.lnglat,
    getRadius: (d) => 6000 + normalize(d.value, range) * 26000,
    getFillColor: DECK_COLORS.cityCore,
    radiusUnits: 'meters',
    radiusMinPixels: 1.5,
    radiusMaxPixels: 10,
    stroked: false,
    opacity,
  })
}
