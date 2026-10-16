import { computed, ref, type Ref } from 'vue'
import type { CityMetric } from '../../mock/cities'
import type { FlowOD } from '../../mock/flows'
import type { CityBoundaryFeature } from '../../services/boundaryService'
import {
  buildCometPoints,
  buildFlowPaths,
  createFlowArcLayer,
  createFlowCometLayer,
  type FlowPath,
} from './flightArcs'
import { createDrillLayer } from './drillBoundary'
import { createHeatmapLayer } from './heatmap'
import { createCityColumnLayer } from './metricColumns'
import { valueRange } from './metricScale'
import { createRegionLayer, type ProvinceFeature } from './regionGeoJson'
import type { LayerDescriptor } from './registry'
import { createCityPointLayer, createCityCoreLayer } from './scatterPoints'
import { buildTrips, createTripLayer } from './tripTracks'

/** 散点呈现方式：光点散点 / 3D 柱状（互斥切换） */
export type PointStyle = 'scatter' | 'column'

/** 图层透明度键（M3.1）：labels 为 maplibre symbol 标注，其余为 deck 图层组 */
export type LayerOpacityKey = 'city' | 'heatmap' | 'arcs' | 'trips' | 'region' | 'labels' | 'annotations'

/** 彗星与轨迹共用的一圈动画周期（秒） */
export const LOOP_SECONDS = 16

/** sparkline 覆盖的历史期数（与时间轴切片数一致） */
export const HISTORY_COUNT = 12

export interface BoardLayerDeps {
  /** 城市指标数据（响应式，时间轴切换时更新） */
  cities: Ref<CityMetric[]>
  /** 飞线 OD 数据（响应式） */
  flows: Ref<FlowOD[]>
  /** 全局循环进度 0→1（useLoopProgress 产出） */
  progress: Ref<number>
  /** 热力图显隐 */
  showHeatmap: Ref<boolean>
  /** 散点呈现方式 */
  pointStyle: Ref<PointStyle>
  /** 动态轨迹回放显隐 */
  showTrips: Ref<boolean>
  /** 城市图层（散点/柱状）显隐（M3.1） */
  showPoints: Ref<boolean>
  /** 飞线弧线显隐（M3.1） */
  showArcs: Ref<boolean>
  /** 省界描边显隐（M3.1） */
  showRegion: Ref<boolean>
  /** 图层透明度 0-1（M3.1） */
  opacity: Ref<Record<LayerOpacityKey, number>>
  /** 联动高亮城市名：面板 hover → 地图高亮（M3.3） */
  hoverCityName: Ref<string | null>
  /** 城市近 N 期指标历史：tooltip sparkline（M3.4） */
  cityHistory: Ref<Map<string, number[]>>
  /** 点击省份：M2.5 下钻入口（App.vue 接管） */
  onProvinceClick: (feature: ProvinceFeature) => void
  /** 点击城市散点/柱：M3.3 面板联动入口 */
  onCityClick: (city: CityMetric) => void
  /** 当前下钻省的市级要素（空 = 全国视角） */
  drillFeatures: Ref<CityBoundaryFeature[]>
}

/** tooltip 内联样式前缀（deck tooltip 以 innerHTML 渲染，无法复用 scoped 样式） */
const TT_FONT = 'font:12px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;'

/** 生成 sparkline SVG（近 N 期指标折线，纯内联样式，不引图表库） */
function sparkline(values: number[]): string {
  const w = 136
  const h = 30
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(max - min, 1)
  const px = (i: number) => (i / (values.length - 1)) * w
  const py = (v: number) => h - 3 - ((v - min) / span) * (h - 8)
  const pts = values.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')
  const lx = px(values.length - 1).toFixed(1)
  const ly = py(values[values.length - 1]).toFixed(1)
  return (
    `<svg width="${w}" height="${h}" style="display:block" aria-hidden="true">` +
    `<polyline points="${pts}" fill="none" stroke="#00e5ff" stroke-width="1.6"` +
    ` stroke-linejoin="round" stroke-linecap="round" opacity="0.9"/>` +
    `<circle cx="${lx}" cy="${ly}" r="2.6" fill="#e4fdff"/></svg>`
  )
}

/**
 * 大屏全部图层的注册表组装：每个图层组以 LayerDescriptor 声明
 * （id / z 序 / 可见性 / 构建函数 / tooltip），useDeckOverlay 仅按注册表聚合。
 * 新增图层只需在此追加描述符，无需改动 overlay 主流程。
 */
export function createBoardDescriptors(deps: BoardLayerDeps): LayerDescriptor[] {
  const {
    cities,
    flows,
    progress,
    showHeatmap,
    pointStyle,
    showTrips,
    showPoints,
    showArcs,
    showRegion,
    opacity,
    hoverCityName,
    cityHistory,
    drillFeatures,
  } = deps

  /** 省界 hover 状态：仅地图内部消费 */
  const hoveredProvince = ref<string | null>(null)
  /** 下钻市界 hover 状态 */
  const hoveredCity = ref<string | null>(null)

  /**
   * hover 按帧合并（省界 hover 残留修复）：
   * 快速划过多省时 deck 每次移动都回调 onHover，逐次全量重建图层属性会排队滞后，
   * 旧高亮迟迟不退；rAF 合并后每帧只应用最后一次结果，高亮始终贴合当前光标。
   */
  function coalesceHover(target: Ref<string | null>) {
    let frame = 0
    let pending = target.value
    return (name: string | null) => {
      if (pending === name) return
      pending = name
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        target.value = pending
      })
    }
  }
  const setHoveredProvince = coalesceHover(hoveredProvince)
  const setHoveredCity = coalesceHover(hoveredCity)

  const cityMap = computed(() => new Map(cities.value.map((c) => [c.name, c])))
  const flowPaths = computed<FlowPath[]>(() => buildFlowPaths(flows.value, cityMap.value))
  const volumeRange = computed<[number, number]>(() => valueRange(flows.value.map((f) => f.volume)))
  const trips = computed(() => buildTrips(flowPaths.value, LOOP_SECONDS))
  const currentTime = computed(() => progress.value * LOOP_SECONDS)
  /** 联动高亮城市在数据中的下标（-1 = 无） */
  const hoverIndex = computed(() => {
    const name = hoverCityName.value
    if (!name) return -1
    return cities.value.findIndex((c) => c.name === name)
  })
  /** 省份聚合热度均值：tooltip 与面板联动共用 */
  const provinceAgg = computed(() => {
    const agg = new Map<string, { total: number; count: number }>()
    for (const c of cities.value) {
      const cur = agg.get(c.province) ?? { total: 0, count: 0 }
      cur.total += c.value
      cur.count += 1
      agg.set(c.province, cur)
    }
    return agg
  })

  /** 城市悬浮卡片：名称 + 指标 + 近 12 期 sparkline（M3.4，{ html } 才会按 HTML 渲染） */
  const cityTooltip = (info: { object?: unknown }): { html: string } | null => {
    const city = info.object as CityMetric | undefined
    if (!city) return null
    const history = cityHistory.value.get(city.name) ?? []
    return {
      html:
        `<div style="${TT_FONT}color:#d7f5ff;font-weight:600;letter-spacing:1px;">${city.name}` +
        `<span style="color:#00e5ff;margin-left:10px;font-variant-numeric:tabular-nums;">${city.value}</span></div>` +
        (history.length >= 2
          ? `<div style="${TT_FONT}color:#5f7d93;margin-top:2px;">近 ${history.length} 期热度</div>` +
            `<div style="margin-top:2px;">${sparkline(history)}</div>`
          : ''),
    }
  }

  /** 省份悬浮卡片：省名 + 该省城市平均热度 */
  const provinceTooltip = (info: { object?: unknown }): { html: string } | null => {
    const name = (info.object as ProvinceFeature | undefined)?.properties?.name
    if (!name) return null
    const agg = provinceAgg.value.get(name)
    return {
      html:
        `<div style="${TT_FONT}color:#d7f5ff;font-weight:600;letter-spacing:1px;">${name}` +
        (agg
          ? `<span style="color:#7be8ff;margin-left:10px;">均度 ${Math.round(agg.total / agg.count)}</span>`
          : '') +
        `</div>`,
    }
  }

  /** 城市点状图层公共交互（M3.3 联动） */
  const cityInteraction = () => ({
    hoverIndex: hoverIndex.value,
    onClick: deps.onCityClick,
  })

  return [
    {
      id: 'region',
      order: 10,
      visible: () => showRegion.value,
      build: () => [
        createRegionLayer({
          hoveredName: hoveredProvince.value,
          onHover: setHoveredProvince,
          onClick: deps.onProvinceClick,
          opacity: opacity.value.region,
        }),
      ],
      tooltip: provinceTooltip,
    },
    {
      id: 'drill',
      order: 12,
      visible: () => drillFeatures.value.length > 0,
      build: () => [
        createDrillLayer({
          features: drillFeatures.value,
          hoveredName: hoveredCity.value,
          onHover: setHoveredCity,
          onClick: () => {
            /* 区县层不再继续下钻 */
          },
        }),
      ],
      tooltip: (info) => {
        const name = (info.object as CityBoundaryFeature | undefined)?.properties?.name
        return name ?? null
      },
    },
    {
      id: 'heatmap',
      order: 20,
      visible: () => showHeatmap.value,
      build: () => [createHeatmapLayer(cities.value, opacity.value.heatmap)],
    },
    {
      id: 'columns',
      order: 24,
      visible: () => showPoints.value && pointStyle.value === 'column',
      build: () => [createCityColumnLayer(cities.value, opacity.value.city, cityInteraction())],
      tooltip: cityTooltip,
    },
    {
      id: 'scatter',
      order: 26,
      visible: () => showPoints.value && pointStyle.value === 'scatter',
      build: () => [
        createCityPointLayer(cities.value, opacity.value.city, cityInteraction()),
        createCityCoreLayer(cities.value, opacity.value.city),
      ],
      tooltip: cityTooltip,
    },
    {
      id: 'trips',
      order: 34,
      visible: () => showTrips.value && trips.value.length > 0,
      build: () => [
        createTripLayer(
          trips.value,
          currentTime.value,
          LOOP_SECONDS,
          volumeRange.value,
          opacity.value.trips,
        ),
      ],
    },
    {
      id: 'arcs',
      order: 36,
      visible: () => showArcs.value && flowPaths.value.length > 0,
      build: () => [createFlowArcLayer(flowPaths.value, volumeRange.value, opacity.value.arcs)],
    },
    {
      // 彗星尾迹单独成组（M4.1）：唯一随 progress 每帧重建的飞线组，
      // 静态弧线实例因此得以跨帧复用，不再被动画帧拖着重建
      id: 'comet',
      order: 37,
      visible: () => showArcs.value && flowPaths.value.length > 0,
      build: () => [
        createFlowCometLayer(buildCometPoints(flowPaths.value, progress.value), opacity.value.arcs),
      ],
    },
  ]
}
