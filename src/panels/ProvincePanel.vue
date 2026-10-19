<template>
  <PanelChrome :title="`省份${METRIC_DEFS[metric].short}分布`">
    <VbEChart v-if="rows.length > 0" :option="option" height="252px" />
    <!-- 数据未就绪占位 -->
    <div v-else class="empty">数据加载中…</div>
  </PanelChrome>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { graphic, type EChartsCoreOption } from 'echarts/core'
import { METRIC_DEFS, type CityMetric, type MetricKey } from '../mock/cities'
import { aggregateProvinces } from '../utils/aggregate'
import VbEChart from '../components/VbEChart.vue'
import PanelChrome from './PanelChrome.vue'

const props = defineProps<{
  /** 当期全城市快照（App.vue 传 activeCities，value 随激活指标映射） */
  cities: CityMetric[]
  /** 当前激活指标：标题与聚合口径随之联动 */
  metric: MetricKey
}>()

/** 指标主色（与 vb-dark 色板及大屏指标配色一致：热度青 / 客流荧光绿 / 经济金） */
const METRIC_COLORS: Record<MetricKey, { hex: string; rgb: string }> = {
  heat: { hex: '#00e5ff', rgb: '0 229 255' },
  passenger: { hex: '#7bffd4', rgb: '123 255 212' },
  economy: { hex: '#ffc24d', rgb: '255 194 77' },
}

const rows = computed(() => aggregateProvinces(props.cities, props.metric))

const option = computed<EChartsCoreOption>(() => {
  const list = rows.value
  const total = list.reduce((sum, r) => sum + r.value, 0)
  const { hex, rgb } = METRIC_COLORS[props.metric]
  return {
    animationDuration: 700,
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name?: string; value?: number; data?: { count?: number } }
        const share = total > 0 && p.value !== undefined ? ((p.value / total) * 100).toFixed(1) : '0.0'
        return `${p.name ?? ''}\n${(p.value ?? 0).toLocaleString()}${METRIC_DEFS[props.metric].unit} · ${p.data?.count ?? 0} 城 · 占比 ${share}%`
      },
    },
    grid: { left: 4, right: 4, top: 20, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: list.map((r) => r.name),
      axisLine: { lineStyle: { color: 'rgb(169 198 214 / 0.25)' } },
      axisTick: { show: false },
      axisLabel: { color: '#a9c6d6', fontSize: 10, interval: 0, rotate: 45 },
    },
    yAxis: {
      type: 'value',
      show: false,
    },
    series: [
      {
        type: 'bar',
        barWidth: 13,
        // 淡色轨道底，与航线 TOP10 行的 track 观感呼应
        showBackground: true,
        backgroundStyle: { color: 'rgb(169 198 214 / 0.08)', borderRadius: 3 },
        label: {
          show: true,
          position: 'top',
          fontSize: 9,
          fontFamily: 'Consolas, monospace',
          color: '#c8dbe8',
          formatter: (p: unknown) => {
            const v = (p as { value?: number }).value ?? 0
            return v.toLocaleString()
          },
        },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: `rgb(${rgb} / 0.45)` } },
        data: list.map((r, i) => ({
          value: r.value,
          count: r.count,
          itemStyle: {
            // 前 3 名满饱和渐变收尾，其余同色系低透明收敛层次（纵向：上亮下暗）
            // borderRadius 必须用标量：数组形式会被 zrender 动画插值，notMerge 切换时插值目标丢失导致动画 clip 卡死每帧抛错
            borderRadius: 3,
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: i < 3 ? hex : `rgb(${rgb} / 0.42)` },
              { offset: 1, color: `rgb(${rgb} / ${i < 3 ? 0.16 : 0.06})` },
            ]),
          },
        })),
      },
    ],
  }
})
</script>

<style scoped>
.empty {
  height: 252px;
  display: grid;
  place-items: center;
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--xb-text-dim);
}
</style>
