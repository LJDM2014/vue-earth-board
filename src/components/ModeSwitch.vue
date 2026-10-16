<template>
  <div class="mode-switch" role="group" aria-label="投影模式切换">
    <button
      v-for="opt in OPTIONS"
      :key="opt.value"
      type="button"
      class="mode-btn"
      :class="{ active: mode === opt.value }"
      @click="emit('change', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ScreenMode } from '../composables/useMapLibre'

defineProps<{ mode: ScreenMode }>()

const emit = defineEmits<{ change: [mode: ScreenMode] }>()

const OPTIONS: { value: ScreenMode; label: string }[] = [
  { value: '3d', label: '3D 地球' },
  { value: '2d', label: '2D 平面' },
]
</script>

<style scoped>
.mode-switch {
  display: flex;
  padding: 4px;
  border-radius: 999px;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-panel-rgb) / 0.82);
  backdrop-filter: blur(6px);
  box-shadow: 0 0 18px rgb(var(--xb-cyan-rgb) / 0.12);
}

.mode-btn {
  padding: 8px 22px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--xb-text-dim);
  font-size: 14px;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.mode-btn:hover {
  color: var(--xb-cyan-soft);
}

.mode-btn.active {
  background: linear-gradient(180deg, rgb(var(--xb-cyan-rgb) / 0.28), rgb(var(--xb-cyan-rgb) / 0.12));
  color: var(--xb-text);
  box-shadow:
    inset 0 0 12px rgb(var(--xb-cyan-rgb) / 0.25),
    0 0 10px rgb(var(--xb-cyan-rgb) / 0.2);
}
</style>
