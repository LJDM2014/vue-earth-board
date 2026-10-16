<template>
  <label class="opacity-slider" :aria-label="`图层透明度 ${Math.round(value * 100)}%`">
    <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="rgba(0,229,255,0.55)" stroke="currentColor" stroke-width="1" />
      <circle cx="8" cy="8" r="2.4" fill="rgba(216,246,255,0.9)" />
    </svg>
    <input
      type="range"
      min="0"
      max="100"
      :value="Math.round(value * 100)"
      @input="emit('change', Number(($event.target as HTMLInputElement).value) / 100)"
    />
  </label>
</template>

<script setup lang="ts">
defineProps<{ /** 透明度 0-1 */ value: number }>()

const emit = defineEmits<{ change: [value: number] }>()
</script>

<style scoped>
.opacity-slider {
  display: flex;
  align-items: center;
  gap: 5px;
}

.icon {
  width: 12px;
  height: 12px;
  color: rgba(0, 229, 255, 0.5);
  flex: none;
}

input[type='range'] {
  width: 60px;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 2px;
  background: rgba(0, 229, 255, 0.18);
  outline: none;
  cursor: pointer;
}

input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid rgba(0, 229, 255, 0.8);
  background: #d7f5ff;
  box-shadow: 0 0 6px rgba(0, 229, 255, 0.7);
}

input[type='range']::-moz-range-thumb {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid rgba(0, 229, 255, 0.8);
  background: #d7f5ff;
  box-shadow: 0 0 6px rgba(0, 229, 255, 0.7);
}
</style>
