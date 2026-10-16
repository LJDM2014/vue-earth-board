<template>
  <div ref="rootEl" class="basemap-switch">
    <button
      type="button"
      class="trigger"
      :aria-expanded="open"
      aria-label="切换底图"
      @click="open = !open"
    >
      <svg class="globe-icon" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.2" />
        <ellipse cx="8" cy="8" rx="2.9" ry="6.4" fill="none" stroke="currentColor" stroke-width="1" />
        <path d="M1.6 8h12.8M2.5 4.8h11M2.5 11.2h11" fill="none" stroke="currentColor" stroke-width="1" />
      </svg>
      <span class="trigger-name">{{ current?.name ?? '底图' }}</span>
      <span class="caret" :class="{ up: open }" aria-hidden="true" />
    </button>

    <transition name="drop">
      <ul v-if="open" class="options" role="listbox" aria-label="底图列表">
        <li v-for="opt in BASEMAP_OPTIONS" :key="opt.id">
          <button
            type="button"
            class="option"
            :class="{ active: opt.id === modelValue }"
            role="option"
            :aria-selected="opt.id === modelValue"
            @click="select(opt)"
          >
            {{ opt.name }}
            <span v-if="opt.id === modelValue" class="check" aria-hidden="true">✓</span>
          </button>
        </li>
      </ul>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BASEMAP_OPTIONS, type BasemapOption } from '../config/basemap'

const props = defineProps<{ /** 当前底图 id */ modelValue: string }>()

const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const current = computed(() => BASEMAP_OPTIONS.find((b) => b.id === props.modelValue))

function select(opt: BasemapOption) {
  emit('update:modelValue', opt.id)
  open.value = false
}

/** 点击组件外部时收起下拉 */
function onDocClick(e: MouseEvent) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.basemap-switch {
  position: relative;
  width: 172px;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-panel-rgb) / 0.82);
  backdrop-filter: blur(6px);
  color: var(--xb-text-dim);
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 0 18px rgb(var(--xb-cyan-rgb) / 0.12);
  transition: all 0.25s ease;
}

.trigger:hover {
  color: var(--xb-cyan-soft);
  border-color: var(--xb-cyan);
}

.globe-icon {
  width: 16px;
  height: 16px;
  flex: none;
  color: var(--xb-cyan);
}

.trigger-name {
  flex: 1;
  text-align: left;
  white-space: nowrap;
}

.caret {
  width: 7px;
  height: 7px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
  transition: transform 0.25s ease;
}

.caret.up {
  transform: rotate(225deg) translateY(-1px);
}

.options {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  width: 100%;
  margin: 0;
  padding: 6px;
  list-style: none;
  border-radius: 12px;
  border: 1px solid rgb(var(--xb-border-rgb) / 0.22);
  background: rgb(var(--xb-panel-rgb) / 0.82);
  backdrop-filter: blur(10px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
}

.option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--xb-text-dim);
  font-size: 13px;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.option:hover {
  color: var(--xb-text);
  background: rgb(var(--xb-cyan-rgb) / 0.1);
}

.option.active {
  color: var(--xb-cyan);
}

.check {
  font-size: 12px;
}

.drop-enter-active,
.drop-leave-active {
  transition: all 0.2s ease;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
