<template>
  <div class="map-controls" role="group" aria-label="地图操作">
    <button type="button" class="ctl-btn" aria-label="放大" @click="emit('zoom-in')">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    </button>
    <button type="button" class="ctl-btn" aria-label="缩小" @click="emit('zoom-out')">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    </button>
    <button type="button" class="ctl-btn" aria-label="回正北" @click="emit('reset-north')">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2.6 10.2 12 8 10.1 5.8 12Z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
      </svg>
    </button>
    <button type="button" class="ctl-btn" aria-label="复位视角" @click="emit('reset-view')">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="4.4" fill="none" stroke="currentColor" stroke-width="1.2" />
        <path
          d="M8 1.6v2.6M8 11.8v2.6M1.6 8h2.6M11.8 8h2.6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <button
      type="button"
      class="ctl-btn"
      :class="{ active: autoRotate }"
      :aria-pressed="autoRotate"
      :aria-label="autoRotate ? '停止自转' : '开启自转'"
      @click="emit('toggle-rotate', !autoRotate)"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24L13 11h7V4l-2.35 2.35z"
          fill="currentColor"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ autoRotate: boolean }>()

const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  'reset-north': []
  'reset-view': []
  'toggle-rotate': [enabled: boolean]
}>()
</script>

<style scoped>
.map-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-panel-rgb) / 0.82);
  backdrop-filter: blur(6px);
  box-shadow: 0 0 18px rgb(var(--xb-cyan-rgb) / 0.12);
}

.ctl-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--xb-text-dim);
  cursor: pointer;
  transition: all 0.25s ease;
}

.ctl-btn svg {
  width: 16px;
  height: 16px;
}

.ctl-btn:hover {
  color: var(--xb-cyan);
  background: rgb(var(--xb-cyan-rgb) / 0.12);
}

.ctl-btn.active {
  color: var(--xb-cyan);
}

.ctl-btn.active svg {
  filter: drop-shadow(0 0 4px rgb(var(--xb-cyan-rgb) / 0.8));
}

.ctl-btn:active {
  background: rgb(var(--xb-cyan-rgb) / 0.22);
}
</style>
