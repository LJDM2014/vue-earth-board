<template>
  <div v-if="enabled" class="debug-hud" aria-hidden="true">
    <div v-for="row in rows" :key="row.k" class="hud-row">
      <span class="hud-k">{{ row.k }}</span>
      <span class="hud-v">{{ row.v }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

/** 仅 ?debug=1 时渲染；生产默认关闭，组件不挂载即零开销 */
const enabled = new URLSearchParams(location.search).get('debug') === '1'

const props = defineProps<{
  /** 当前数据周期（如 2025-07） */
  period: string
  /** 数据源类型：mock / http / 尚未就绪 null */
  sourceKind: string | null
}>()

/** 每秒聚合一次的帧统计 */
const fps = ref(0)
const frameMs = ref(0)
/** Chrome 专属：JS 堆用量（MB），其余浏览器显示 — */
const heapMb = ref('—')

let rafId = 0
let frames = 0
let frameCost = 0
let lastTs = 0
let bucketTs = 0

function tick(ts: number) {
  if (lastTs !== 0) {
    frames += 1
    frameCost += ts - lastTs
  }
  lastTs = ts
  if (bucketTs === 0) bucketTs = ts
  if (ts - bucketTs >= 1000) {
    fps.value = Math.round((frames * 1000) / (ts - bucketTs))
    frameMs.value = frames > 0 ? Math.round(frameCost / frames * 100) / 100 : 0
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    if (mem) heapMb.value = (mem.usedJSHeapSize / 1048576).toFixed(1) + ' MB'
    frames = 0
    frameCost = 0
    bucketTs = ts
  }
  rafId = requestAnimationFrame(tick)
}

onMounted(() => {
  if (enabled) rafId = requestAnimationFrame(tick)
})
onUnmounted(() => cancelAnimationFrame(rafId))

const sourceLabel = computed(() => props.sourceKind ?? '初始化…')

const rows = computed(() => [
  { k: 'FPS', v: String(fps.value) },
  { k: '帧耗时', v: `${frameMs.value} ms` },
  { k: 'JS 堆', v: heapMb.value },
  { k: '周期', v: props.period },
  { k: '数据源', v: sourceLabel.value },
])
</script>

<style scoped>
.debug-hud {
  position: absolute;
  right: 28px;
  /* 232px = 地图操作框（map-controls-pos，6 按钮竖排高 188px，bottom:30px）顶部之上留 14px 间距，避免重叠 */
  bottom: 232px;
  z-index: 20;
  min-width: 132px;
  padding: 8px 12px;
  font: 11px/1.7 ui-monospace, Consolas, monospace;
  color: rgb(var(--xb-cyan-rgb) / 0.92);
  background: rgb(var(--xb-panel-rgb) / 0.72);
  border: 1px solid rgb(var(--xb-cyan-rgb) / 0.28);
  border-radius: 4px;
  pointer-events: none;
  backdrop-filter: blur(4px);
}

.hud-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
}

.hud-k {
  color: var(--xb-text-dim);
  letter-spacing: 0.08em;
}

.hud-v {
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 6px rgb(var(--xb-cyan-rgb) / 0.5);
}
</style>
