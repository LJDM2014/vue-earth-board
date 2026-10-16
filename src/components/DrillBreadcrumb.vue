<template>
  <nav v-if="province" class="crumb" aria-label="省份下钻导航">
    <button type="button" class="crumb-link" @click="emit('back')">全国</button>
    <span class="crumb-sep">›</span>
    <span class="crumb-current">{{ province.name }}</span>
    <span class="crumb-hint">市界模式</span>
  </nav>
</template>

<script setup lang="ts">
import { THEME } from '../config/theme'

defineProps<{
  /** 当前下钻省（null = 全国视角，组件不渲染） */
  province: { name: string; adcode: number } | null
}>()

const emit = defineEmits<{ back: [] }>()
</script>

<style scoped>
.crumb {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  border-radius: 999px;
  border: 1px solid v-bind('THEME.borderGlow');
  background: v-bind('THEME.bgPanel');
  backdrop-filter: blur(6px);
  box-shadow: 0 0 18px rgba(0, 229, 255, 0.12);
}

.crumb-link {
  border: none;
  background: transparent;
  padding: 2px 4px;
  font-size: 14px;
  letter-spacing: 1px;
  color: v-bind('THEME.cyan');
  cursor: pointer;
  transition: color 0.2s ease;
}

.crumb-link:hover {
  color: v-bind('THEME.text');
  text-shadow: 0 0 8px rgba(0, 229, 255, 0.6);
}

.crumb-sep {
  color: v-bind('THEME.textDim');
}

.crumb-current {
  font-size: 14px;
  letter-spacing: 1px;
  color: v-bind('THEME.text');
}

.crumb-hint {
  font-size: 12px;
  letter-spacing: 1px;
  color: v-bind('THEME.textDim');
}
</style>
