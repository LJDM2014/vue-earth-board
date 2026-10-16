<template>
  <div class="region-nav" role="group" aria-label="区域快捷导航">
    <button
      v-for="preset in CAMERA_PRESETS"
      :key="preset.id"
      type="button"
      class="nav-btn"
      :class="{ active: activeId === preset.id }"
      @click="emit('fly', preset)"
    >
      {{ preset.label }}
    </button>
    <span class="divider" aria-hidden="true" />
    <button
      type="button"
      class="nav-btn tour-btn"
      :class="{ active: tourActive }"
      :aria-label="tourActive ? '停止轮播' : '开启轮播模式'"
      @click="emit('toggle-tour')"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          v-if="!tourActive"
          d="M5 3.2v9.6l8-4.8Z"
          fill="currentColor"
        />
        <template v-else>
          <rect x="4.2" y="4.2" width="7.6" height="7.6" rx="1.2" fill="currentColor" />
        </template>
      </svg>
      <span v-if="tourActive" class="tour-tip">
        <i class="pulse" />轮播中 · {{ tourLabel }}（ESC 退出）
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { CAMERA_PRESETS, type CameraPreset } from '../config/cameras'

defineProps<{
  /** 当前高亮机位 id（手动点击或轮播推进） */
  activeId: string | null
  /** 轮播进行中 */
  tourActive: boolean
  /** 轮播当前机位名 */
  tourLabel: string
}>()

const emit = defineEmits<{
  fly: [preset: CameraPreset]
  'toggle-tour': []
}>()
</script>

<style scoped>
.region-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 12px;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-panel-rgb) / 0.82);
  backdrop-filter: blur(6px);
  box-shadow: 0 0 18px rgb(var(--xb-cyan-rgb) / 0.12);
}

.nav-btn {
  padding: 5px 13px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font-size: 13px;
  letter-spacing: 2px;
  color: var(--xb-text-dim);
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-btn:hover {
  color: var(--xb-text);
  background: rgb(var(--xb-cyan-rgb) / 0.12);
}

.nav-btn.active {
  color: var(--xb-cyan);
  background: rgb(var(--xb-cyan-rgb) / 0.16);
  box-shadow: inset 0 0 10px rgb(var(--xb-cyan-rgb) / 0.22);
}

.divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: rgb(var(--xb-border-rgb) / 0.22);
}

.tour-btn svg {
  width: 13px;
  height: 13px;
}

.tour-btn.active svg {
  filter: drop-shadow(0 0 4px rgb(var(--xb-cyan-rgb) / 0.8));
}

.tour-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  letter-spacing: 1px;
  color: var(--xb-cyan-soft);
  white-space: nowrap;
}

.pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--xb-cyan);
  box-shadow: 0 0 6px var(--xb-cyan);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
}
</style>
