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
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-cyan-rgb) / 0.08);
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
  background: var(--xb-text-dim);
  transition: all 0.25s ease;
}

.toggle.on {
  background: rgb(var(--xb-cyan-rgb) / 0.22);
  border-color: var(--xb-cyan);
}

.toggle.on .knob {
  left: 24px;
  background: var(--xb-cyan);
  box-shadow: 0 0 10px rgb(var(--xb-cyan-rgb) / 0.8);
}

.toggle:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
