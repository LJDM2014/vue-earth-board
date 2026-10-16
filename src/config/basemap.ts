/**
 * 底图配置：内置三套免 token 底图供界面直接切换（卫星影像 / 街景 / 地形晕渲），
 * 统一走快速稳定的 Esri / Carto CDN，避免多源瓦片拖慢加载。
 * 卫星与地形为纯 raster 底图（无地名），配合 useMapAnnotations 的矢量注记叠加层使用。
 * 约束：进入 BASEMAP_OPTIONS 的项必须无需任何 API key。
 */
import type { StyleSpecification } from 'maplibre-gl'

export interface BasemapOption {
  /** 唯一标识 */
  id: string
  /** 界面显示名 */
  name: string
  /** MapLibre 样式：远程 URL、内网路径或内联样式对象 */
  styleUrl: string | StyleSpecification
}

/**
 * 卫星影像（Esri World Imagery，raster 瓦片免 key）：
 * 用内联样式对象组装，globe 投影下呈现真实地球。
 */
const ESRI_SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: 'esri-satellite',
  sources: {
    satellite: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles © Esri, Maxar, Earthstar Geographics and the GIS User Community',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#060b16' } },
    { id: 'satellite', type: 'raster', source: 'satellite' },
  ],
}

/**
 * 地形晕渲（Esri World Terrain Base，raster 瓦片免 key）：
 * 彩色高程分层设色 + 地势起伏，自身无地名注记，天然适合叠加矢量地名层。
 * 服务 maxzoom 13，大屏视角（复位/下钻 ≤6.5）内清晰，放大过头由 maplibre 过缩放补齐。
 */
const ESRI_TERRAIN_STYLE: StyleSpecification = {
  version: 8,
  name: 'esri-terrain',
  sources: {
    terrain: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 13,
      attribution: 'Terrain © Esri, USGS, NOAA and the GIS User Community',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#060b16' } },
    {
      id: 'terrain',
      type: 'raster',
      source: 'terrain',
      // 压暗贴合暗色大屏基调，同时保留高程色彩层次
      paint: { 'raster-brightness-max': 0.62, 'raster-saturation': -0.3, 'raster-contrast': 0.1 },
    },
  ],
}

/** 可选底图列表（均免 token，切换通过 map.setStyle 即时生效） */
export const BASEMAP_OPTIONS: BasemapOption[] = [
  {
    id: 'esri-satellite',
    name: '卫星影像',
    styleUrl: ESRI_SATELLITE_STYLE,
  },
  {
    // 选用 OpenFreeMap 自家样式：其字体栈与 GLYPHS_URL 完全匹配（Carto 样式的
    // Open Sans/Montserrat 复合栈在 OpenFreeMap 字体服务上 404，导致自带标注缺字）
    id: 'ofm-liberty',
    name: '街景地图',
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  },
  {
    id: 'esri-terrain',
    name: '地形晕渲',
    styleUrl: ESRI_TERRAIN_STYLE,
  },
]

/** 默认底图 id（卫星影像，最贴合数字地球的视觉基调） */
export const DEFAULT_BASEMAP_ID = 'esri-satellite'

/** 当前启用的底图（首项即默认项） */
export const ACTIVE_BASEMAP: BasemapOption = BASEMAP_OPTIONS[0]
