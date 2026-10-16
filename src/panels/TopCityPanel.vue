<template>
  <PanelChrome :title="`${METRIC_DEFS[metric].label} TOP5`">
    <template #extra>
      <MetricSwitch :model-value="metric" @update:model-value="emit('change-metric', $event)" />
    </template>
    <ol v-if="rows.length > 0" class="city-list">
      <li
        v-for="row in rows"
        :key="row.city.name"
        :ref="setRowRef"
        class="city-item"
        :class="{ active: isActive(row.city) }"
        @mouseenter="emit('hover-city', row.city.name)"
        @mouseleave="emit('hover-city', null)"
      >
        <span
          v-if="row.top3"
          class="medal"
          :style="{ '--medal': row.medal }"
        >
          <i>{{ row.index + 1 }}</i>
        </span>
        <span v-else class="rank">{{ row.index + 1 }}</span>
        <span class="city-meta">
          <span class="name">{{ row.city.name }}</span>
          <span class="sub">
            {{ provinceShort(row.city.province) }} · {{ METRIC_DEFS[secondaryMetric].short }}
            {{ row.city.indicators[secondaryMetric].toLocaleString() }}
          </span>
        </span>
        <div class="bar-track">
          <div
            class="bar"
            :class="row.index === 0 ? 'bar-gold' : 'bar-cyan'"
            :style="{ width: `${(row.city.value / maxValue) * 100}%` }"
          />
          <i class="ticks" aria-hidden="true" />
          <i class="sweep" aria-hidden="true" />
        </div>
        <span class="value-col">
          <span class="value">
            <CountNumber :value="row.city.value" />
            <i v-if="METRIC_DEFS[metric].unit" class="unit">{{ METRIC_DEFS[metric].unit }}</i>
          </span>
          <span
            v-if="row.trend"
            class="trend"
            :class="row.trend.up ? 'up' : 'down'"
          >
            {{ row.trend.up ? '▲' : '▼' }} {{ Math.abs(row.trend.pct).toFixed(1) }}%
          </span>
        </span>
      </li>
    </ol>
    <!-- 数据未就绪骨架占位（M3.5 首屏体验） -->
    <ol v-else class="city-list" aria-hidden="true">
      <li v-for="i in 5" :key="i" class="city-item skeleton">
        <span class="rank shimmer" />
        <span class="city-meta">
          <span class="name shimmer" />
          <span class="sub shimmer" />
        </span>
        <div class="bar-track shimmer" />
      </li>
    </ol>
  </PanelChrome>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { THEME } from '../config/theme'
import { METRIC_DEFS, provinceShort, type CityMetric, type MetricKey } from '../mock/cities'
import CountNumber from './CountNumber.vue'
import MetricSwitch from './MetricSwitch.vue'
import PanelChrome from './PanelChrome.vue'

const props = defineProps<{
  cities: CityMetric[]
  /** 当前激活指标（M5.2）：标题/单位/条形图随指标联动 */
  metric: MetricKey
  /** 城市近 N 期历史（M6.2 环比口径：倒数第二期 vs 当期） */
  history: Map<string, number[]>
  /** 联动高亮的城市名（点击地图散点设置，M3.3） */
  highlightedCity: string | null
  /** 联动高亮的省份名（点击省界设置，M3.3） */
  highlightProvince: string | null
}>()

const emit = defineEmits<{
  'hover-city': [name: string | null]
  'change-metric': [metric: MetricKey]
}>()

const top5 = computed(() => [...props.cities].sort((a, b) => b.value - a.value).slice(0, 5))
const maxValue = computed(() => top5.value[0]?.value ?? 1)
/** 次指标微缩行（M6.2）：激活热度时展示客流，否则展示热度 */
const secondaryMetric = computed<MetricKey>(() => (props.metric === 'heat' ? 'passenger' : 'heat'))

/** 金银铜徽章色（TOP3 菱形徽章） */
const MEDAL_COLORS = [THEME.gold, '#d8e6f2', '#e0a878']

/** 环比（M6.2）：当期值 vs 历史倒数第二期，波动 <0.05% 视为持平不展示 */
function trendOf(city: CityMetric): { up: boolean; pct: number } | null {
  const h = props.history.get(city.name)
  if (!h || h.length < 2) return null
  const prev = h[h.length - 2]
  if (!(prev > 0)) return null
  const pct = ((city.value - prev) / prev) * 100
  if (Math.abs(pct) < 0.05) return null
  return { up: pct > 0, pct }
}

/** 行渲染模型：名次徽章/条色/环比一次算好 */
const rows = computed(() =>
  top5.value.map((city, index) => ({
    city,
    index,
    top3: index < 3,
    medal: MEDAL_COLORS[index],
    trend: trendOf(city),
  })),
)

/** 高亮判定：城市名直击 或 所属省份被点中 */
function isActive(city: CityMetric): boolean {
  return (
    city.name === props.highlightedCity ||
    (props.highlightProvince !== null && city.province === props.highlightProvince)
  )
}

/** 联动高亮时滚动到可视区（M3.3） */
const rowRefs = new Map<string, HTMLElement>()
function setRowRef(el: unknown, key: unknown) {
  if (el instanceof HTMLElement) rowRefs.set(String(key), el)
}
watch(
  () => [props.highlightedCity, props.highlightProvince],
  async () => {
    if (!props.highlightedCity && !props.highlightProvince) return
    await nextTick()
    const hit = top5.value.find((c) => isActive(c))
    if (hit) rowRefs.get(hit.name)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)

/** FLIP 排名过渡（M6.2）：指标切换时榜单重排，按位移差补间平滑移动 */
watch(top5, async () => {
  const before = new Map<string, number>()
  for (const [name, el] of rowRefs) before.set(name, el.getBoundingClientRect().top)
  await nextTick()
  for (const [name, el] of rowRefs) {
    const prevTop = before.get(name)
    if (prevTop === undefined) continue
    const dy = prevTop - el.getBoundingClientRect().top
    if (Math.abs(dy) < 1) continue
    el.style.transition = 'none'
    el.style.transform = `translateY(${dy}px)`
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)'
      el.style.transform = ''
    })
  }
})
</script>

<style scoped>
.city-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.city-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  transition: all 0.25s ease;
  will-change: transform;
}

/* 面板联动高亮：地图点击 / 省份命中（M3.3），box-shadow 描边避免布局位移 */
.city-item.active {
  background: rgb(var(--xb-cyan-rgb) / 0.1);
  box-shadow:
    0 0 0 1px rgb(var(--xb-border-rgb) / 0.22),
    0 0 12px rgb(var(--xb-cyan-rgb) / 0.18);
}

.city-item:not(.skeleton):hover {
  background: rgb(var(--xb-cyan-rgb) / 0.08);
}

/* ── 名次徽章：TOP3 菱形（rotate 45°），4-5 名暗色编号 ── */
.medal {
  flex: none;
  width: 17px;
  height: 17px;
  display: grid;
  place-items: center;
  transform: rotate(45deg);
  border-radius: 3px;
  border: 1px solid var(--medal);
  background: color-mix(in srgb, var(--medal) 20%, transparent);
  box-shadow: 0 0 9px color-mix(in srgb, var(--medal) 55%, transparent);
}

.medal i {
  transform: rotate(-45deg);
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
  color: var(--medal);
  text-shadow: 0 0 6px color-mix(in srgb, var(--medal) 70%, transparent);
}

.rank {
  flex: none;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--xb-text-dim);
  background: rgb(var(--xb-cyan-rgb) / 0.06);
}

/* ── 城市名 + 省份/次指标微缩 ── */
.city-meta {
  flex: none;
  /* 84px：容纳「广东 · 客流 2,046」级别副行不截断（74px 会打出省略号） */
  width: 84px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.name {
  font-size: 14px;
  color: var(--xb-text);
  letter-spacing: 1px;
  white-space: nowrap;
}

.sub {
  font-size: 10px;
  color: var(--xb-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: normal;
}

/* ── 分段刻度条 ── */
.bar-track {
  flex: 1;
  min-width: 0;
  position: relative;
  height: 9px;
  border-radius: 3px;
  background: rgb(var(--xb-cyan-rgb) / 0.07);
  overflow: hidden;
}

.bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.bar-cyan {
  background: linear-gradient(90deg, rgb(var(--xb-cyan-rgb) / 0.35), var(--xb-cyan));
  box-shadow: 0 0 8px rgb(var(--xb-cyan-rgb) / 0.5);
}

.bar-gold {
  background: linear-gradient(90deg, rgb(var(--xb-gold-rgb) / 0.4), var(--xb-gold));
  box-shadow: 0 0 8px rgb(var(--xb-gold-rgb) / 0.45);
}

/* 10 格分段刻度（盖在填充色上的深色分隔线） */
.ticks {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    transparent 0,
    transparent calc(10% - 1.5px),
    rgb(var(--xb-bg-deep-rgb) / 0.85) calc(10% - 1.5px),
    rgb(var(--xb-bg-deep-rgb) / 0.85) 10%
  );
  pointer-events: none;
}

/* 头部流光扫过 */
.sweep {
  position: absolute;
  top: 0;
  left: 0;
  width: 20px;
  height: 100%;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0));
  animation: bar-sweep 2.6s ease-in-out infinite;
  pointer-events: none;
}

@keyframes bar-sweep {
  from {
    transform: translateX(-24px);
  }
  to {
    transform: translateX(320px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sweep {
    animation: none;
    opacity: 0;
  }
}

/* ── 数值列：主数字 + 环比 ── */
.value-col {
  flex: none;
  width: 92px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.value {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 2px;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: var(--xb-cyan-soft);
}

.unit {
  font-style: normal;
  font-size: 10px;
  color: var(--xb-text-dim);
}

.trend {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

.trend.up {
  color: #6ef2c8;
}

.trend.down {
  color: #ff9c5b;
}

/* 骨架占位（数据未就绪） */
.skeleton .name,
.skeleton .sub {
  height: 10px;
  border-radius: 3px;
  display: block;
}

.skeleton .name {
  height: 13px;
}

.skeleton .rank {
  background: none;
}

.skeleton .sub {
  width: 56px;
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
