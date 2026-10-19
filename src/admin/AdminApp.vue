<script setup lang="ts">
/**
 * 后台管理布局（A3）：左侧导航 + 顶栏（健康徽标 / 最近更新时间 / 查看大屏外链）+ 路由视图。
 * 健康状态 10s 轮询 /api/health，失败即显示「服务离线」。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Connection, DataAnalysis, Location, Upload } from '@element-plus/icons-vue'
import { api } from './api/client'
import type { HealthInfo } from './types'

const route = useRoute()

const health = ref<HealthInfo | null>(null)
let healthTimer: number | undefined

async function refreshHealth(): Promise<void> {
  try {
    health.value = await api.getHealth()
  } catch {
    health.value = null
  }
}

const healthy = computed(() => health.value?.ok === true)
const healthText = computed(() => (healthy.value ? '服务正常' : '服务离线'))
const updatedAtText = computed(() => {
  const iso = health.value?.updatedAt
  return iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '--'
})
const pageTitle = computed(() => String(route.meta.title ?? '后台管理'))

watch(
  pageTitle,
  (t) => {
    document.title = `${t} · 寰宇数板后台`
  },
  { immediate: true },
)

onMounted(() => {
  void refreshHealth()
  healthTimer = window.setInterval(() => void refreshHealth(), 10_000)
})

onUnmounted(() => window.clearInterval(healthTimer))
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-aside">
      <div class="brand">
        <h1>寰宇数板</h1>
        <p>后台数据管理</p>
      </div>
      <el-menu router :default-active="route.path" class="admin-menu">
        <el-menu-item index="/overview">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/cities">
          <el-icon><Location /></el-icon>
          <span>城市指标</span>
        </el-menu-item>
        <el-menu-item index="/flows">
          <el-icon><Connection /></el-icon>
          <span>航线 OD</span>
        </el-menu-item>
        <el-menu-item index="/transfer">
          <el-icon><Upload /></el-icon>
          <span>导入导出</span>
        </el-menu-item>
      </el-menu>
      <div class="aside-foot">vue-earth-board admin</div>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <h1>{{ pageTitle }}</h1>
        <div class="topbar-right">
          <span class="health-badge" :class="{ bad: !healthy }">
            <i class="dot" />{{ healthText }}
          </span>
          <span class="updated">最近更新：{{ updatedAtText }}</span>
          <a class="board-link" href="/" target="_blank" rel="noopener">查看大屏 ↗</a>
        </div>
      </header>
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>
