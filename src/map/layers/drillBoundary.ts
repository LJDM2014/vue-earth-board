import { GeoJsonLayer } from '@deck.gl/layers'
import { DECK_COLORS } from '../../config/theme'
import type {
  CityBoundaryCollection,
  CityBoundaryFeature,
  CityBoundaryProperties,
} from '../../services/boundaryService'

export interface CreateDrillLayerOptions {
  /** 当前下钻省的市级要素集 */
  features: CityBoundaryFeature[]
  /** 当前 hover 的市/区县名 */
  hoveredName: string | null
  /** hover 回调 */
  onHover: (name: string | null) => void
  /** 点击市级要素回调（区县层不再继续下钻，仅透出要素） */
  onClick: (feature: CityBoundaryFeature) => void
}

/** 创建下钻市界图层：描边 + 轻填充，hover 高亮，置于省界之上 */
export function createDrillLayer(
  options: CreateDrillLayerOptions,
): GeoJsonLayer<CityBoundaryProperties> {
  const { features, hoveredName, onHover, onClick } = options
  return new GeoJsonLayer<CityBoundaryProperties>({
    id: 'drill-city-boundaries',
    data: { type: 'FeatureCollection', features } as CityBoundaryCollection,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthUnits: 'pixels',
    getLineColor: (f) =>
      f.properties.name === hoveredName ? DECK_COLORS.regionHoverLine : [0, 229, 255, 215],
    getFillColor: (f) =>
      f.properties.name === hoveredName ? DECK_COLORS.regionHoverFill : [0, 44, 84, 30],
    getLineWidth: (f) => (f.properties.name === hoveredName ? 2.4 : 1.2),
    updateTriggers: {
      getLineColor: hoveredName,
      getFillColor: hoveredName,
      getLineWidth: hoveredName,
    },
    onHover: (info) => {
      onHover(info.object?.properties?.name ?? null)
    },
    onClick: (info) => {
      if (info.object) onClick(info.object)
      return false
    },
  })
}
