<template>
  <PanelChrome title="航线运输监测">
    <div class="stat-grid">
      <div v-for="stat in stats" :key="stat.label" class="stat-cell">
        <span class="stat-value">
          <CountNumber :value="stat.value" /><i class="stat-unit">{{ stat.unit }}</i>
        </span>
        <span v-if="stat.trend" class="trend" :class="stat.trend.up ? 'up' : 'down'">
          {{ stat.trend.up ? '▲' : '▼' }} {{ Math.abs(stat.trend.pct).toFixed(1) }}%
        </span>
        <span v-else class="trend flat">— 持平</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>

    <div class="flow-head">
      <span class="flow-head-title">航线运量 TOP8</span>
      <span class="legend">
        <i class="dot passenger" />客运
        <i class="dot cargo" />货运
      </span>
    </div>
    <ol v-if="topFlows.length > 0" class="flow-list">
      <li
        v-for="(flow, i) in topFlows"
        :key="flowKey(flow)"
        class="flow-item"
        :class="{ active: hoverKey === flowKey(flow) }"
        @mouseenter="onHover(flow)"
        @mouseleave="onHover(null)"
      >
        <span class="idx">{{ i + 1 }}</span>
        <i class="dot" :class="flow.category" />
        <span class="od">{{ flow.from }} → {{ flow.to }}</span>
        <div class="vol-track">
          <div class="vol" :class="flow.category" :style="{ width: `${(flow.volume / maxVolume) * 100}%` }" />
        </div>
        <span class="vol-num"><CountNumber :value="flow.volume" /></span>
      </li>
    </ol>
    <!-- 数据未就绪骨架占位 -->
    <ol v-else class="flow-list" aria-hidden="true">
      <li v-for="i in 6" :key="i" class="flow-item skeleton">
        <span class="idx shimmer" />
        <span class="od shimmer" />
        <div class="vol-track shimmer" />
      </li>
    </ol>
  </PanelChrome>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FlowOD } from '../mock/flows'
import { flowKey } from '../map/layers/flightArcs'
import CountNumber from './CountNumber.vue'
import PanelChrome from './PanelChrome.vue'

const props = defineProps<{
  /** 当期航线 OD（volume 为时序生成当期值） */
  flows: FlowOD[]
  /** 上一期航线 OD（M6.3 环比口径，首期无上期为 null） */
  prevFlows: FlowOD[] | null
}>()

const emit = defineEmits<{
  /** hover 航线行 → 地图弧线高亮（M6.3 联动） */
  'hover-flow': [key: string | null]
}>()

/** 环比（口径同 M6.2）：波动 <0.05% 视为持平不展示箭头 */
function pctOf(curr: number, prev: number | undefined): { up: boolean; pct: number } | null {
  if (prev === undefined || !(prev > 0)) return null
  const pct = ((curr - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return null
  return { up: pct > 0, pct }
}

const stats = computed(() => {
  if (props.flows.length === 0) {
    return [
      { label: '飞线条数', value: 0, unit: '条', trend: null },
      { label: '覆盖城市', value: 0, unit: '座', trend: null },
      { label: '累计运量', value: 0, unit: '万人次', trend: null },
    ]
  }
  const prev = props.prevFlows
  const destCount = new Set(props.flows.map((f) => f.to)).size
  const totalVolume = props.flows.reduce((sum, f) => sum + f.volume, 0)
  const prevDest = prev ? new Set(prev.map((f) => f.to)).size : undefined
  const prevTotal = prev ? prev.reduce((sum, f) => sum + f.volume, 0) : undefined
  return [
    { label: '飞线条数', value: props.flows.length, unit: '条', trend: pctOf(props.flows.length, prev?.length) },
    { label: '覆盖城市', value: destCount, unit: '座', trend: pctOf(destCount, prevDest) },
    { label: '累计运量', value: totalVolume, unit: '万人次', trend: pctOf(totalVolume, prevTotal) },
  ]
})

/** 运量 TOP8 榜单（M6.3 右侧面板核心内容） */
const topFlows = computed(() => [...props.flows].sort((a, b) => b.volume - a.volume).slice(0, 8))
const maxVolume = computed(() => topFlows.value[0]?.volume ?? 1)

const hoverKey = ref<string | null>(null)
function onHover(flow: FlowOD | null) {
  hoverKey.value = flow ? flowKey(flow) : null
  emit('hover-flow', hoverKey.value)
}
</script>

<style scoped>
/* ── 指标卡 ── */
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
  /* 18px + nowrap：340 面板三等分卡内宽 ~88px，「29,191万人次」20px 会换行撑高卡片 */
  font-size: 18px;
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

/* ── TOP8 榜单 ── */
.flow-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 0 8px;
}

.flow-head-title {
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--xb-cyan-soft);
}

.legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--xb-text-dim);
}

.dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.dot.passenger {
  background: var(--xb-cyan);
  box-shadow: 0 0 5px var(--xb-cyan);
}

.dot.cargo {
  background: var(--xb-gold);
  box-shadow: 0 0 5px var(--xb-gold);
}

.flow-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 288px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(var(--xb-cyan-rgb) / 0.35) transparent;
}

.flow-list::-webkit-scrollbar {
  width: 4px;
}

.flow-list::-webkit-scrollbar-thumb {
  border-radius: 2px;
  background: rgb(var(--xb-cyan-rgb) / 0.35);
}

.flow-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 6px;
  border-radius: 5px;
  transition: all 0.2s ease;
}

.flow-item.active,
.flow-item:not(.skeleton):hover {
  background: rgb(var(--xb-cyan-rgb) / 0.08);
  box-shadow: 0 0 0 1px rgb(var(--xb-border-rgb) / 0.22);
}

.idx {
  flex: none;
  width: 16px;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  color: var(--xb-text-dim);
  font-variant-numeric: tabular-nums;
}

.od {
  flex: none;
  width: 108px;
  font-size: 12px;
  letter-spacing: 0.5px;
  color: var(--xb-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vol-track {
  flex: 1;
  min-width: 0;
  height: 6px;
  border-radius: 3px;
  background: rgb(var(--xb-cyan-rgb) / 0.07);
  overflow: hidden;
}

.vol {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.vol.passenger {
  background: linear-gradient(90deg, rgb(var(--xb-cyan-rgb) / 0.35), var(--xb-cyan));
  box-shadow: 0 0 6px rgb(var(--xb-cyan-rgb) / 0.45);
}

.vol.cargo {
  background: linear-gradient(90deg, rgb(var(--xb-gold-rgb) / 0.35), var(--xb-gold));
  box-shadow: 0 0 6px rgb(var(--xb-gold-rgb) / 0.4);
}

.vol-num {
  flex: none;
  width: 40px;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--xb-cyan-soft);
}

/* 骨架 */
.flow-item.skeleton {
  gap: 10px;
}

.skeleton .idx {
  width: 16px;
  height: 12px;
  border-radius: 3px;
}

.skeleton .od {
  height: 12px;
  border-radius: 3px;
}

.skeleton .vol-track {
  height: 8px;
}

.shimmer {
  background: linear-gradient(
    90deg,
    rgb(var(--xb-cyan-rgb) / 0.06) 25%,
    rgb(var(--xb-cyan-rgb) / 0.16) 50%,
    rgb(var(--xb-cyan-rgb) / 0.06) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}
</style>
