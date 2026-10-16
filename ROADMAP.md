# 寰宇 · 数字地球大屏 后续迭代规划（ROADMAP）

> 基线：里程碑 M1 已交付——大屏外壳（ScreenFit 1920×1080 等比缩放）、标题栏、3D globe 自转（交互暂停/5s 恢复）、2D/3D 投影切换、城市散点、北京飞线（弧线+彗星尾迹）、省界 hover 高亮、热力图开关、TOP5/航线统计面板，控制台零 error。
> 增量 v1.1 已交付——多底图切换（BasemapSwitch：卫星影像[默认]/明亮街景/暗夜深蓝/经典亮色/墨黑极简/银灰浅色，共 6 套全部免 token，`setStyle` 后投影与图层自动恢复；卫星影像为 Esri World Imagery raster 内联样式，瓦片走 `server.arcgisonline.com`）+ 地图操作控件（MapControls：放大/缩小/回正北/复位视角，操作后自转按交互规则暂停）。
> 增量 v1.2 已交付——M2 数据图层与视觉增强全部完成：图层注册机制（registry 描述符声明 8 组图层，useDeckOverlay 仅按注册表聚合）、数据服务层（BoardDataSource 接口 + Mock mulberry32 + Http 占位 + DataV 市界服务含内存缓存）、3D 柱/散点互斥、TripsLayer 轨迹回放、省份下钻（市界描边 + 面包屑返回 + 自转恢复）、时间轴播放器（period 驱动图层与面板联动）、城市中文标注（TOP5 常显 + 次级标注分级显隐）。验收达成：图层增删/切换零改动 overlay 主流程；时间轴播放联动流畅；globe/2D 双模式控制台零 error。
> 增量 v1.3 已交付——M3 交互与体验完善全部完成：图层管理面板（LayerPanel + OpacitySlider，城市/热力/飞线/轨迹/省界/标注六组显隐开关 + 透明度滑杆，热力图 3D 下锁定）、区域快捷导航（RegionNav 六预设机位 flyTo 平滑飞行，2D 模式自动停用自转、切回 3D 恢复）、面板联动（点击城市散点/省份 → TOP5 面板对应行 box-shadow 高亮并 scrollIntoView，反向 hover 面板条目 → 地图高亮）、tooltip 富化（deck `{html}` 卡片内嵌纯 SVG sparkline 近 12 期趋势）、首屏加载体验（BootOverlay 进度条 + TOP5 骨架占位 + 样式加载失败金色降级提示）、大屏轮播模式（12s 定时轮播预设机位，每 2 步推进数据片，ESC 退出并恢复自转）。验收达成：全程鼠标操作；自转/飞行/拾取互不干扰；lint + build 通过，globe/2D 双模式控制台零 error。
> 增量 v1.4 已交付——M4 工程化与性能治理全部完成：图层组级 memo 化（`memoizeGroups` 每组独立 computed 缓存 visible/build，静态层实例跨帧复用，每帧 deck diff 从 8 组降至 2 组，仅 trips/彗星随帧重建）、构建分包（manualChunks 拆分 vue/maplibre/deck vendor chunk，`@turf/turf` 整包改按需 `@turf/distance` + `@turf/great-circle`，业务主包 gzip 805KB → 219KB）、Vitest 单元测试 34 用例（图层纯函数 + memoizeGroups 契约 + useLoopProgress 冒烟）、Playwright E2E 冒烟 3 用例（首屏加载零 error / 2D-3D 切换热力锁定联动 / 区域导航与图层开关全程鼠标操作）、GitHub Actions CI（pnpm lint + test + build + 主包 gzip 预算 900KB 告警）、运行时监控钩子（`src/services/monitor.ts`：webgl-context-lost / style-load-error / data-source-error 三类事件 + 三处接线）。验收达成：测试全绿；业务主包 219.3KB / 预算 900KB；浏览器冒烟控制台零 error；dev server 默认端口调整为 3000。
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

交付说明（技术决策，2026-10-16）：
- **2.4 标注实现由 TextLayer 改为 maplibre 原生 SymbolLayer**：deck.gl 9.4 TextLayer 在 maplibre v5 globe 投影下不渲染像素（最小配置实测复现，2D mercator 正常），属于 deck+maplibre globe 兼容缺陷；Symbol 是 globe 原生支持的标注方案。glyphs 统一归一化为 OpenFreeMap 免 key 字体服务（`tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`，含 CJK，`style.load` 内二次 `setStyle` 完成并以 styleVersion 计数驱动底图切换后重新挂载自定义 source/layer）。TOP5 层开启 `text-allow-overlap`（沪杭/广深近距城市在低 zoom 互挤）；次级层显隐用 paint `step(zoom)` 表达式（zoom 仅可作为顶层 step/interpolate 输入）。
- **热力图锁定 2D 模式**：HeatmapLayer 官方不支持 globe 投影，FlowStatPanel 热力图开关在 3D 模式下禁用并提示「仅 2D」，避免用户误以为功能失效。

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

交付说明（技术决策，2026-10-16）：
- **deck tooltip 渲染契约**：`getTooltip` 返回 `string` 时 deck 走 `textContent` 纯文本渲染，返回 `{ html: string }` 才走 `innerHTML`——富化卡片（sparkline SVG）必须用后者，否则 HTML 源码会被当纯文本显示。registry 的 `LayerTooltip` 类型与 `useDeckOverlay` 返回值已同步对齐该契约。
- **城市历史序列口径**：`BoardDataSource` 新增 `getCityHistory(period, name, count)`；Mock 实现与 `getCities` 共用 `base × factor(period, name, 0.5, 1.25)` 公式，periods 环形回卷逆序取近 12 期，保证趋势线与当期数值连续一致。HttpDataSource 仅占位拒绝。
- **面板联动省份对齐**：`CityMetric` 新增 `province` 字段，取值与 DataV 省界 GeoJSON `properties.name` 全名一致（北京市/广东省等），点击省份后面板按全名匹配高亮，避免简称对不上。
- **Symbol 标注透明度**：major 层直接 `setPaintProperty('text-opacity', v)`；minor 层必须保留 `['step', ['zoom'], 0, 阈值, 0.92*v]` 表达式结构（zoom 仅可作顶层 step/interpolate 输入，M2 决策的延伸）。
- **BootOverlay 降级路径**：样式加载失败（`map.on('error')` 且未就绪）时显示金色内网/弱网提示；该路径代码就位但未断网实测（内网部署时验证）。

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

交付说明（技术决策，2026-10-16）：
- **组级 memo 契约**：`memoizeGroups(descriptors)` 为每组生成两个独立 `computed`——`visible` 只追踪可见性信号、`layers` 只在可见时执行组内 `build()`；deck 对相同实例引用跳过 diff，静态组跨帧实例身份不变（经 `deck.layerManager.getLayers()` 跨帧取样验证：china-provinces/city-points/flow-arcs 均 SAME，flow-trips/flow-comet 按设计随帧重建）。彗星尾迹必须从 arcs 组拆出为独立 `comet` 描述符（order 37），否则会连带静态弧线每帧重建。
- **产物预算口径**：业务主包 = `dist/assets/index-*.js` 合计 gzip（含 maplibre 传递依赖 zod），vue/maplibre/deck vendor chunk 不入预算；`scripts/check-budget.mjs` 以 900KB 为阈值，CI 在 build 后执行。
- **单测注意**：`useLoopProgress` 源码以 `lastTs !== 0` 跳过首帧（浏览器 rAF 时间戳恒为正），测试须用正数时间戳推进；Vitest 需显式 `exclude: [...configDefaults.exclude, 'e2e/**']`，否则会收集 Playwright spec 并报 `test.describe()` 调用位置错误。
- **E2E 配置**：Playwright `webServer` 用 `pnpm preview --port 4173 --strictPort` 走生产构建验证，非 CI 环境 reuseExistingServer；本地沙箱环境下载 Chromium 需放行 `AppData\Local\ms-playwright` 写入（EPERM 限制）。
- **监控接线点**：`useMapLibre`（style-load-error + canvas `webglcontextlost`，卸载时解除监听）、App.vue period 数据拉取 catch（data-source-error/period-fetch）、省份下钻 catch（data-source-error/boundary）；`onMonitorEvent(reporter)` 返回退订函数，reporter 异常被隔离不影响主流程，默认行为 console.warn + 分发。

---

## 已知技术债备忘

- **HeatmapLayer globe 兼容**：官方不支持 globe 投影，M2 已将热力图开关锁定 2D 平面模式（3D 下禁用并提示）；待 deck.gl globe 支持落地后移除锁定即可，图层代码无需改动。
- ~~**省界 hover 残留**~~：已解决——`boardLayers.ts` 对 hover 状态做 rAF 按帧合并（每帧只应用最后一次 onHover 结果，消除快速划过多省时属性全量重建的排队滞后）；实测快速划动后高亮贴合最后停留省份，移出后无残留。注意 `pickRadius` 是 Deck 级 prop（非图层 props，TS2353），如需收紧拾取半径应在 MapboxOverlay 的 Deck 选项上设置，但会全局影响小目标（城市散点）拾取手感，暂不采用。
- **ScreenFit 黑边**：非 16:9 分辨率上下/左右出现纯黑边，可加边缘辉光装饰或背景星点弱化割裂感。
- ~~**turf 依赖体积**~~：已在 M4.2 解决——按需引入 `@turf/distance` + `@turf/great-circle` 替代 `@turf/turf` 整包。

## 里程碑依赖关系

```
M1(已完成) ─→ M2 图层/数据增强 ─→ M3 交互体验 ─→ M4 工程化(可与 M3 并行)
                  │
                  └─ 2.1 图层注册机制是 2.2/2.3/2.5 的前置，建议 M2 首任务
```
