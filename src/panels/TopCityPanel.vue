<template>
  <section class="panel">
    <h2 class="panel-title">城市热度 TOP5</h2>
    <ol v-if="top5.length > 0" class="city-list">
      <li
        v-for="(city, i) in top5"
        :key="city.name"
        :ref="setRowRef"
        class="city-item"
        :class="{ active: isActive(city) }"
        @mouseenter="emit('hover-city', city.name)"
        @mouseleave="emit('hover-city', null)"
      >
        <span
          class="rank"
          :style="{
            color: rankColors[i] ?? THEME.textDim,
            borderColor: rankColors[i] ?? THEME.textDim,
          }"
        >
          {{ i + 1 }}
        </span>
        <span class="name">{{ city.name }}</span>
        <div class="bar-track">
          <div class="bar" :style="{ width: `${(city.value / maxValue) * 100}%` }" />
        </div>
        <span class="value">{{ city.value }}</span>
      </li>
    </ol>
    <!-- 数据未就绪骨架占位（M3.5 首屏体验） -->
    <ol v-else class="city-list" aria-hidden="true">
      <li v-for="i in 5" :key="i" class="city-item skeleton">
        <span class="rank shimmer" />
        <span class="name shimmer" />
        <div class="bar-track shimmer" />
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { THEME } from '../config/theme'
import type { CityMetric } from '../mock/cities'

const props = defineProps<{
  cities: CityMetric[]
  /** 联动高亮的城市名（点击地图散点设置，M3.3） */
  highlightedCity: string | null
  /** 联动高亮的省份名（点击省界设置，M3.3） */
  highlightProvince: string | null
}>()

const emit = defineEmits<{ 'hover-city': [name: string | null] }>()

const top5 = computed(() => [...props.cities].sort((a, b) => b.value - a.value).slice(0, 5))
const maxValue = computed(() => top5.value[0]?.value ?? 1)

/** 榜单排名配色：金 → 青系渐降 */
const rankColors = [THEME.gold, '#9fe8ff', '#7be8ff', '#5fd4f0', '#48b8d8']

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
</script>

<style scoped>
.city-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.city-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 6px;
  transition: all 0.25s ease;
}

/* 面板联动高亮：地图点击 / 省份命中（M3.3），box-shadow 描边避免布局位移 */
.city-item.active {
  background: rgba(0, 229, 255, 0.1);
  box-shadow:
    0 0 0 1px v-bind('THEME.borderGlow'),
    0 0 12px rgba(0, 229, 255, 0.18);
}

.city-item:not(.skeleton):hover {
  background: rgba(0, 229, 255, 0.08);
}

.rank {
  flex: none;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 1px solid;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
}

.name {
  flex: none;
  width: 62px;
  font-size: 14px;
  color: v-bind('THEME.text');
  letter-spacing: 1px;
}

.bar-track {
  flex: 1;
  min-width: 0;
  height: 8px;
  border-radius: 4px;
  background: rgba(0, 229, 255, 0.08);
  overflow: hidden;
}

.bar {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, rgba(0, 229, 255, 0.35), v-bind('THEME.cyan'));
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.5);
  transition: width 0.4s ease;
}

.value {
  flex: none;
  width: 44px;
  text-align: right;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: v-bind('THEME.cyanSoft');
}

/* 骨架占位（数据未就绪） */
.skeleton .name {
  height: 14px;
  border-radius: 3px;
}

.skeleton .rank {
  border: none;
}

.shimmer {
  background: linear-gradient(
    90deg,
    rgba(0, 229, 255, 0.06) 25%,
    rgba(0, 229, 255, 0.16) 50%,
    rgba(0, 229, 255, 0.06) 75%
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
