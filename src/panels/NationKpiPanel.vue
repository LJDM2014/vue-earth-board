<template>
  <PanelChrome title="全国总览">
    <div class="stat-grid">
      <div v-for="stat in stats" :key="stat.label" class="stat-cell">
        <span class="stat-value">
          <CountNumber :value="stat.value" /><i v-if="stat.unit" class="stat-unit">{{ stat.unit }}</i>
        </span>
        <span v-if="stat.trend" class="trend" :class="stat.trend.up ? 'up' : 'down'">
          {{ stat.trend.up ? '▲' : '▼' }} {{ Math.abs(stat.trend.pct).toFixed(1) }}%
        </span>
        <span v-else class="trend flat">— 持平</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>
  </PanelChrome>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { METRIC_DEFS, type CityMetric, type MetricKey } from '../mock/cities'
import { metricTotal } from '../utils/aggregate'
import CountNumber from './CountNumber.vue'
import PanelChrome from './PanelChrome.vue'

const props = defineProps<{
  /** 当期全城市快照 */
  cities: CityMetric[]
  /** 上一期城市快照（环比口径，首期无上期为 null） */
  prevCities: CityMetric[] | null
}>()

const METRIC_KEYS: MetricKey[] = ['heat', 'passenger', 'economy']

/** 环比（口径同 FlowStatPanel）：波动 <0.05% 视为持平不展示箭头 */
function pctOf(curr: number, prev: number | undefined): { up: boolean; pct: number } | null {
  if (prev === undefined || !(prev > 0)) return null
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return null
  return { up: pct > 0, pct }
}

/** 三指标全国总量 + 环比一次算好 */
const stats = computed(() =>
  METRIC_KEYS.map((metric) => {
    const value = metricTotal(props.cities, metric)
    const prev = props.prevCities ? metricTotal(props.prevCities, metric) : undefined
    return {
      label: `${METRIC_DEFS[metric].short}总量`,
      value,
      unit: METRIC_DEFS[metric].unit,
      trend: pctOf(value, prev),
    }
  }),
)
</script>

<style scoped>
/* 视觉模式与 FlowStatPanel 一致：三等分卡 + 动数 + 环比箭头 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 9px 4px 8px;
  border-radius: 6px;
  background: rgb(var(--xb-cyan-rgb) / 0.05);
  border: 1px solid rgb(var(--xb-cyan-rgb) / 0.12);
}

.stat-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
  /* 17px + nowrap：340 面板三等分卡内宽 ~88px，大数值千分位不换行撑高卡片 */
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--xb-cyan);
  text-shadow: 0 0 12px rgb(var(--xb-cyan-rgb) / 0.5);
}

.stat-unit {
  font-style: normal;
  font-size: 9px;
  font-weight: 400;
  color: var(--xb-text-dim);
}

.trend {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.trend.up {
  color: #6ef2c8;
}

.trend.down {
  color: #ff9c5b;
}

.trend.flat {
  color: var(--xb-text-dim);
}

.stat-label {
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--xb-text-dim);
}
</style>
