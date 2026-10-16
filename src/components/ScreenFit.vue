<template>
  <div ref="viewportRef" class="screen-viewport">
    <div class="screen-stage" :style="stageStyle">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

/** 设计基准分辨率 */
const DESIGN_WIDTH = 1920
const DESIGN_HEIGHT = 1080

const viewportRef = ref<HTMLElement | null>(null)
const scale = ref(1)
let observer: ResizeObserver | null = null

/** 等比缩放：取宽高缩放比的最小值，保证 1920x1080 设计稿完整呈现且不变形 */
function updateScale() {
  const el = viewportRef.value
  if (!el) return
  scale.value = Math.min(el.clientWidth / DESIGN_WIDTH, el.clientHeight / DESIGN_HEIGHT)
}

onMounted(() => {
  const el = viewportRef.value
  if (!el) return
  observer = new ResizeObserver(updateScale)
  observer.observe(el)
  updateScale()
})

onUnmounted(() => observer?.disconnect())

const stageStyle = computed(() => ({
  width: `${DESIGN_WIDTH}px`,
  height: `${DESIGN_HEIGHT}px`,
  transform: `translate(-50%, -50%) scale(${scale.value})`,
}))
</script>

<style scoped>
/* 黑边治理（M8.1）：letterbox 区域不再是纯黑，而是深空渐变 + 静态星点（两处伪元素 box-shadow 一次绘制） */
.screen-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background:
    radial-gradient(1200px 700px at 78% 18%, rgb(var(--xb-cyan-rgb) / 0.07), transparent 62%),
    radial-gradient(900px 620px at 16% 86%, rgb(var(--xb-panel-corner-rgb) / 0.05), transparent 60%),
    var(--xb-bg-deep);
}

/* 远景星点层：随机散布的小亮点（坐标为设计值，非主题色，恒定白青） */
.screen-viewport::before,
.screen-viewport::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.screen-viewport::before {
  box-shadow:
    87px 143px 0 0 rgb(200 240 255 / 0.5),
    312px 61px 0 0 rgb(200 240 255 / 0.3),
    498px 421px 0 0 rgb(200 240 255 / 0.42),
    733px 158px 0 0 rgb(180 220 255 / 0.3),
    1024px 87px 0 0 rgb(200 240 255 / 0.5),
    1268px 302px 0 0 rgb(200 240 255 / 0.26),
    1522px 119px 0 0 rgb(190 230 255 / 0.44),
    1774px 231px 0 0 rgb(200 240 255 / 0.3),
    1841px 522px 0 0 rgb(200 240 255 / 0.4),
    161px 533px 0 0 rgb(180 220 255 / 0.28),
    383px 715px 0 0 rgb(200 240 255 / 0.36),
    654px 920px 0 0 rgb(200 240 255 / 0.42),
    918px 664px 0 0 rgb(190 230 255 / 0.26),
    1173px 856px 0 0 rgb(200 240 255 / 0.44),
    1409px 633px 0 0 rgb(200 240 255 / 0.3),
    1687px 902px 0 0 rgb(180 220 255 / 0.4),
    79px 892px 0 0 rgb(200 240 255 / 0.32),
    1902px 756px 0 0 rgb(200 240 255 / 0.36);
}

/* 近景星点层：更小更密，补充纵深 */
.screen-viewport::after {
  box-shadow:
    219px 261px 0 0 rgb(200 240 255 / 0.22),
    576px 194px 0 0 rgb(200 240 255 / 0.18),
    843px 327px 0 0 rgb(200 240 255 / 0.24),
    1107px 178px 0 0 rgb(200 240 255 / 0.16),
    1345px 455px 0 0 rgb(200 240 255 / 0.2),
    1590px 349px 0 0 rgb(200 240 255 / 0.18),
    358px 582px 0 0 rgb(200 240 255 / 0.2),
    614px 772px 0 0 rgb(200 240 255 / 0.16),
    1036px 512px 0 0 rgb(200 240 255 / 0.22),
    1290px 718px 0 0 rgb(200 240 255 / 0.16),
    1508px 560px 0 0 rgb(200 240 255 / 0.2),
    1761px 402px 0 0 rgb(200 240 255 / 0.18),
    130px 356px 0 0 rgb(200 240 255 / 0.2),
    1856px 154px 0 0 rgb(200 240 255 / 0.16),
    442px 948px 0 0 rgb(200 240 255 / 0.18),
    1560px 1004px 0 0 rgb(200 240 255 / 0.22);
}

/* 舞台辉光描边 + 极缓呼吸（M8.1）：主屏区域与黑边柔和分层 */
.screen-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center;
  box-shadow:
    0 0 0 1px rgb(var(--xb-cyan-rgb) / 0.16),
    0 0 44px rgb(var(--xb-cyan-rgb) / 0.14),
    0 0 140px rgb(var(--xb-cyan-rgb) / 0.1);
  animation: stage-breath 7s ease-in-out infinite;
}

@keyframes stage-breath {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgb(var(--xb-cyan-rgb) / 0.16),
      0 0 44px rgb(var(--xb-cyan-rgb) / 0.14),
      0 0 140px rgb(var(--xb-cyan-rgb) / 0.1);
  }
  50% {
    box-shadow:
      0 0 0 1px rgb(var(--xb-cyan-rgb) / 0.24),
      0 0 56px rgb(var(--xb-cyan-rgb) / 0.2),
      0 0 170px rgb(var(--xb-cyan-rgb) / 0.13);
  }
}

@media (prefers-reduced-motion: reduce) {
  .screen-stage {
    animation: none;
  }
}
</style>
