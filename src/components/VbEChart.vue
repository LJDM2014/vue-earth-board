<script setup lang="ts">
/**
 * VbEChart 薄封装（A4）：echarts/core 按需注册（Line/Bar/Pie + Grid/Tooltip/Legend/DataZoom + Canvas），
 * 职责仅 init / resize（ResizeObserver）/ setOption / dispose；页面只传 option。
 * 暗色观感通过注册 'vb-dark' 主题（透明底 + xb 色板）+ 各页 option 内轴样式实现。
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
])

/** deep-space 观感主题：透明底、统一色板（heat 青 / passenger 荧光绿 / economy 金 / 辅助紫红） */
echarts.registerTheme('vb-dark', {
  backgroundColor: 'transparent',
  textStyle: { color: '#a9c6d6' },
  color: ['#00e5ff', '#7bffd4', '#ffc24d', '#b47cff', '#ff7a6e'],
})

const props = defineProps<{
  option: EChartsCoreOption
  /** 容器高度（图表必须显式高度才能量测），默认 280px */
  height?: string
}>()

const el = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value, 'vb-dark')
  chart.setOption(props.option)
  ro = new ResizeObserver(() => chart?.resize())
  ro.observe(el.value)
})

watch(
  () => props.option,
  (opt) => chart?.setOption(opt, { notMerge: true }),
  { deep: true },
)

onUnmounted(() => {
  ro?.disconnect()
  ro = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="vb-echart" :style="{ height: height ?? '280px' }" />
</template>

<style scoped>
.vb-echart {
  width: 100%;
}
</style>
