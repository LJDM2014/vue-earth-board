# 寰宇 · 数字地球大屏 后续迭代规划（ROADMAP）

> 基线：里程碑 M1 已交付——大屏外壳（ScreenFit 1920×1080 等比缩放）、标题栏、3D globe 自转（交互暂停/5s 恢复）、2D/3D 投影切换、城市散点、北京飞线（弧线+彗星尾迹）、省界 hover 高亮、热力图开关、TOP5/航线统计面板，控制台零 error。
> 增量 v1.1 已交付——多底图切换（BasemapSwitch：卫星影像[默认]/明亮街景/暗夜深蓝/经典亮色/墨黑极简/银灰浅色，共 6 套全部免 token，`setStyle` 后投影与图层自动恢复；卫星影像为 Esri World Imagery raster 内联样式，瓦片走 `server.arcgisonline.com`）+ 地图操作控件（MapControls：放大/缩小/回正北/复位视角，操作后自转按交互规则暂停）。
> 增量 v1.2 已交付——M2 数据图层与视觉增强全部完成：图层注册机制（registry 描述符声明 8 组图层，useDeckOverlay 仅按注册表聚合）、数据服务层（BoardDataSource 接口 + Mock mulberry32 + Http 占位 + DataV 市界服务含内存缓存）、3D 柱/散点互斥、TripsLayer 轨迹回放、省份下钻（市界描边 + 面包屑返回 + 自转恢复）、时间轴播放器（period 驱动图层与面板联动）、城市中文标注（TOP5 常显 + 次级标注分级显隐）。验收达成：图层增删/切换零改动 overlay 主流程；时间轴播放联动流畅；globe/2D 双模式控制台零 error。
> 增量 v1.3 已交付——M3 交互与体验完善全部完成：图层管理面板（LayerPanel + OpacitySlider，城市/热力/飞线/轨迹/省界/标注六组显隐开关 + 透明度滑杆，热力图 3D 下锁定）、区域快捷导航（RegionNav 六预设机位 flyTo 平滑飞行，2D 模式自动停用自转、切回 3D 恢复）、面板联动（点击城市散点/省份 → TOP5 面板对应行 box-shadow 高亮并 scrollIntoView，反向 hover 面板条目 → 地图高亮）、tooltip 富化（deck `{html}` 卡片内嵌纯 SVG sparkline 近 12 期趋势）、首屏加载体验（BootOverlay 进度条 + TOP5 骨架占位 + 样式加载失败金色降级提示）、大屏轮播模式（12s 定时轮播预设机位，每 2 步推进数据片，ESC 退出并恢复自转）。验收达成：全程鼠标操作；自转/飞行/拾取互不干扰；lint + build 通过，globe/2D 双模式控制台零 error。
> 增量 v1.4 已交付——M4 工程化与性能治理全部完成：图层组级 memo 化（`memoizeGroups` 每组独立 computed 缓存 visible/build，静态层实例跨帧复用，每帧 deck diff 从 8 组降至 2 组，仅 trips/彗星随帧重建）、构建分包（manualChunks 拆分 vue/maplibre/deck vendor chunk，`@turf/turf` 整包改按需 `@turf/distance` + `@turf/great-circle`，业务主包 gzip 805KB → 219KB）、Vitest 单元测试 34 用例（图层纯函数 + memoizeGroups 契约 + useLoopProgress 冒烟）、Playwright E2E 冒烟 3 用例（首屏加载零 error / 2D-3D 切换热力锁定联动 / 区域导航与图层开关全程鼠标操作）、GitHub Actions CI（pnpm lint + test + build + 主包 gzip 预算 900KB 告警）、运行时监控钩子（`src/services/monitor.ts`：webgl-context-lost / style-load-error / data-source-error 三类事件 + 三处接线）。验收达成：测试全绿；业务主包 219.3KB / 预算 900KB；浏览器冒烟控制台零 error；dev server 默认端口调整为 3000。
> 增量 v1.5 已交付——M5 数据真实化与扩容全部完成（评审反馈「数据太少不真实」闭环）：城市样本 14 → 75 座覆盖全部 31 个省级行政区（`src/mock/cities.ts` 携 GDP rank）；时序生成核心 `src/mock/series.ts`（`base × trend × season × (1+noise)`：Zipf 基数 + 城市差异化年增 6~16% + 春运/暑期/黄金周尖峰 + mulberry32 可复现噪声，getCities/getCityHistory/getFlows 同源同口径）；多指标模型（heat/passenger/economy 三指标 + `MetricSwitch` 切换器，散点/热力/TOP5/tooltip/标注全局联动，`activeMetric` 状态提升 App.vue、`activeCities` computed 重映射 value 快照使图层读取路径零改动）；OD 网络 13 → 46 条多枢纽（北京/上海/广州/成都/西安五枢纽 + 双向对 + 客运青/货运金类别着色 + P50/P90 分位三档弧宽）。验收达成：lint + 52 单测 + build 全绿（主包 gzip 221.7KB）；浏览器 globe/2D 双模式回归通过，TOP5 数值非整齐数带单位，sparkline 呈现趋势/尖峰/波动；console 仅卫星瓦片 ERR_ABORTED（沙箱网络，非代码 error）。
> 增量 v1.6 已交付——M6 面板与弹窗视觉精修全部完成（评审反馈「不够好看、弹窗样式需重做」闭环）：统一面板外壳 `PanelChrome.vue`（右上/左下 12px 切角双层 clip-path 发光描边 + 左上/右下 L 形辉光角标 + 切角斜边高光 + 标题槽竖光条与渐变消隐线 + 底部 8s 扫描光，`prefers-reduced-motion` 兜底，三面板全部换装、全局 `.panel` 样式删除、布局宽度收口 App.vue）；TOP5 榜单精修（TOP3 菱形金银铜徽章 + 分段刻度条流光 + `useCountUp`/`CountNumber` 数值滚动 + 环比箭头（历史倒数第二期口径，<0.05% 视为持平）+ 省份简称/次指标微缩行 + 指标切换 FLIP 排名补间）；航线监测面板重构（3 指标卡 count-up + 单位 + 环比（App.vue 增拉上一期 `prevFlows`）+ 新增航线运量 TOP8 榜单（客/货类别色点 + 运量条 + 细滚动条 + 骨架）+ hover 行 → 弧线高亮联动（`hoverFlow` 经 App.vue 下发，命中弧线提亮加粗、其余压暗，彗星尾迹同步压暗至 30%））；tooltip 毛玻璃卡片（blur(8px) + 发光描边 + 左侧指标色条随激活指标着色 + 主指标大数字 + 环比 + sparkline 放大 160×36 渐变面积 + 三指标微缩行，`METRIC_TINT` 指标色 token 入 theme）。验收达成：lint + 59 单测（新增 useCountUp 4 例 + 弧线高亮 3 例）+ build 全绿（主包 gzip 224KB）；浏览器 globe/2D 双模式回归 9 项通过，HTML 无源码文本泄漏，console 仅既有卫星瓦片 ERR_ABORTED（沙箱网络）。
> 增量 v1.7 已交付——M7 数据接入实战化全部完成（大屏从「演示样例」升级为「可接真实后端的产品」）：DTO 契约层（`src/services/dto.ts`，zod schema + adaptCityMetrics/adaptFlows/adaptPeriods/adaptHistory 适配器，脏数据逐条拦截上报 `data-source-error/contract/*` 不抛断大屏、缺省字段 catch 补齐）；HttpDataSource 生产实现（AbortController 8s 超时 + 指数退避重试 200/800ms，4xx 除 404/408/429 不重试，history 端点 404 静默返回空数组隐藏 sparkline）；数据源工厂 `createDataSource`（`VITE_DATA_SOURCE=mock|http` 可配置切换，http 模式 listPeriods 连通预检失败自动回落 mock 并上报 `fallback`，TitleBar 新增数据来源角标：mock=演示数据/http=实时数据/降级=金色演示数据）；WS 推送通道（`RealtimeCapable` 能力接口 + 运行时探测，`WsDataSource` 懒建连/断线指数退避重连上限 30s/20s 心跳/消息帧经契约校验后分发，MockDataSource 内置 5s ±1% 微扰推送支撑本地演示链路）；`useBoardData` 数据域抽离（period→cities/flows/history/prevFlows 统一加载，LRU 12 期缓存周期回切零网络请求，可选轮询刷新，具备推送能力的数据源自动订阅/切期退订）；App.vue 瘦身 510 → 248 行（数据/下钻/轮播/图层开关四域拆分为 useBoardData/useProvinceDrill/useTourMode/useLayerToggles，布局定位样式移至 style.css）。回归中修复两处问题：布局样式全局化后 `.map-container` 与 maplibre `.maplibregl-map{position:relative}` 同优先级被覆盖致容器塌陷（改两级选择器 `.board .map-container`）；BootOverlay 进度监听 `once:true` 竞态——首次变化 8→55 即销毁监听器错过 55→100，引导层在地图先就绪时永久卡住（改 fadeScheduled 守卫）。验收达成：lint + 95 单测（新增 dto 8 / http 8 / ws 5 / 工厂 3 / Mock 推送 3 / useBoardData 9）+ build 全绿；浏览器双模式回归通过——mock 模式角标「演示数据」青色、`VITE_DATA_SOURCE=http` + 错误地址自动降级金色角标且大屏正常渲染不白屏、fallback 事件正确上报、周期切换 75 城数据联动正常，控制台零意外 error。
> 增量 v1.8 已交付——M8 视觉氛围与多主题全部完成：黑边治理（ScreenFit 三层深空渐变底 + 两层 box-shadow 静态星点约 34 颗 + 舞台辉光描边 + 7s 呼吸动画，`prefers-reduced-motion` 降级）；多主题 token 化（`src/config/theme.ts` 三主题注册表 deep-space 深空青/violet-night 紫夜/aurora-teal 极光青，UI 侧 `THEME`/`DECK_COLORS` 双 reactive + `setTheme` 即时切换，CSS 侧 `:root` 定义 `--xb-*` hex+rgb 通道双份变量、`[data-theme]` 覆盖，15 个组件全量迁移 CSS 变量，deck 图层侧 tooltip/sparkline/弧线取色函数化随 reactive 实时取色，flightArcs 模块顶层色值快照改 build 时读取修复主题切换不生效，SVG presentation attribute 不支持 var() 处改内联 style）；TitleBar 主题切换胶囊（三色点 + currentColor 辉光激活描边）；入场编排（BootOverlay `@gone` 后 `.board.entered` 触发 `data-enter` + `--enter-order` stagger 300ms/级升起动画，独立 CSS translate 属性补间避免覆盖居中 transform，地图初始 zoom-0.9 开场 flyTo 2.5s 推近、`moveend` 桥接后启自转）；装饰层（标题栏 8s 横扫扫描光 + 端点呼吸圆点 + 标题双层辉光，`.board::before` 单伪元素 8 段渐变拼四角 HUD 角标）。验收达成：lint + 95 单测（弧线高亮断言改主题派生色）+ build 全绿；浏览器 globe/2D 双模式回归通过——三主题切换 dataset.theme 与面板/deck 配色即时生效、入场编排与开场推近正常，控制台零 error。
> 增量 v1.9 已交付——M9 运行时运维与自适应全部完成：运行 HUD（`DebugHud.vue`，仅 `?debug=1` 时渲染——无参数零 DOM 节点零 rAF，rAF 计帧 1s 聚合出 FPS/帧耗时/JS 堆（`performance.memory` 存在才显示），另显示当前周期与数据源 kind，右下角 pointer-events:none 不挡地图）；监控上报落地（`HttpReporter` 批量缓冲——满 10 条或 5s 定时 flush，报文 `{sessionId, dwellMs, events}`，`main.ts` 在配置了 `VITE_MONITOR_URL` 时接线，卸载/页面隐藏场景 sendBeacon 优先、失败回落 fetch keepalive，双失败静默不打断主流程）；崩溃自愈看门狗（`reloadGuard.ts` + `useWatchdog.ts` 三层自愈：①webglcontextlost 生产门禁 3s 后整页重载，`sessionStorage` 记录 10 分钟窗口内已重载 ≥3 次则放弃防循环（存储异常 fail-open）；②连续 3 次 `data-source-error` 且当前为 http 源 → 自动回落 MockDataSource + 金色降级角标；③`visibilitychange` 离开超 30 分钟回前台强刷当前期；④轮播曾启动过、退出后 60s 无任何交互自动重启轮播，pointerdown/wheel/keydown 任一交互即重置）；运行配置化（`src/config/runtime.ts` zod schema 校验——`VITE_BOARD_CONFIG` 内联 JSON 优先 > fetch `/board.config.json`（404/网络异常静默）> 全缺省，非法字段逐项回落缺省、非法整体整体回退并上报 `runtime-config` 事件；可配 title/dataSource/refreshIntervalMs/theme/defaultMetric/tourStepMs/tourPeriodEvery/defaultCameraId，应用侧 `boardConfig` 全局 ref 响应式消费：TitleBar 标题、useBoardData 轮询间隔（间隔改响应式支持配置加载后动态启停）、useTourMode 轮播节奏、初始指标/机位；缺省配置零行为变化）。验收达成：lint + 127 单测（新增 monitor 8 / reloadGuard 4 / useWatchdog 10 / runtime 10）+ build 全绿（主包 gzip 229KB / 预算 900KB）；浏览器回归——无 debug 参数 HUD 不存在、`?debug=1` 五行数值每秒刷新、切 2D 后 HUD 存活，全程控制台零 error。评审后修复两处问题：①面板堆叠——PanelChrome scoped 样式 `.panel-chrome[data-v-x]{position:relative}` 特异性 0-2-0 压过 style.css `.panel-pos{position:absolute}` 0-1-0（position 逐项覆盖），FlowStatPanel 退化文档流与左栈重叠，`panel-pos` 加 `!important` 恢复绝对定位；②城市标注长小数——mock 指标原始浮点直入 symbol text-field 上屏，getCities 生成与推送 jitter 两处 `Math.round` 取整；③DebugHud 与地图操作框重叠——HUD bottom 88px 落在 6 按钮竖排操作框（高 188px）区间内，上移至 bottom 232px 预留 14px 间距；④面板内容排版走查——TOP5 标题槽内 MetricSwitch 被挤压致按钮文字换行成竖字（seg/seg-btn 加 flex:none + nowrap 并收紧尺寸，chrome-title 加 flex:none 防压缩）、航线指标卡「29,191万人次」20px 字号在三等分卡内换行撑高卡片（值 18px + 单位 9px + nowrap，卡高 104→76px）、TOP5 城市副行 74px 宽不足打出省略号（加宽至 84px）。
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
- ~~**ScreenFit 黑边**~~：已在 M8.1 解决——非 16:9 分辨率的黑边区域改为深空渐变底 + 静态星点，舞台边缘辉光描边弱化割裂感。
- ~~**turf 依赖体积**~~：已在 M4.2 解决——按需引入 `@turf/distance` + `@turf/great-circle` 替代 `@turf/turf` 整包。

## 里程碑依赖关系

```
M1(已完成) ─→ M2 图层/数据增强 ─→ M3 交互体验 ─→ M4 工程化(可与 M3 并行)
                  │
                  └─ 2.1 图层注册机制是 2.2/2.3/2.5 的前置，建议 M2 首任务
```
