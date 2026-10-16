<template>
  <header class="title-bar">
    <div class="deco-line" />
    <div class="title-core">
      <span class="diamond left" />
      <h1 class="title-text">{{ boardConfig.title }}</h1>
      <span class="diamond right" />
    </div>
    <div class="deco-line" />
    <!-- 数据来源角标（M7.3）：现场人员一眼识别实时/演示数据 -->
    <span v-if="dataSourceLabel" class="source-badge" :class="{ degraded: isDegraded }">
      {{ dataSourceLabel }}
    </span>
    <!-- 主题切换（M8.2）：左上角，与右侧来源角标对称 -->
    <ThemeSwitch />
    <!-- 底部扫描光线（M8.4） -->
    <i class="scan-light" aria-hidden="true" />
  </header>
</template>

<script setup lang="ts">
import ThemeSwitch from './ThemeSwitch.vue'
import { boardConfig } from '../config/runtime'

defineProps<{
  /** 数据来源标签（'实时数据'/'演示数据'），null 不渲染 */
  dataSourceLabel?: string | null
  /** 降级态：角标转金色警示 */
  isDegraded?: boolean
}>()
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
    rgb(var(--xb-bg-deep-rgb) / 0.9) 0%,
    rgb(var(--xb-bg-deep-rgb) / 0.35) 72%,
    transparent 100%
  );
}

/* 底部扫描光线（M8.4）：细光带周期性横扫，尊重 reduced-motion */
.scan-light {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 220px;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgb(var(--xb-cyan-rgb) / 0),
    rgb(var(--xb-cyan-rgb) / 0.8),
    rgb(var(--xb-cyan-rgb) / 0)
  );
  animation: title-scan 8s linear infinite;
}

@keyframes title-scan {
  from {
    transform: translateX(-240px);
  }
  to {
    transform: translateX(1940px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scan-light {
    animation: none;
    opacity: 0;
  }
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
  background: linear-gradient(90deg, #eafcff 0%, var(--xb-cyan) 50%, #eafcff 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  /* 双层辉光（M8.4）：近距锐光 + 远距弥散 */
  text-shadow:
    0 0 18px rgb(var(--xb-cyan-rgb) / 0.55),
    0 2px 30px rgb(var(--xb-cyan-rgb) / 0.35);
}

.deco-line {
  position: relative;
  flex: 1;
  max-width: 620px;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgb(var(--xb-border-rgb) / 0.22) 18%,
    var(--xb-cyan) 50%,
    rgb(var(--xb-border-rgb) / 0.22) 82%,
    transparent 100%
  );
  box-shadow: 0 0 8px rgb(var(--xb-cyan-rgb) / 0.5);
}

/* 端点呼吸圆点（M8.4） */
.deco-line::before,
.deco-line::after {
  content: '';
  position: absolute;
  top: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--xb-cyan);
  box-shadow: 0 0 8px var(--xb-cyan);
  animation: deco-pulse 2.4s ease-in-out infinite;
}

.deco-line::before {
  left: -2px;
}

.deco-line::after {
  right: -2px;
  animation-delay: 1.2s;
}

@keyframes deco-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .deco-line::before,
  .deco-line::after {
    animation: none;
    opacity: 0.8;
  }
}

.diamond {
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border: 1.5px solid var(--xb-cyan);
  box-shadow: 0 0 10px rgb(var(--xb-cyan-rgb) / 0.7);
}

.source-badge {
  position: absolute;
  top: 18px;
  right: 24px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--xb-cyan-soft);
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-cyan-rgb) / 0.08);
  box-shadow: 0 0 10px rgb(var(--xb-cyan-rgb) / 0.15);
}

/* 降级态（http 不可用回落 mock）：金色警示 */
.source-badge.degraded {
  color: var(--xb-gold);
  border-color: rgb(var(--xb-gold-rgb) / 0.45);
  background: rgb(var(--xb-gold-rgb) / 0.08);
  box-shadow: 0 0 10px rgb(var(--xb-gold-rgb) / 0.2);
}
</style>
