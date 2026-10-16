<template>
  <section class="panel-chrome">
    <div class="chrome-inner">
      <!-- 四角角标：左上/右下 L 形辉光，右上/左下切角斜边高光 -->
      <i class="corner tl" aria-hidden="true" />
      <i class="corner br" aria-hidden="true" />
      <i class="notch tr" aria-hidden="true" />
      <i class="notch bl" aria-hidden="true" />
      <header class="chrome-head">
        <i class="title-bar" aria-hidden="true" />
        <h2 class="chrome-title"><slot name="title">{{ title }}</slot></h2>
        <i class="title-rule" aria-hidden="true" />
        <slot name="extra" />
      </header>
      <div class="chrome-body">
        <slot />
      </div>
      <i v-if="scan" class="scanline" aria-hidden="true" />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 面板统一科技风外壳（M6.1）：切角边框 + L 形辉光角标 + 标题槽 + 可选底部扫描光。
 * 仅负责外观，不含布局尺寸；联动协议（props/emits）由内层面板保持不变。
 * 颜色全部消费 --xb-* 主题变量（M8.2）。
 */
withDefaults(defineProps<{ title?: string; scan?: boolean }>(), { title: '', scan: true })
</script>

<style scoped>
/* 外层：1px 发光描边层，右上/左下 12px 切角；drop-shadow 跟随裁剪形状不受 clip 影响 */
.panel-chrome {
  position: relative;
  padding: 1px;
  clip-path: polygon(
    0 0,
    calc(100% - 12px) 0,
    100% 12px,
    100% 100%,
    12px 100%,
    0 calc(100% - 12px)
  );
  background: linear-gradient(
    160deg,
    rgb(var(--xb-panel-corner-rgb) / 0.55),
    rgb(var(--xb-cyan-rgb) / 0.16) 34%,
    rgb(var(--xb-cyan-rgb) / 0.1) 66%,
    rgb(var(--xb-panel-corner-rgb) / 0.4)
  );
  filter: drop-shadow(0 0 16px rgb(var(--xb-cyan-rgb) / 0.12));
}

/* 内层：面板本体（比外层小 1px 露出描边），同切角自然内缩 */
.chrome-inner {
  position: relative;
  padding: 12px 16px 14px;
  clip-path: polygon(
    0 0,
    calc(100% - 12px) 0,
    100% 12px,
    100% 100%,
    12px 100%,
    0 calc(100% - 12px)
  );
  background: rgb(var(--xb-panel-rgb) / 0.82);
  backdrop-filter: blur(6px);
  box-shadow: inset 0 0 22px rgb(var(--xb-cyan-rgb) / 0.05);
  color: var(--xb-text);
}

/* ── 四角角标 ── */
.corner {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}

.corner.tl {
  top: 0;
  left: 0;
  border-top: 2px solid var(--xb-panel-corner);
  border-left: 2px solid var(--xb-panel-corner);
  filter: drop-shadow(0 0 4px var(--xb-panel-corner));
}

.corner.br {
  bottom: 0;
  right: 0;
  border-bottom: 2px solid var(--xb-panel-corner);
  border-right: 2px solid var(--xb-panel-corner);
  filter: drop-shadow(0 0 4px var(--xb-panel-corner));
}

/* 切角斜边高光：贴着切角内侧的渐变三角 */
.notch {
  position: absolute;
  width: 12px;
  height: 12px;
  pointer-events: none;
}

.notch.tr {
  top: 0;
  right: 0;
  clip-path: polygon(0 0, 100% 0, 0 100%);
  background: linear-gradient(
    225deg,
    var(--xb-panel-corner),
    rgb(var(--xb-panel-corner-rgb) / 0) 72%
  );
}

.notch.bl {
  bottom: 0;
  left: 0;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
  background: linear-gradient(
    45deg,
    var(--xb-panel-corner),
    rgb(var(--xb-panel-corner-rgb) / 0) 72%
  );
}

/* ── 标题槽：竖向光条 + 标题字 + 渐变消隐细线 ── */
.chrome-head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 13px;
}

.title-bar {
  flex: none;
  width: 4px;
  height: 15px;
  border-radius: 1px;
  background: linear-gradient(180deg, var(--xb-title-accent), rgb(var(--xb-cyan-rgb) / 0.1));
  box-shadow: 0 0 8px var(--xb-title-accent);
}

.chrome-title {
  margin: 0;
  flex: none;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 3px;
  white-space: nowrap;
  color: var(--xb-cyan-soft);
  text-shadow: 0 0 14px rgb(var(--xb-cyan-rgb) / 0.45);
}

.title-rule {
  flex: 1;
  min-width: 12px;
  height: 1px;
  background: linear-gradient(90deg, rgb(var(--xb-cyan-rgb) / 0.45), rgb(var(--xb-cyan-rgb) / 0));
}

/* ── 底部扫描光：8s 极缓平移，尊重 reduced-motion ── */
.scanline {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 64px;
  height: 2px;
  background: linear-gradient(
    90deg,
    rgb(var(--xb-cyan-rgb) / 0),
    rgb(var(--xb-cyan-rgb) / 0.65),
    rgb(var(--xb-cyan-rgb) / 0)
  );
  animation: chrome-scan 8s linear infinite;
}

@keyframes chrome-scan {
  from {
    transform: translateX(-72px);
  }
  to {
    transform: translateX(352px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scanline {
    animation: none;
    opacity: 0;
  }
}
</style>
