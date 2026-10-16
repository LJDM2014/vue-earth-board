<template>
  <button
    type="button"
    class="toggle"
    :class="{ on }"
    :disabled="disabled"
    :aria-pressed="on"
    :aria-label="label"
    @click="emit('change', !on)"
  >
    <span class="knob" />
  </button>
</template>

<script setup lang="ts">
import { THEME } from '../config/theme'

withDefaults(
  defineProps<{
    /** 开关状态 */
    on: boolean
    /** 无障碍标签 */
    label: string
    /** 禁用态（不可点击并降低不透明度） */
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ change: [enabled: boolean] }>()
</script>

<style scoped>
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

.toggle:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
