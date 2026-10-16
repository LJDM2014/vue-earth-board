import type {
  DataDrivenPropertyValueSpecification,
  Map as MapLibreMap,
  SymbolLayerSpecification,
  VectorSourceSpecification,
} from 'maplibre-gl'
import { watch, type Ref } from 'vue'

const SOURCE_ID = 'map-annot-src'
const PLACE_LAYER_ID = 'map-annot-place'
const WATER_LAYER_ID = 'map-annot-water'

/** OpenFreeMap 免 key 矢量瓦片（OpenMapTiles schema），仅为注记层提供地名数据 */
const VECTOR_TILES_URL = 'https://tiles.openfreemap.org/planet'

/** 经 useMapLibre 归一化 glyphs 后可用的含 CJK 字体栈（M2 城市标注已验证） */
const FONT_STACK = ['Noto Sans Bold']

/** 中文优先取名：name:zh(-Hans) 缺失时回退 OSM 原始 name */
const TEXT_FIELD: DataDrivenPropertyValueSpecification<string> = [
  'coalesce',
  ['get', 'name:zh-Hans'],
  ['get', 'name:zh'],
  ['get', 'name'],
]

const TEXT_COLOR = '#eef7ff'
const TEXT_HALO = 'rgba(3, 12, 24, 0.88)'
const WATER_TEXT_COLOR = 'rgba(158, 216, 255, 0.92)'
const WATER_TEXT_HALO = 'rgba(4, 14, 28, 0.85)'

/** 行政区划注记：洲/国/省/市/镇随 zoom 分级放大 */
function placeLayer(): SymbolLayerSpecification {
  return {
    id: PLACE_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    'source-layer': 'place',
    filter: [
      'in',
      ['get', 'class'],
      ['literal', ['continent', 'country', 'state', 'city', 'town', 'village']],
    ],
    layout: {
      'text-field': TEXT_FIELD,
      'text-font': FONT_STACK,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        2,
        ['case', ['==', ['get', 'class'], 'country'], 12, ['==', ['get', 'class'], 'city'], 10, 9],
        5,
        ['case', ['==', ['get', 'class'], 'country'], 16, ['==', ['get', 'class'], 'city'], 13, 11],
      ],
      'text-letter-spacing': 0.1,
      'text-max-width': 9,
    },
    paint: {
      'text-color': TEXT_COLOR,
      'text-halo-color': TEXT_HALO,
      'text-halo-width': 1.4,
    },
  }
}

/** 水系注记：海洋/湖泊等水体名称 */
function waterLayer(): SymbolLayerSpecification {
  return {
    id: WATER_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    'source-layer': 'water_name',
    layout: {
      'text-field': TEXT_FIELD,
      'text-font': FONT_STACK,
      'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 6, 12],
      'text-letter-spacing': 0.2,
      'text-max-width': 9,
    },
    paint: {
      'text-color': WATER_TEXT_COLOR,
      'text-halo-color': WATER_TEXT_HALO,
      'text-halo-width': 1.2,
    },
  }
}

/**
 * 地图注记叠加（在瓦片底图上叠加中文地名）：
 * 卫星/地形等纯 raster 底图没有地名，通过挂载 OpenFreeMap 矢量源的两个
 * symbol 图层（行政区划 + 水系）补齐注记；street 等自带注记的底图可手动关闭。
 * 使用 maplibre 原生 symbol 图层：globe 投影下原生支持（deck TextLayer 不渲染）。
 * 复用 useCityLabels 的挂载模式：styleVersion 变化（底图切换/glyphs 归一化）后重挂。
 */
export function useMapAnnotations(
  mapReady: Ref<MapLibreMap | null>,
  styleVersion: Ref<number>,
  showAnnotations: Ref<boolean>,
  opacity: Ref<number>,
) {
  function applyOpacity(map: MapLibreMap) {
    for (const id of [PLACE_LAYER_ID, WATER_LAYER_ID]) {
      if (map.getLayer(id)) map.setPaintProperty(id, 'text-opacity', opacity.value)
    }
  }

  function sync(map: MapLibreMap) {
    if (!map.getSource(SOURCE_ID)) {
      const source: VectorSourceSpecification = { type: 'vector', url: VECTOR_TILES_URL }
      map.addSource(SOURCE_ID, source)
      map.addLayer(placeLayer())
      map.addLayer(waterLayer())
    }
    const visibility = showAnnotations.value ? 'visible' : 'none'
    for (const id of [PLACE_LAYER_ID, WATER_LAYER_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility)
    }
    applyOpacity(map)
  }

  watch([mapReady, styleVersion, showAnnotations, opacity], ([map]) => {
    if (map) sync(map)
  })
}
