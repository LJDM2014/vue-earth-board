import type { Feature, FeatureCollection, Geometry } from 'geojson'

/** 市级行政区 properties（DataV `{adcode}_full.json` 结构） */
export interface CityBoundaryProperties {
  name: string
  adcode: number
  level?: string
  center?: [number, number]
  centroid?: [number, number]
}

/** 单个市级行政区要素 */
export type CityBoundaryFeature = Feature<Geometry, CityBoundaryProperties>

/** 市级行政区 GeoJSON 集合 */
export type CityBoundaryCollection = FeatureCollection<Geometry, CityBoundaryProperties>

/** DataV 行政边界服务根地址 */
const DATAV_BASE = 'https://geo.datav.aliyun.com/areas_v3/bound'

/** 内存缓存：adcode → 市界集合（同一次会话内不重复拉取） */
const cache = new Map<number, CityBoundaryCollection>()

/**
 * 拉取省级下钻的市级行政边界（DataV `{adcode}_full.json`）。
 * 运行时按需拉取后写入内存缓存；内网/离线场景抛错由调用方降级处理。
 */
export async function loadCityBoundaries(adcode: number): Promise<CityBoundaryCollection> {
  const cached = cache.get(adcode)
  if (cached) return cached

  const res = await fetch(`${DATAV_BASE}/${adcode}_full.json`)
  if (!res.ok) {
    throw new Error(`市界数据拉取失败：adcode=${adcode} HTTP ${res.status}`)
  }
  const raw = (await res.json()) as CityBoundaryCollection
  // 与省界数据同源：过滤 DataV 附带的空名要素（如九段线），避免拾取异常
  const collection: CityBoundaryCollection = {
    ...raw,
    features: raw.features.filter((f) => f.properties?.name),
  }
  cache.set(adcode, collection)
  return collection
}

/** 计算要素集外包矩形 [[minLng, minLat], [maxLng, maxLat]]（用于下钻后 fitBounds） */
export function geoBBox(features: CityBoundaryFeature[]): [[number, number], [number, number]] {
  let minLng = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLng = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY
  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      minLng = Math.min(minLng, coords[0] as number)
      maxLng = Math.max(maxLng, coords[0] as number)
      minLat = Math.min(minLat, coords[1] as number)
      maxLat = Math.max(maxLat, coords[1] as number)
      return
    }
    for (const c of coords) walk(c)
  }
  for (const f of features) {
    // DataV 边界数据均为 Polygon/MultiPolygon，不会出现 GeometryCollection
    walk((f.geometry as { coordinates: unknown }).coordinates)
  }
  if (!Number.isFinite(minLng)) return [[73, 18], [135, 53]]
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}
