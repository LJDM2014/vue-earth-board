import { expect, test, type Page } from '@playwright/test'

/** 收集 error 级控制台消息与未捕获异常（M4.4 验收：控制台零 error） */
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(String(err)))
  return errors
}

/** 等待首屏引导完成：进度条出现「就绪」并淡出卸载 */
async function waitBoot(page: Page) {
  await expect(page.getByText('就绪')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('就绪')).toBeHidden({ timeout: 15_000 })
}

const heatmapToggle = (page: Page) => page.getByRole('button', { name: '切换城市热力图' })

test.describe('寰宇数字地球大屏 E2E 冒烟', () => {
  test('首屏加载完成：canvas 与三面板就位，控制台零 error', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await waitBoot(page)

    const canvas = page.locator('.map-container canvas')
    await expect(canvas).toBeVisible()
    await expect(page.getByText('城市热度 TOP5')).toBeVisible()
    await expect(page.getByText('图层管理')).toBeVisible()
    await expect(page.getByText('航线运输监测')).toBeVisible()

    expect(errors).toEqual([])
  })

  test('2D/3D 投影切换：热力图开关随模式锁定/解锁', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await waitBoot(page)

    const toggle = heatmapToggle(page)
    // 3D globe 下热力图锁定（仅 2D），标签提示「热力图 · 仅2D」
    await expect(page.getByText('热力图 · 仅2D')).toBeVisible()
    await expect(toggle).toBeDisabled()

    // 切到 2D：开关解锁并开启热力图
    await page.getByRole('button', { name: '2D 平面' }).click()
    await expect(page.getByText('城市热力图')).toBeVisible()
    await expect(toggle).toBeEnabled()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // 切回 3D：开关重新锁定
    await page.getByRole('button', { name: '3D 地球' }).click()
    await expect(page.getByText('热力图 · 仅2D')).toBeVisible()
    await expect(toggle).toBeDisabled()

    expect(errors).toEqual([])
  })

  test('区域导航与图层开关可用（全程鼠标操作）', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('/')
    await waitBoot(page)

    // 六个预设机位 + 轮播按钮均在导航条上
    for (const preset of ['全国', '华东', '华南', '成渝', '西部', '东北']) {
      await expect(page.getByRole('button', { name: preset, exact: true })).toBeVisible()
    }
    // 点击机位后按钮高亮（active 状态由样式类承载，这里验证可点击且无异常）
    await page.getByRole('button', { name: '华东', exact: true }).click()

    // 图层开关：关闭再打开省界描边
    const regionToggle = page.getByRole('button', { name: '切换省界描边' })
    await regionToggle.click()
    await expect(regionToggle).toHaveAttribute('aria-pressed', 'false')
    await regionToggle.click()
    await expect(regionToggle).toHaveAttribute('aria-pressed', 'true')

    expect(errors).toEqual([])
  })
})
