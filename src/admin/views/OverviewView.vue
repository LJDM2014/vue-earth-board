<script setup lang="ts">
/**
 * 数据概览（A4）：KPI 卡 ×5 + 三指标趋势 / 城市 TOP10 / 航线运量 TOP10 / 客货运占比 / 省份覆盖。
 * 数据经 useAdminData 一次拉全量，切周期/切指标纯前端聚合零请求（docs/admin-module-plan.md §5.2）。
 */
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { EChartsCoreOption } from 'echarts/core'
import VbEChart from '../../components/VbEChart.vue'
import {
  useAdminData,
  metricSeries,
  topCities,
  topFlows,
  categoryShare,
  provinceCoverage,
} from '../composables/useAdminData'
import type { MetricKey } from '../types'

const { cities, flows, periods, updatedAt, loading, refresh } = useAdminData()

/** 联动筛选：TOP10 / 占比 / 航线图共享（缺省末期 + 经济总量，对齐计划 §5.2） */
const period = ref('')
const metric = ref<MetricKey>('economy')

const METRIC_LABEL: Record<MetricKey, string> = {
  heat: '热度',
  passenger: '客流',
  economy: '经济总量',
}
const METRIC_COLOR: Record<MetricKey, string> = {
  heat: '#00e5ff',
  passenger: '#7bffd4',
  economy: '#ffc24d',
}

onMounted(async () => {
  try {
    await refresh()
    period.value = periods.value[periods.value.length - 1] ?? ''
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '概览数据加载失败')
  }
})

const fmt = (v: number): string => v.toLocaleString('zh-CN')

/* ---------- KPI 卡 ---------- */

const dataPoints = computed(
  () => cities.value.reduce((sum, c) => sum + Object.keys(c.metrics).length, 0) * 3,
)
const kpis = computed(() => [
  { label: '城市数', value: fmt(cities.value.length), sub: '座' },
  { label: '航线 OD', value: fmt(flows.value.length), sub: '条' },
  { label: '周期数', value: fmt(periods.value.length), sub: '期' },
  { label: '指标数据点', value: fmt(dataPoints.value), sub: '个' },
  {
    label: '最近更新',
    value: updatedAt.value
      ? new Date(updatedAt.value).toLocaleString('zh-CN', { hour12: false })
      : '--',
    sub: '',
  },
])

/* ---------- 图表 option（轴样式统一 deep-space 观感） ---------- */

const AXIS_LABEL = { color: '#a9c6d6', fontSize: 12 }
const AXIS_LINE = { lineStyle: { color: 'rgba(0, 229, 255, 0.25)' } }
const SPLIT_LINE = { lineStyle: { color: 'rgba(0, 229, 255, 0.08)' } }

/** 三指标全国趋势：热度左轴（无量纲），客流/经济右轴（双 Y 轴） */
const trendOption = computed<EChartsCoreOption>(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0, textStyle: AXIS_LABEL },
  grid: { left: 56, right: 68, top: 36, bottom: 28 },
  xAxis: { type: 'category', data: periods.value, axisLabel: AXIS_LABEL, axisLine: AXIS_LINE },
  yAxis: [
    {
      type: 'value',
      name: '热度',
      axisLabel: AXIS_LABEL,
      splitLine: SPLIT_LINE,
      nameTextStyle: AXIS_LABEL,
    },
    {
      type: 'value',
      name: '万人次 / 亿元',
      axisLabel: AXIS_LABEL,
      splitLine: { show: false },
      nameTextStyle: AXIS_LABEL,
    },
  ],
  series: (['heat', 'passenger', 'economy'] as MetricKey[]).map((m) => ({
    name: METRIC_LABEL[m],
    type: 'line',
    smooth: true,
    symbolSize: 6,
    yAxisIndex: m === 'heat' ? 0 : 1,
    itemStyle: { color: METRIC_COLOR[m] },
    lineStyle: { width: 2 },
    data: metricSeries(cities.value, periods.value, m),
  })),
}))

/** 城市 TOP10（横向条形，随联动筛选刷新） */
const cityTopOption = computed<EChartsCoreOption>(() => {
  const data = topCities(cities.value, period.value, metric.value, 10)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: unknown) => fmt(Number(v)),
    },
    grid: { left: 56, right: 40, top: 8, bottom: 24 },
    xAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    yAxis: {
      type: 'category',
      inverse: true,
      data: data.map((d) => d.name),
      axisLabel: AXIS_LABEL,
      axisLine: AXIS_LINE,
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 14,
        itemStyle: {
          color: METRIC_COLOR[metric.value],
          borderRadius: [0, 7, 7, 0],
        },
        data: data.map((d) => d.value),
      },
    ],
  }
})

/** 航线运量 TOP10（客青 / 货金着色区分） */
const flowTopOption = computed<EChartsCoreOption>(() => {
  const data = topFlows(flows.value, period.value, 10)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: unknown) => `${fmt(Number(v))} 万人次`,
    },
    grid: { left: 104, right: 40, top: 8, bottom: 24 },
    xAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    yAxis: {
      type: 'category',
      inverse: true,
      data: data.map((d) => d.name),
      axisLabel: AXIS_LABEL,
      axisLine: AXIS_LINE,
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 14,
        itemStyle: { borderRadius: [0, 7, 7, 0] },
        data: data.map((d) => ({
          value: d.value,
          itemStyle: { color: d.category === 'passenger' ? '#00e5ff' : '#ffc24d' },
        })),
      },
    ],
  }
})

/** 客货运量占比（环形饼，随周期联动） */
const shareOption = computed<EChartsCoreOption>(() => {
  const s = categoryShare(flows.value, period.value)
  return {
    tooltip: {
      trigger: 'item',
      valueFormatter: (v: unknown) => `${fmt(Number(v))} 万人次`,
    },
    legend: { bottom: 0, textStyle: AXIS_LABEL },
    series: [
      {
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['50%', '44%'],
        label: { color: '#a9c6d6', formatter: '{b}: {d}%' },
        itemStyle: { borderColor: '#0a1526', borderWidth: 2 },
        data: [
          { name: '客运', value: s.passenger, itemStyle: { color: '#7bffd4' } },
          { name: '货运', value: s.cargo, itemStyle: { color: '#ffc24d' } },
        ],
      },
    ],
  }
})

/** 省份覆盖城市数（31 省竖向条形 + 内置 dataZoom 平移） */
const provinceCount = computed(() => new Set(cities.value.map((c) => c.province)).size)
const coverageOption = computed<EChartsCoreOption>(() => {
  const data = provinceCoverage(cities.value)
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: unknown) => `${fmt(Number(v))} 城`,
    },
    grid: { left: 40, right: 24, top: 12, bottom: 58 },
    dataZoom: [{ type: 'inside', xAxisIndex: 0 }],
    xAxis: {
      type: 'category',
      data: data.map((d) => d.name),
      axisLabel: { ...AXIS_LABEL, rotate: 45 },
      axisLine: AXIS_LINE,
    },
    yAxis: { type: 'value', minInterval: 1, axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: [
      {
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { color: '#00e5ff', opacity: 0.85, borderRadius: [4, 4, 0, 0] },
        data: data.map((d) => d.value),
      },
    ],
  }
})
</script>

<template>
  <section v-loading="loading" class="page overview">
    <div class="kpi-row">
      <div v-for="k in kpis" :key="k.label" class="card kpi">
        <span class="kpi-label">{{ k.label }}</span>
        <span class="kpi-value">{{ k.value }}<i v-if="k.sub" class="kpi-sub">{{ k.sub }}</i></span>
      </div>
    </div>

    <div class="card filter-row">
      <span class="filter-label">联动筛选</span>
      <el-select v-model="period" class="period-select">
        <el-option v-for="p in periods" :key="p" :label="p" :value="p" />
      </el-select>
      <el-radio-group v-model="metric">
        <el-radio-button value="heat">热度</el-radio-button>
        <el-radio-button value="passenger">客流</el-radio-button>
        <el-radio-button value="economy">经济总量</el-radio-button>
      </el-radio-group>
      <span class="filter-note">作用于城市 TOP10 / 客货运占比 / 航线运量 TOP10</span>
    </div>

    <div class="card chart-wide">
      <h3>三指标全国趋势（近 {{ periods.length }} 期）</h3>
      <VbEChart :option="trendOption" height="300px" />
    </div>

    <div class="charts-grid">
      <div class="card">
        <h3>城市{{ METRIC_LABEL[metric] }} TOP10（{{ period }}）</h3>
        <VbEChart :option="cityTopOption" height="320px" />
      </div>
      <div class="card">
        <h3>航线运量 TOP10（{{ period }}）</h3>
        <VbEChart :option="flowTopOption" height="320px" />
      </div>
      <div class="card">
        <h3>客货运量占比（{{ period }}）</h3>
        <VbEChart :option="shareOption" height="300px" />
      </div>
      <div class="card">
        <h3>省份覆盖城市数（共 {{ provinceCount }} 省，滚轮平移查看）</h3>
        <VbEChart :option="coverageOption" height="300px" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpi-label {
  font-size: 12px;
  color: var(--xb-text-dim);
}

.kpi-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--xb-cyan);
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 12px rgba(0, 229, 255, 0.35);
}

.kpi-sub {
  font-style: normal;
  font-size: 12px;
  font-weight: 400;
  color: var(--xb-text-dim);
  margin-left: 4px;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  font-size: 13px;
  color: var(--xb-text-dim);
}

.period-select {
  width: 130px;
}

.filter-note {
  font-size: 12px;
  color: var(--xb-text-dim);
  margin-left: auto;
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 1100px) {
  .kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>
