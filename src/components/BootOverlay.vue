<template>
  <Transition name="boot-fade">
    <div v-if="visible" class="boot-overlay" role="status" aria-live="polite">
      <h1 class="boot-title">寰宇 · 数字地球大屏</h1>
      <div class="boot-track">
        <div class="boot-fill" :style="{ width: `${progress}%` }" />
      </div>
      <div class="boot-row">
        <span class="boot-status">{{ status }}</span>
        <span class="boot-pct">{{ progress }}%</span>
      </div>
      <p v-if="error" class="boot-error">
        底图样式加载失败（内网 / 弱网环境）—— 地图底图暂不可用，图层与面板仍可离线演示；
        可在「底图」中选择自托管瓦片后重试。
      </p>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  /** 引导进度 0-100 */
  progress: number
  /** 当前阶段文案 */
  status: string
  /** 底图样式加载失败降级提示 */
  error: boolean
}>()

const emit = defineEmits<{ gone: [] }>()

const visible = ref(true)
let fadeScheduled = false

// 进度走满后短暂停留再淡出，淡出结束移除节点（父组件据此卸载）。
// 不能用 once:true——首次变化可能是 8→55（地图就绪），此时未满 100，
// 监听器若被销毁将错过 55→100，引导层会永久卡住
watch(
  () => props.progress,
  (p) => {
    if (p >= 100 && !fadeScheduled) {
      fadeScheduled = true
      window.setTimeout(() => {
        visible.value = false
        window.setTimeout(() => emit('gone'), 700)
      }, 420)
    }
  },
)
</script>

<style scoped>
.boot-overlay {
  position: absolute;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: var(--xb-bg-deep);
}

.boot-title {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 10px;
  color: var(--xb-text);
  text-shadow: 0 0 24px rgb(var(--xb-cyan-rgb) / 0.55);
}

.boot-track {
  width: 320px;
  height: 5px;
  border-radius: 3px;
  background: rgb(var(--xb-cyan-rgb) / 0.12);
  overflow: hidden;
}

.boot-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, rgb(var(--xb-cyan-rgb) / 0.4), var(--xb-cyan));
  box-shadow: 0 0 12px rgb(var(--xb-cyan-rgb) / 0.7);
  transition: width 0.5s ease;
}

.boot-row {
  width: 320px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--xb-text-dim);
}

.boot-pct {
  font-variant-numeric: tabular-nums;
  color: var(--xb-cyan-soft);
}

.boot-error {
  max-width: 520px;
  margin: 6px 0 0;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid rgb(var(--xb-gold-rgb) / 0.4);
  background: rgb(var(--xb-gold-rgb) / 0.08);
  font-size: 12px;
  line-height: 1.7;
  letter-spacing: 1px;
  color: var(--xb-gold);
}

.boot-fade-leave-active {
  transition: opacity 0.6s ease;
}

.boot-fade-leave-to {
  opacity: 0;
}
</style>
