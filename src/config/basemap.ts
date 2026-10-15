/**
 * 底图配置：内置多套免 token 底图供界面直接切换（卫星 / 街道 / 深浅色矢量）；
 * 预留天地图（tk 参数）与自托管瓦片（内网部署）的接入位。
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

/** 可选底图列表（均免 token，切换通过 map.setStyle 即时生效） */
export const BASEMAP_OPTIONS: BasemapOption[] = [
  {
    id: 'esri-satellite',
    name: '卫星影像',
    styleUrl: ESRI_SATELLITE_STYLE,
  },
  {
    id: 'carto-voyager',
    name: '明亮街景',
    styleUrl: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  {
    id: 'ofm-dark',
    name: '暗夜深蓝',
    styleUrl: 'https://tiles.openfreemap.org/styles/dark',
  },
  {
    id: 'ofm-liberty',
    name: '经典亮色',
    styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  },
  {
    id: 'carto-dark',
    name: '墨黑极简',
    styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  {
    id: 'carto-positron',
    name: '银灰浅色',
    styleUrl: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
]

/** 默认底图 id（卫星影像，最贴合数字地球的视觉基调） */
export const DEFAULT_BASEMAP_ID = 'esri-satellite'

/** 当前启用的底图（首项即默认项） */
export const ACTIVE_BASEMAP: BasemapOption = BASEMAP_OPTIONS[0]

/**
 * 预留：天地图矢量/影像底图。需在 https://console.tianditu.gov.cn 申请 tk 后，
 * 组装含 tk 查询参数的样式 URL 并加入 BASEMAP_OPTIONS 即可上线。
 */
export const TIANDITU_PLACEHOLDER: BasemapOption & { tk: string } = {
  id: 'tianditu',
  name: '天地图（需 tk）',
  styleUrl: '',
  tk: '',
}

/** 预留：内网自托管瓦片。离线部署时把 styleUrl 指向本地样式文件后加入列表。 */
export const SELF_HOSTED_PLACEHOLDER: BasemapOption = {
  id: 'self-hosted',
  name: '自托管瓦片（内网）',
  styleUrl: '/basemaps/dark.json',
}
