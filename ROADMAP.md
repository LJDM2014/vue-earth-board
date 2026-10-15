# 寰宇 · 数字地球大屏 后续迭代规划（ROADMAP）

> 基线：里程碑 M1 已交付——大屏外壳（ScreenFit 1920×1080 等比缩放）、标题栏、3D globe 自转（交互暂停/5s 恢复）、2D/3D 投影切换、城市散点、北京飞线（弧线+彗星尾迹）、省界 hover 高亮、热力图开关、TOP5/航线统计面板，控制台零 error。
> 增量 v1.1 已交付——多底图切换（BasemapSwitch：卫星影像[默认]/明亮街景/暗夜深蓝/经典亮色/墨黑极简/银灰浅色，共 6 套全部免 token，`setStyle` 后投影与图层自动恢复；卫星影像为 Esri World Imagery raster 内联样式，瓦片走 `server.arcgisonline.com`）+ 地图操作控件（MapControls：放大/缩小/回正北/复位视角，操作后自转按交互规则暂停）。
> 原则延续：单 MapLibre 实例 + MapboxOverlay；实例一律 `shallowRef + markRaw`；图层纯函数 + computed 聚合；状态提升 App.vue（props/emits，不引 pinia）；不引入需要 API key 的云服务。

---

## M2 数据图层与视觉增强（下一里程碑）

目标：从「演示样例」升级为「可承载真实业务数据的多图层大屏」。

| # | 任务 | 说明 | 优先级 |
|---|------|------|--------|
| 2.1 | 图层注册机制 | 新增 `src/map/layers/registry.ts`：以描述符（id/类型/可见性/z序/数据映射）声明图层，`useDeckOverlay` 按注册表聚合，替代当前硬编码拼接 | 高 |
| 2.2 | 3D 柱状聚合 | `ColumnLayer`/`HexagonLayer` 呈现城市指标 3D 柱（globe 模式视觉冲击强），与散点互斥切换 | 高 |
| 2.3 | 动态轨迹层 | `TripsLayer` 模拟航班/物流轨迹回放（timestamp 驱动），复用现有 rAF progress 管线 | 高 |
| 2.4 | 城市中文标注 | `TextLayer` 城市名/指标值常显标注，zoom 分级显隐（characterSet 需包含中文常用字） | 中 |
| 2.5 | 省份下钻 | 点击省份 → 动态加载市级 GeoJSON（DataV `areas_v3/bound/{adcode}_full.json`）→ 市界描边+面包屑返回；数据遵循 M1 原则：构建期预取常用省份 or 运行时拉取后写入内存/IndexedDB 缓存 | 中 |
| 2.6 | 时间轴播放器 | 新增 `TimelinePlayer.vue`：按月份/时段切片 mock 数据，播放/暂停/拖动，数据切换驱动图层与面板联动 | 中 |
| 2.7 | 数据服务层抽象 | `src/services/`：`DataSource` 接口 + `MockDataSource`（现有 mock 包装）+ `HttpDataSource` 占位（REST/WS 描述，不实现），面板与图层只依赖接口 | 中 |

验收：新增/切换至少 3 种图层均无需改动 `useDeckOverlay` 主流程；点击省份可下钻并返回；时间轴播放时图层与面板同步刷新且不掉帧。

## M3 交互与体验完善

目标：大屏「可操作、可讲解」。

| # | 任务 | 说明 | 优先级 |
|---|------|------|--------|
| 3.1 | 图层管理面板 | 各图层显隐开关 + 透明度滑杆（复用 FlowStatPanel 的开关样式），状态集中在 App.vue | 高 |
| 3.2 | 区域快捷导航 | 预设机位（华东/华南/西部等），`flyTo` 平滑过渡（基础缩放/复位已由 MapControls 提供）；2D 模式下停用自转改为罗盘复位按钮 | 中 |
| 3.3 | 面板联动 | 点击散点/省份 → 左侧面板高亮对应城市/省份并滚动到可视区；反向 hover 面板条目 → 地图高亮 | 中 |
| 3.4 | tooltip 富化 | 悬浮卡片内嵌 sparkline 迷你趋势（纯 CSS/SVG，不引图表库），显示近 12 期指标 | 中 |
| 3.5 | 首屏加载体验 | `index.html` 深色底已有；补地图/数据就绪进度条与骨架占位，样式加载失败（内网）时给出降级提示 | 中 |
| 3.6 | 大屏轮播模式 | 定时轮播预设机位 + 数据片，用于展厅无人值守场景（ESC 退出） | 低 |

验收：全程鼠标操作无需键盘；交互过程中自转/动画/拾取互不干扰；控制台保持零 error。

## M4 工程化与性能治理

目标：为长期迭代与真实数据接入打地基。

| # | 任务 | 说明 | 优先级 |
|---|------|------|--------|
| 4.1 | 图层实例 memo 化 | 当前 progress 每帧重算全部图层（region/points/arc 均重建实例）；改为静态层用 `computed` 独立 memo、仅彗星层随帧更新，降低 deck diff 压力 | 高 |
| 4.2 | 构建分包 | 主 chunk 2.7MB：`manualChunks` 拆分 maplibre/deck/turf/业务代码；评估去掉 @turf/turf 整包、改为按需引入 `@turf/distance` 等 | 高 |
| 4.3 | 单元测试 | 引入 Vitest：图层纯函数（`buildCometPoints`/`interpolatePath`/值域归一化）优先覆盖；composable 用 @vue/test-utils 冒烟 | 中 |
| 4.4 | E2E 冒烟 | Playwright：加载完成断言（canvas 存在、面板渲染、无 console error）、2D/3D 切换、热力开关三条用例 | 中 |
| 4.5 | CI 流水线 | GitHub Actions：pnpm lint + build + test；产物大小预算告警（如 gzip 主包 > 900KB 失败） | 低 |
| 4.6 | 运行时监控钩子 | 预留 `onError` 上报位（WebGL context lost、样式加载失败、数据接口异常），大屏现场可快速定位 | 低 |

验收：`pnpm build` 主包 gzip 显著下降；测试全绿进入 CI；图层重建次数（可用 deck stats/log 验证）明显减少。

---

## 已知技术债备忘

- **HeatmapLayer globe 兼容**：开启热力时 luma.gl 报 `weightsTexture` 绑定 warn（仅 warn 不影响渲染）；关注 deck.gl 更新，必要时对 globe 模式降级为密集散点模拟。
- **省界 hover 残留**：鼠标快速划过多省时高亮更新有肉眼可感知延迟，可在 M3.3 联动时一并优化（hover 节流 + 仅省份层参与拾取时降低 pickRadius）。
- **ScreenFit 黑边**：非 16:9 分辨率上下/左右出现纯黑边，可加边缘辉光装饰或背景星点弱化割裂感。
- **turf 依赖体积**：`@turf/turf` 全量引入仅用到 greatCircle/distance，M4.2 时按需替换。

## 里程碑依赖关系

```
M1(已完成) ─→ M2 图层/数据增强 ─→ M3 交互体验 ─→ M4 工程化(可与 M3 并行)
                  │
                  └─ 2.1 图层注册机制是 2.2/2.3/2.5 的前置，建议 M2 首任务
```
