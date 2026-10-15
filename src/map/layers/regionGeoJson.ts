import { GeoJsonLayer } from '@deck.gl/layers'
import { DECK_COLORS } from '../../config/theme'
import chinaProvincesRaw from '../../data/china-provinces.geojson?raw'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

/** 省级行政区 properties（DataV 行政边界 GeoJSON 结构） */
export interface ProvinceProperties {
  name: string
  adcode: number
  center?: [number, number]
  centroid?: [number, number]
  level?: string
}

/** 单个省级行政区要素 */
export type ProvinceFeature = Feature<Geometry, ProvinceProperties>

/** 中国省级行政区 GeoJSON 集合 */
export type ProvinceFeatureCollection = FeatureCollection<Geometry, ProvinceProperties>

/**
 * 本地内置省界数据：初始化阶段从 DataV 下载一次后随构建打包，
 * 运行时不发起任何网络请求。
 */
export const chinaProvinces: ProvinceFeatureCollection = JSON.parse(chinaProvincesRaw)

export interface CreateRegionLayerOptions {
  /** 当前 hover 的省份名（null 表示无） */
  hoveredName: string | null
  /** hover 回调：透出省份名或 null */
  onHover: (name: string | null) => void
}

/** 创建中国省界图层：淡青描边 + 轻填充，hover 时高亮该省 */
export function createRegionLayer(
  options: CreateRegionLayerOptions,
): GeoJsonLayer<ProvinceProperties> {
  const { hoveredName, onHover } = options
  return new GeoJsonLayer<ProvinceProperties>({
    id: 'china-provinces',
    data: chinaProvinces,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthUnits: 'pixels',
    getLineColor: (f) =>
      f.properties.name === hoveredName ? DECK_COLORS.regionHoverLine : DECK_COLORS.regionLine,
    getFillColor: (f) =>
      f.properties.name === hoveredName ? DECK_COLORS.regionHoverFill : DECK_COLORS.regionFill,
    getLineWidth: (f) => (f.properties.name === hoveredName ? 2.2 : 1),
    updateTriggers: {
      getLineColor: hoveredName,
      getFillColor: hoveredName,
      getLineWidth: hoveredName,
    },
    onHover: (info) => {
      onHover(info.object?.properties.name ?? null)
    },
  })
}
