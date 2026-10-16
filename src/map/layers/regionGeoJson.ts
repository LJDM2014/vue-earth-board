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
 *
 * DataV 数据末尾附带一条空名"九段线"要素（adcode 100000_JD，南海虚线多边形），
 * 并非省级行政区：其参与 picking 会让命中像素解码出空名对象或 index=-1，
 * 直接导致 hover 高亮失效，因此这里按 properties.name 过滤掉。
 */
const rawProvinces = JSON.parse(chinaProvincesRaw) as ProvinceFeatureCollection

export const chinaProvinces: ProvinceFeatureCollection = {
  ...rawProvinces,
  features: rawProvinces.features.filter((f) => f.properties?.name),
}

export interface CreateRegionLayerOptions {
  /** 当前 hover 的省份名（null 表示无） */
  hoveredName: string | null
  /** hover 回调：透出省份名或 null */
  onHover: (name: string | null) => void
  /** 点击省份回调：M2.5 省份下钻入口 */
  onClick: (feature: ProvinceFeature) => void
  /** 整层透明度系数（0-1，M3.1 图层面板滑杆） */
  opacity?: number
}

/** 创建中国省界图层：淡青描边 + 轻填充，hover 时高亮该省，点击触发下钻 */
export function createRegionLayer(
  options: CreateRegionLayerOptions,
): GeoJsonLayer<ProvinceProperties> {
  const { hoveredName, onHover, onClick, opacity = 1 } = options
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
    opacity,
    updateTriggers: {
      getLineColor: hoveredName,
      getFillColor: hoveredName,
      getLineWidth: hoveredName,
    },
    onHover: (info) => {
      onHover(info.object?.properties?.name || null)
    },
    onClick: (info) => {
      if (info.object) onClick(info.object)
      return false
    },
  })
}
