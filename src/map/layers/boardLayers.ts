import { computed, ref, type Ref } from 'vue'
import { METRIC_TINT, THEME, hexToRgba } from '../../config/theme'
import { METRIC_DEFS, type CityMetric, type MetricKey } from '../../mock/cities'
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
import { flowWidthTiers, valueRange, type FlowWidthTiers } from './metricScale'
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
  /** 城市指标数据（响应式，时间轴切换时更新；value 为激活指标快照） */
  cities: Ref<CityMetric[]>
  /** 当前激活指标（M5.2）：驱动 tooltip 标签与单位 */
  activeMetric: Ref<MetricKey>
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
  /** 联动高亮航线键 `起点→终点`：航线面板 hover → 弧线高亮（M6.3） */
  hoverFlow: Ref<string | null>
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

/** 毛玻璃卡片外壳（M6.4）：blur + 深色半透明底 + 发光描边；函数化随主题实时取色（M8.2） */
const ttShell = () =>
  `backdrop-filter:blur(8px);background:rgb(${THEME.panelChannels} / 0.82);border:1px solid ${hexToRgba(THEME.cyan, 0.38)};` +
  `border-radius:8px;box-shadow:0 0 18px ${hexToRgba(THEME.cyan, 0.18)},inset 0 0 16px ${hexToRgba(THEME.cyan, 0.05)};` +
  'padding:10px 14px 9px 16px;position:relative;overflow:hidden;min-width:200px;'

/** 左侧指标色条（按激活指标着色） */
const ttBar = (color: string) =>
  `position:absolute;left:0;top:0;bottom:0;width:3px;background:${color};box-shadow:0 0 8px ${color};`

/** 环比箭头片段（M6.4：近 N 期倒数第二期 vs 当期，波动 <0.05% 不展示） */
function trendBadge(history: number[], current: number): string {
  if (history.length < 2) return ''
  const prev = history[history.length - 2]
  if (!(prev > 0)) return ''
  const pct = ((current - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return ''
  const up = pct > 0
  const color = up ? '#6ef2c8' : '#ff9c5b'
  return `<span style="${TT_FONT}font-size:11px;color:${color};margin-left:8px;">${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%</span>`
}

/** 生成 sparkline SVG（近 N 期指标折线 + 渐变面积，纯内联样式，不引图表库） */
function sparkline(values: number[], w = 160, h = 36, color = THEME.cyan): string {
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
    `<defs><linearGradient id="tt-grad" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${color}" stop-opacity="0.32"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    `<polygon points="0,${h - 1} ${pts} ${w},${h - 1}" fill="url(#tt-grad)"/>` +
    `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6"` +
    ` stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>` +
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
    activeMetric,
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
    hoverFlow,
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
  /** 弧线宽度分位档（M5.3：P50/P90 三档映射） */
  const widthTiers = computed<FlowWidthTiers>(() => flowWidthTiers(flows.value.map((f) => f.volume)))
  const trips = computed(() => buildTrips(flowPaths.value, LOOP_SECONDS))
  const currentTime = computed(() => progress.value * LOOP_SECONDS)
  /** 激活指标元信息（tooltip 标签与单位） */
  const metricDef = computed(() => METRIC_DEFS[activeMetric.value])
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

  /**
   * 城市悬浮卡片（M6.4 毛玻璃精修）：指标色条 + 城市名/省份 → 主指标大数字 + 环比 →
   * 放大 sparkline（渐变面积）→ 三指标微缩行（{ html } 才会按 HTML 渲染）
   */
  const cityTooltip = (info: { object?: unknown }): { html: string } | null => {
    const city = info.object as CityMetric | undefined
    if (!city) return null
    const history = cityHistory.value.get(city.name) ?? []
    const def = metricDef.value
    const tint = METRIC_TINT[activeMetric.value]
    const unit = def.unit
      ? `<span style="${TT_FONT}font-size:10px;color:${THEME.cyanSoft};font-weight:400;"> ${def.unit}</span>`
      : ''
    const miniRow = (['heat', 'passenger', 'economy'] as MetricKey[])
      .map(
        (m) =>
          `<span style="display:inline-flex;align-items:center;gap:3px;">` +
          `<i style="width:5px;height:5px;border-radius:50%;background:${METRIC_TINT[m]};display:inline-block;box-shadow:0 0 4px ${METRIC_TINT[m]};"></i>` +
          `${METRIC_DEFS[m].short} <b style="font-weight:600;color:${THEME.cyanSoft};font-variant-numeric:tabular-nums;">${city.indicators[m].toLocaleString()}</b></span>`,
      )
      .join('<span style="display:inline-block;width:7px;"></span>')
    return {
      html:
        `<div style="${ttShell()}">` +
        `<i style="${ttBar(tint)}"></i>` +
        `<div style="${TT_FONT}display:flex;align-items:baseline;gap:7px;">` +
        `<span style="font-size:15px;font-weight:600;color:${THEME.text};letter-spacing:1px;">${city.name}</span>` +
        `<span style="font-size:11px;color:${THEME.textDim};">${city.province}</span></div>` +
        `<div style="${TT_FONT}display:flex;align-items:baseline;margin-top:3px;">` +
        `<span style="font-size:11px;color:${THEME.textDim};">${def.short}</span>` +
        `<span style="font-size:20px;font-weight:700;color:${tint};text-shadow:0 0 10px ${tint}66;font-variant-numeric:tabular-nums;margin-left:6px;">${city.value.toLocaleString()}</span>` +
        `${unit}${trendBadge(history, city.value)}</div>` +
        (history.length >= 2
          ? `<div style="margin-top:6px;">${sparkline(history, 160, 36, tint)}</div>` +
            `<div style="${TT_FONT}font-size:10px;color:${THEME.textDim};margin-top:2px;">近 ${history.length} 期${def.short}</div>`
          : '') +
        `<div style="${TT_FONT}display:flex;align-items:center;gap:5px;margin-top:7px;padding-top:6px;` +
        `border-top:1px solid ${hexToRgba(THEME.cyan, 0.14)};font-size:10.5px;color:${THEME.textDim};">${miniRow}</div>` +
        `</div>`,
    }
  }

  /** 省份悬浮卡片：省名 + 该省城市平均热度 */
  const provinceTooltip = (info: { object?: unknown }): { html: string } | null => {
    const name = (info.object as ProvinceFeature | undefined)?.properties?.name
    if (!name) return null
    const agg = provinceAgg.value.get(name)
    return {
      html:
        `<div style="${TT_FONT}color:${THEME.text};font-weight:600;letter-spacing:1px;">${name}` +
        (agg
          ? `<span style="color:${THEME.cyanSoft};margin-left:10px;">均度 ${Math.round(agg.total / agg.count)}</span>`
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
      build: () => [
        createFlowArcLayer(flowPaths.value, widthTiers.value, opacity.value.arcs, hoverFlow.value),
      ],
    },
    {
      // 彗星尾迹单独成组（M4.1）：唯一随 progress 每帧重建的飞线组，
      // 静态弧线实例因此得以跨帧复用，不再被动画帧拖着重建
      id: 'comet',
      order: 37,
      visible: () => showArcs.value && flowPaths.value.length > 0,
      build: () => [
        createFlowCometLayer(
          buildCometPoints(flowPaths.value, progress.value, hoverFlow.value),
          opacity.value.arcs,
        ),
      ],
    },
  ]
}
