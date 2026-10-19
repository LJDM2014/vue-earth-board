/**
 * 后台管理路由（A3）：hash 模式免服务端 history fallback。
 * 四页结构见 docs/admin-module-plan.md §5.1；A4-A7 逐页填充内容。
 */
import { createRouter, createWebHashHistory } from 'vue-router'
import OverviewView from './views/OverviewView.vue'
import CitiesView from './views/CitiesView.vue'
import FlowsView from './views/FlowsView.vue'
import TransferView from './views/TransferView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/overview' },
    { path: '/overview', name: 'overview', component: OverviewView, meta: { title: '数据概览' } },
    { path: '/cities', name: 'cities', component: CitiesView, meta: { title: '城市指标管理' } },
    { path: '/flows', name: 'flows', component: FlowsView, meta: { title: '航线 OD 管理' } },
    { path: '/transfer', name: 'transfer', component: TransferView, meta: { title: '导入导出' } },
  ],
})
