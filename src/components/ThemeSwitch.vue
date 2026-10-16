<template>
  <div class="theme-switch" role="group" aria-label="主题切换">
    <button
      v-for="(palette, id) in THEMES"
      :key="id"
      type="button"
      class="theme-dot"
      :class="{ active: id === activeThemeId }"
      :title="palette.label"
      :aria-label="`切换到${palette.label}主题`"
      :aria-pressed="id === activeThemeId"
      @click="setTheme(id)"
    >
      <i class="dot" :style="{ background: palette.ui.cyan, color: palette.ui.cyan }" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { THEMES, activeThemeId, setTheme } from '../config/theme'
</script>

<style scoped>
/* 挂在 TitleBar 内（父级 pointer-events:none），自身恢复交互 */
.theme-switch {
  position: absolute;
  top: 18px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  border-radius: 999px;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-panel-rgb) / 0.82);
  backdrop-filter: blur(6px);
  box-shadow: 0 0 10px rgb(var(--xb-cyan-rgb) / 0.15);
  pointer-events: auto;
}

.theme-dot {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.theme-dot:hover {
  transform: scale(1.12);
}

.theme-dot .dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

/* 激活态：主题色描边圈 */
.theme-dot.active {
  box-shadow: 0 0 0 1.5px currentColor;
}
</style>
