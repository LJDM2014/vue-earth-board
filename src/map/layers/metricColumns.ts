import { ColumnLayer } from '@deck.gl/layers'
import { metricRamp } from '../../config/theme'
import type { CityMetric } from '../../mock/cities'
import { normalize, valueRange } from './metricScale'
import type { CityLayerInteraction } from './scatterPoints'

/** 柱底基准半径（米）：中段缩放保持的真实地理尺度 */
const COLUMN_RADIUS = 32000
/** 柱径投影像素宽下限：低缩放（全国视角）时柱体仍可感知（与散点 radiusMinPixels 呼应） */
const COLUMN_MIN_PIXELS = 6
/** 柱径投影像素宽上限：高缩放推近时柱体保持紧凑，不遮挡城市 */
const COLUMN_MAX_PIXELS = 16
/** 最小柱高（米）：保证低值城市仍有可感知的立体感 */
const MIN_ELEVATION = 24000
/** 柱高动态区间（米） */
const ELEVATION_SPAN = 360000
/** 兜底缩放层级：地图 zoom 信号未就绪时按初始机位（全国视角）计算 */
const FALLBACK_ZOOM = 2.2

/** Web Mercator 地面分辨率（米/像素）：赤道周长 156543.03m/px ÷ 2^zoom × 纬度余弦 */
function metersPerPixel(zoom: number, lat: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

/**
 * 缩放自适应柱径（米）：把柱径的投影像素宽度夹在 [MIN, MAX] 像素带内 ——
 * 低缩放抬升至下限（柱体可见），中段保持真实地理尺度，高缩放压回上限（不淹没城市），
 * 观感策略与散点层的 radiusMin/MaxPixels 对齐
 */
export function adaptiveColumnRadius(zoom: number, lat = 36): number {
  const halfPx = metersPerPixel(zoom, lat) / 2
  return Math.min(Math.max(COLUMN_RADIUS, COLUMN_MIN_PIXELS * halfPx), COLUMN_MAX_PIXELS * halfPx)
}

/** 创建城市指标 3D 柱状图层：高度与颜色按热度指标映射（与散点互斥切换）；柱径随地图缩放自适应 */
export function createCityColumnLayer(
  cities: CityMetric[],
  opacity = 1,
  interaction: CityLayerInteraction = {},
  zoom = FALLBACK_ZOOM,
): ColumnLayer<CityMetric> {
  const range = valueRange(cities.map((c) => c.value))
  const radius = adaptiveColumnRadius(zoom)

  return new ColumnLayer<CityMetric>({
    id: 'city-columns',
    data: cities,
    pickable: true,
    extruded: true,
    diskResolution: 24,
    radius,
    // 高度与柱径同比例缩放：像素夹带时不改变柱体自身的长宽比例
    elevationScale: radius / COLUMN_RADIUS,
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
