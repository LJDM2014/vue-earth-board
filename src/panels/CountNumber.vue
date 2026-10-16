<template>{{ Math.round(display).toLocaleString() }}</template>

<script setup lang="ts">
import { useCountUp } from '../composables/useCountUp'

/** 数值滚动展示（M6.2）：value 变化时缓出动画，千分位格式化输出 */
const props = defineProps<{ value: number; duration?: number }>()

const display = useCountUp(() => props.value, props.duration ?? 600)
</script>
