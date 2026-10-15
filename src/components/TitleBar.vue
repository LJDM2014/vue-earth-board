<template>
  <header class="title-bar">
    <div class="deco-line" />
    <div class="title-core">
      <span class="diamond left" />
      <h1 class="title-text">寰宇 · 数字地球可视化大屏</h1>
      <span class="diamond right" />
    </div>
    <div class="deco-line" />
  </header>
</template>

<script setup lang="ts">
import { THEME } from '../config/theme'
</script>

<style scoped>
.title-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 0 48px;
  /* 覆盖在地图上方但完全不拦截鼠标，保证地图可拖拽 */
  pointer-events: none;
  z-index: 20;
  background: linear-gradient(
    180deg,
    rgba(4, 11, 24, 0.9) 0%,
    rgba(4, 11, 24, 0.35) 72%,
    transparent 100%
  );
}

.title-core {
  display: flex;
  align-items: center;
  gap: 18px;
}

.title-text {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 8px;
  white-space: nowrap;
  background: linear-gradient(90deg, #eafcff 0%, v-bind('THEME.cyan') 50%, #eafcff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 26px rgba(0, 229, 255, 0.45);
}

.deco-line {
  flex: 1;
  max-width: 620px;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    v-bind('THEME.borderGlow') 18%,
    v-bind('THEME.cyan') 50%,
    v-bind('THEME.borderGlow') 82%,
    transparent 100%
  );
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.5);
}

.diamond {
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border: 1.5px solid v-bind('THEME.cyan');
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.7);
}
</style>
