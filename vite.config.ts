import vue from '@vitejs/plugin-vue'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 开发服务器固定端口（默认 5173 → 3000）
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        // M4.2 分包：重型三方库与业务代码隔离，业务主包（index）保持小体积可缓存，
        // CI 产物预算（gzip 主包 < 900KB）仅考核业务主包
        manualChunks: {
          vue: ['vue'],
          maplibre: ['maplibre-gl'],
          deck: [
            'deck.gl',
            '@deck.gl/core',
            '@deck.gl/layers',
            '@deck.gl/geo-layers',
            '@deck.gl/aggregation-layers',
            '@deck.gl/mapbox',
          ],
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
