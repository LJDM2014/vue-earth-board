<template>
  <div class="seg" role="group" aria-label="指标切换">
    <button
      v-for="(def, key) in METRIC_DEFS"
      :key="key"
      type="button"
      class="seg-btn"
      :class="{ active: modelValue === key }"
      @click="emit('update:modelValue', key)"
    >
      {{ def.short }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { METRIC_DEFS, type MetricKey } from '../mock/cities'

defineProps<{ modelValue: MetricKey }>()
const emit = defineEmits<{ 'update:modelValue': [metric: MetricKey] }>()
</script>

<style scoped>
.seg {
  display: flex;
  flex: none;
  padding: 2px;
  border-radius: 6px;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-cyan-rgb) / 0.06);
}

.seg-btn {
  flex: none;
  padding: 2px 7px;
  border: none;
  border-radius: 5px;
  background: transparent;
  font-size: 11px;
  letter-spacing: 0.5px;
  white-space: nowrap;
  color: var(--xb-text-dim);
  cursor: pointer;
  transition: all 0.2s ease;
}

.seg-btn.active {
  background: rgb(var(--xb-cyan-rgb) / 0.24);
  color: var(--xb-text);
  box-shadow: inset 0 0 8px rgb(var(--xb-cyan-rgb) / 0.2);
}
</style>
