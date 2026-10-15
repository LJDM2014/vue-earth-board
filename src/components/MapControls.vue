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
  </div>
</template>

<script setup lang="ts">
import { THEME } from '../config/theme'

const emit = defineEmits<{
  'zoom-in': []
  'zoom-out': []
  'reset-north': []
  'reset-view': []
}>()
</script>

<style scoped>
.map-controls {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid v-bind('THEME.borderGlow');
  background: v-bind('THEME.bgPanel');
  backdrop-filter: blur(6px);
  box-shadow: 0 0 18px rgba(0, 229, 255, 0.12);
}

.ctl-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: v-bind('THEME.textDim');
  cursor: pointer;
  transition: all 0.25s ease;
}

.ctl-btn svg {
  width: 16px;
  height: 16px;
}

.ctl-btn:hover {
  color: v-bind('THEME.cyan');
  background: rgba(0, 229, 255, 0.12);
}

.ctl-btn:active {
  background: rgba(0, 229, 255, 0.22);
}
</style>
