<template>
  <section class="panel">
    <h2 class="panel-title">城市热度 TOP5</h2>
    <ol class="city-list">
      <li v-for="(city, i) in top5" :key="city.name" class="city-item">
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
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { THEME } from '../config/theme'
import type { CityMetric } from '../mock/cities'

const props = defineProps<{ cities: CityMetric[] }>()

const top5 = computed(() => [...props.cities].sort((a, b) => b.value - a.value).slice(0, 5))
const maxValue = computed(() => top5.value[0]?.value ?? 1)

/** 榜单排名配色：金 → 青系渐降 */
const rankColors = [THEME.gold, '#9fe8ff', '#7be8ff', '#5fd4f0', '#48b8d8']
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
</style>
