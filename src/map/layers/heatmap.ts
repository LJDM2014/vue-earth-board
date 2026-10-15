import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { HEATMAP_COLOR_RANGE } from '../../config/theme'
import type { CityMetric } from '../../mock/cities'

/** 创建城市热力图层：按热度指标聚合渲染，色带适配深色主题 */
export function createHeatmapLayer(cities: CityMetric[]): HeatmapLayer<CityMetric> {
  return new HeatmapLayer<CityMetric>({
    id: 'city-heatmap',
    data: cities,
    getPosition: (d) => d.lnglat,
    getWeight: (d) => d.value,
    radiusPixels: 90,
    intensity: 1.2,
    threshold: 0.04,
    colorRange: HEATMAP_COLOR_RANGE,
    opacity: 0.85,
  })
}
