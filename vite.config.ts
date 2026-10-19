import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 开发服务器固定端口（默认 5173 → 3000）
    port: 3000,
    // 后台数据管理模块（A2）：/api 代理到本地 board API 服务（SERVER_PORT 可覆盖端口）
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.SERVER_PORT ?? '3100'}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      // A3：MPA 双入口（大屏 index + 后台管理 admin）
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
      output: {
        // M4.2 分包 + A3：重型三方库与业务代码隔离，业务主包（index）保持小体积可缓存，
        // CI 产物预算（gzip 主包 < 900KB，check-budget.mjs 只统计 index-*.js）仅考核业务主包；
        // element/echarts 仅 admin 入口引用，独立分包不进大屏链路（改函数式以支持按路径分包，
        // 避免对象式列出 'echarts' 把全量 barrel 拉进产物）
        manualChunks(id: string): string | undefined {
          // CJS interop 助手（maplibre/pako/earcut 等 CJS 依赖共用）：必须显式独立分包，
          // 否则 MPA 下 rollup 会把它归并进 element chunk，大屏全链路被拖挂 EP（A3 联调实测）
          if (id.includes('commonjsHelpers')) return 'commonjs'
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](element-plus|@element-plus)[\\/]/.test(id)) return 'element'
          if (/[\\/]node_modules[\\/](echarts|zrender)[\\/]/.test(id)) return 'echarts'
          if (/[\\/]node_modules[\\/](vue|@vue)[\\/]/.test(id)) return 'vue'
          if (/[\\/]node_modules[\\/]maplibre-gl[\\/]/.test(id)) return 'maplibre'
          if (/[\\/]node_modules[\\/](deck\.gl|@deck\.gl)[\\/]/.test(id)) return 'deck'
          return undefined
        },
      },
    },
  },
  test: {
    // M4.3 单元测试：纯函数默认 jsdom 即可运行，composable 冒烟依赖 DOM；
    // e2e 目录归 Playwright（pnpm test:e2e），Vitest 不收集
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
