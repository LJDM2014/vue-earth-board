<template>
  <div ref="viewportRef" class="screen-viewport">
    <div class="screen-stage" :style="stageStyle">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { THEME } from '../config/theme'

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
.screen-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: v-bind('THEME.bgDeep');
}

.screen-stage {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center;
}
</style>
