import { ColumnLayer } from '@deck.gl/layers'
import { metricRamp } from '../../config/theme'
import type { CityMetric } from '../../mock/cities'
import { normalize, valueRange } from './metricScale'
import type { CityLayerInteraction } from './scatterPoints'

/** 柱底半径（米） */
const COLUMN_RADIUS = 42000
/** 最小柱高（米）：保证低值城市仍有可感知的立体感 */
const MIN_ELEVATION = 24000
/** 柱高动态区间（米） */
const ELEVATION_SPAN = 360000

/** 创建城市指标 3D 柱状图层：高度与颜色按热度指标映射（与散点互斥切换） */
export function createCityColumnLayer(
  cities: CityMetric[],
  opacity = 1,
  interaction: CityLayerInteraction = {},
): ColumnLayer<CityMetric> {
  const range = valueRange(cities.map((c) => c.value))

  return new ColumnLayer<CityMetric>({
    id: 'city-columns',
    data: cities,
    pickable: true,
    extruded: true,
    diskResolution: 24,
    radius: COLUMN_RADIUS,
    coverage: 0.85,
    getPosition: (d) => d.lnglat,
    getElevation: (d) => MIN_ELEVATION + normalize(d.value, range) * ELEVATION_SPAN,
    getFillColor: (d) => metricRamp(normalize(d.value, range), 215),
    getLineColor: [168, 242, 255, 80],
    opacity: 0.95 * opacity,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 120],
    highlightedObjectIndex: interaction.hoverIndex ?? -1,
    onClick: (info) => {
      if (info.object && interaction.onClick) interaction.onClick(info.object)
      return false
    },
    material: {
      ambient: 0.5,
      diffuse: 0.6,
      shininess: 24,
      specularColor: [120, 220, 255],
    },
  })
}
