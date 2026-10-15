<template>
  <section class="panel">
    <h2 class="panel-title">航线运输监测</h2>
    <div class="stat-grid">
      <div v-for="stat in stats" :key="stat.label" class="stat-cell">
        <span class="stat-value">{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>
    <div class="heatmap-row">
      <span class="heatmap-label">城市热力图</span>
      <button
        type="button"
        class="toggle"
        :class="{ on: showHeatmap }"
        :aria-pressed="showHeatmap"
        aria-label="切换城市热力图"
        @click="emit('toggle-heatmap', !showHeatmap)"
      >
        <span class="knob" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { THEME } from '../config/theme'
import type { FlowOD } from '../mock/flows'

const props = defineProps<{ flows: FlowOD[]; showHeatmap: boolean }>()

const emit = defineEmits<{ 'toggle-heatmap': [enabled: boolean] }>()

const stats = computed(() => {
  const destCount = new Set(props.flows.map((f) => f.to)).size
  const totalVolume = props.flows.reduce((sum, f) => sum + f.volume, 0)
  return [
    { label: '飞线条数', value: String(props.flows.length) },
    { label: '覆盖城市', value: `${destCount} 座` },
    { label: '累计运量', value: totalVolume.toLocaleString() },
  ]
})
</script>

<style scoped>
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.stat-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border-radius: 8px;
  background: rgba(0, 229, 255, 0.05);
  border: 1px solid rgba(0, 229, 255, 0.12);
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: v-bind('THEME.cyan');
  text-shadow: 0 0 12px rgba(0, 229, 255, 0.5);
}

.stat-label {
  font-size: 12px;
  letter-spacing: 1px;
  color: v-bind('THEME.textDim');
}

.heatmap-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.heatmap-label {
  font-size: 14px;
  letter-spacing: 1px;
  color: v-bind('THEME.text');
}

.toggle {
  position: relative;
  width: 46px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid v-bind('THEME.borderGlow');
  background: rgba(0, 229, 255, 0.08);
  cursor: pointer;
  transition: all 0.25s ease;
}

.toggle .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: v-bind('THEME.textDim');
  transition: all 0.25s ease;
}

.toggle.on {
  background: rgba(0, 229, 255, 0.22);
  border-color: v-bind('THEME.cyan');
}

.toggle.on .knob {
  left: 24px;
  background: v-bind('THEME.cyan');
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.8);
}
</style>
