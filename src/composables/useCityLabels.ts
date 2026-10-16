import type { GeoJSONSource, Map as MapLibreMap, SymbolLayerSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { watch, type Ref } from 'vue'
import type { CityMetric } from '../mock/cities'

const SOURCE_ID = 'city-labels-src'
const MAJOR_ID = 'city-labels-major'
const MINOR_ID = 'city-labels-minor'

/** 常显 TOP5 数量 */
const MAJOR_COUNT = 5
/** 次级标注显隐的缩放阈值：初始视角(zoom≈2.2)仅显示 TOP5，放大后全量显示 */
const LABEL_MINOR_ZOOM = 2.4

/** OpenFreeMap 字体服务提供的含 CJK 字体栈（经 useMapLibre 归一化 glyphs 后可用） */
const FONT_STACK = ['Noto Sans Bold']
const TEXT_COLOR = '#d7f5ff'
const TEXT_HALO = 'rgba(2,10,22,0.92)'

/** TOP5 常显层：全程可见，字号更大 */
function majorLayer(): SymbolLayerSpecification {
  return {
    id: MAJOR_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['==', ['get', 'major'], true],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT_STACK,
      'text-size': 13,
      'text-offset': [0, -1.2],
      'text-anchor': 'bottom',
      // TOP5 为关键常显信息：沪杭/广深等近距城市在低 zoom 下屏幕距离过近，
      // 默认碰撞检测会互挤导致部分 TOP 标注消失，故允许重叠
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': TEXT_COLOR,
      'text-halo-color': TEXT_HALO,
      'text-halo-width': 1.5,
    },
  }
}

/** 次级层：缩放超过阈值才出现（paint 属性支持 zoom 表达式，filter 中不可靠） */
function minorLayer(): SymbolLayerSpecification {
  return {
    id: MINOR_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['==', ['get', 'major'], false],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT_STACK,
      'text-size': 11,
      'text-offset': [0, -1.2],
      'text-anchor': 'bottom',
    },
    paint: {
      'text-color': TEXT_COLOR,
      'text-halo-color': TEXT_HALO,
      'text-halo-width': 1.2,
      'text-opacity': ['step', ['zoom'], 0, LABEL_MINOR_ZOOM, 0.92],
    },
  }
}

/**
 * 城市中文标注（M2.4）：`城市名 指标值` 常显，使用 maplibre 原生 symbol 图层。
 * 不用 deck TextLayer 的原因：其在 maplibre v5 globe 投影下不渲染（兼容缺陷），
 * 而 symbol 是 globe 原生支持的标注方案，glyphs 走 OpenFreeMap 免 key 字体服务。
 * 分级显隐——TOP5 全程显示，其余城市放大超过阈值后出现。
 */
export function useCityLabels(
  mapReady: Ref<MapLibreMap | null>,
  styleVersion: Ref<number>,
  cities: Ref<CityMetric[]>,
  showLabels: Ref<boolean>,
  opacity: Ref<number>,
) {
  function sync(map: MapLibreMap) {
    const ranked = [...cities.value].sort((a, b) => b.value - a.value)
    const data: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: ranked.map((city, index) => ({
        type: 'Feature',
        properties: { label: `${city.name} ${city.value}`, major: index < MAJOR_COUNT },
        geometry: { type: 'Point', coordinates: city.lnglat },
      })),
    }

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data })
      map.addLayer(majorLayer())
      map.addLayer(minorLayer())
    } else {
      ;(map.getSource(SOURCE_ID) as GeoJSONSource).setData(data)
    }

    const visibility = showLabels.value ? 'visible' : 'none'
    for (const id of [MAJOR_ID, MINOR_ID]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility)
    }
    applyOpacity(map)
  }

  /** 标注透明度（M3.1 滑杆）：major 直接设值；minor 需保留 step(zoom) 分级显隐结构 */
  function applyOpacity(map: MapLibreMap) {
    if (map.getLayer(MAJOR_ID)) {
      map.setPaintProperty(MAJOR_ID, 'text-opacity', opacity.value)
    }
    if (map.getLayer(MINOR_ID)) {
      map.setPaintProperty(MINOR_ID, 'text-opacity', [
        'step',
        ['zoom'],
        0,
        LABEL_MINOR_ZOOM,
        0.92 * opacity.value,
      ])
    }
  }

  // styleVersion：底图切换 / glyphs 归一化会重载样式并清空自定义 source/layer，需重新挂载
  watch([mapReady, styleVersion, cities, showLabels, opacity], ([map]) => {
    if (map) sync(map)
  })
}
