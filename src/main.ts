import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { HttpReporter, onMonitorEvent } from './services/monitor'

createApp(App).mount('#app')

// M9.2：配置了上报地址才注册 HttpReporter；缺省保持 console.warn 行为不变
const monitorUrl = import.meta.env.VITE_MONITOR_URL
if (monitorUrl) onMonitorEvent(new HttpReporter(monitorUrl).report)
