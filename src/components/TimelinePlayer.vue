<template>
  <div v-if="periods.length > 0" class="timeline" role="group" aria-label="时间轴播放器">
    <button
      type="button"
      class="play-btn"
      :aria-label="playing ? '暂停播放' : '开始播放'"
      @click="togglePlay"
    >
      <span v-if="!playing" class="glyph">▶</span>
      <span v-else class="glyph pause">❚❚</span>
    </button>
    <input
      v-model.number="index"
      class="slider"
      type="range"
      :min="0"
      :max="periods.length - 1"
      step="1"
      :aria-valuetext="periods[index]"
      aria-label="选择数据周期"
    />
    <span class="period-label">{{ periods[index] }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Period } from '../services/dataSource'

const props = defineProps<{
  /** 全部可选周期（升序） */
  periods: Period[]
  /** 当前周期（v-model） */
  modelValue: Period
}>()

const emit = defineEmits<{ 'update:modelValue': [period: Period] }>()

/** 自动播放步进间隔（毫秒） */
const PLAY_INTERVAL = 2600

const playing = ref(false)
let timer: number | undefined

/** 当前周期下标：双向桥接 modelValue */
const index = computed({
  get: () => Math.max(props.periods.indexOf(props.modelValue), 0),
  set: (v: number) => {
    const next = props.periods[v]
    if (next) emit('update:modelValue', next)
  },
})

function togglePlay() {
  playing.value = !playing.value
}

watch(playing, (on) => {
  window.clearInterval(timer)
  if (!on) return
  timer = window.setInterval(() => {
    // 循环步进：末尾回到第一期，适配展厅轮播场景
    index.value = (index.value + 1) % props.periods.length
  }, PLAY_INTERVAL)
})

onUnmounted(() => window.clearInterval(timer))
</script>

<style scoped>
.timeline {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 560px;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-panel-rgb) / 0.82);
  backdrop-filter: blur(6px);
  box-shadow: 0 0 18px rgb(var(--xb-cyan-rgb) / 0.12);
}

.play-btn {
  flex: none;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-cyan-rgb) / 0.1);
  color: var(--xb-cyan);
  cursor: pointer;
  transition: all 0.25s ease;
}

.play-btn:hover {
  background: rgb(var(--xb-cyan-rgb) / 0.22);
  box-shadow: 0 0 12px rgb(var(--xb-cyan-rgb) / 0.45);
}

.glyph {
  font-size: 12px;
  line-height: 1;
}

.glyph.pause {
  font-size: 9px;
  letter-spacing: 1px;
}

.slider {
  flex: 1;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(90deg, rgb(var(--xb-cyan-rgb) / 0.35), rgb(var(--xb-cyan-rgb) / 0.1));
  outline: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--xb-cyan);
  border: 2px solid #eafcff;
  box-shadow: 0 0 10px rgb(var(--xb-cyan-rgb) / 0.8);
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--xb-cyan);
  border: 2px solid #eafcff;
  box-shadow: 0 0 10px rgb(var(--xb-cyan-rgb) / 0.8);
}

.period-label {
  flex: none;
  min-width: 64px;
  text-align: center;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  color: var(--xb-cyan-soft);
}
</style>
