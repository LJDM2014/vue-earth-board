/**
 * 后台管理独立入口（A3）：Element Plus 全量引入（暗色 + zh-CN locale）。
 * echarts 按需注册放在 A4 的 VbEChart 图表封装中，不在此处引入。
 * 大屏入口（src/main.ts）与本入口互不引用，构建分包互不影响。
 */
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './AdminApp.vue'
import { router } from './router'
import './admin.css'

createApp(App).use(router).use(ElementPlus, { locale: zhCn }).mount('#app')
