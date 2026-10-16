import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 冒烟配置（M4.4）：针对生产构建（vite preview）跑三条核心用例，
 * 需先 `pnpm build` 产出 dist/；webServer 自动拉起 preview 服务。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // WebGL 地图对 GPU/上下文敏感，串行执行更稳
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1920, height: 1080 },
  },
  webServer: {
    command: 'pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
