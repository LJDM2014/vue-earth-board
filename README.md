# 寰宇 · 数字地球可视化大屏（vue-earth-board）

纯展示型 2D/3D 地理数据大屏，深色科技风。基于 MapLibre GL JS v5 单实例双投影（globe / mercator）+ deck.gl v9 数据图层（经 MapboxOverlay 叠加），无任何需要 API key 的云服务。

## 启动

```bash
pnpm install
pnpm dev        # 开发预览 http://localhost:3000
pnpm build      # 类型检查（vue-tsc）+ 生产构建
pnpm lint       # ESLint
pnpm test       # Vitest 单元测试
pnpm test:e2e   # Playwright E2E
pnpm check:size # 构建产物体积预算检查
```

## 技术栈

- Vite 7 + Vue 3.5（`<script setup>` + TypeScript strict）
- MapLibre GL JS v5：`setProjection()` 在 globe / mercator 间平滑切换
- deck.gl v9：ScatterplotLayer / ColumnLayer / ArcLayer / GeoJsonLayer / HeatmapLayer / TripsLayer，经 MapboxOverlay 挂载
- 底图：内置 3 套免 token 底图——卫星影像（Esri World Imagery，默认）、街景地图（OpenFreeMap Liberty）、地形晕渲（Esri World Terrain Base 压暗处理）

## 功能

### 地图与底图

- 3D 地球缓慢自转，用户交互暂停、5 秒后恢复，可手动关闭；2D 平面模式下自转停用，切回 3D 后恢复原状态
- 三套免 token 底图一键切换（样式重载后投影、自定义图层自动恢复/重挂）
- 地图注记叠加：在卫星/地形等无注记瓦片上叠加中文地名（行政区划 + 水系，OpenFreeMap 矢量源，中文优先取名），可开关、可调透明度
- 城市中文标注：maplibre 原生 symbol 图层，TOP5 常显、其余城市超过缩放阈值后分级出现
- 放大 / 缩小 / 回正北 / 复位视角控件

### 数据图层

- 城市图层：光点散点 / 3D 柱两种呈现（互斥切换），指标映射半径与颜色
- 城市热力图（HeatmapLayer 仅 2D 平面模式生效，3D 下自动锁定并提示）
- 北京出发飞线弧线（大圆插值 + 彗星尾迹动画）、轨迹回放（TripsLayer）
- 省界描边：hover 高亮 + tooltip；点击省份下钻市界（面包屑导航，返回全国自动恢复自转与视角）
- 图层管理面板：各图层独立开关 + 透明度滑杆；地图 hover 高亮与左侧榜单联动
- 城市 tooltip 内嵌近 12 期指标 sparkline，与当前期数据连续

### 大屏交互

- 1920×1080 设计基准，ScreenFit 等比缩放自适应任意分辨率
- 时间轴播放器：按周期（月）切换数据片，驱动图层与面板同步刷新
- 区域导航：预设机位（华东/华南/成渝/西部/东北）平滑飞行；大屏轮播模式按机位循环并自动推进数据周期，ESC 退出
- 首屏引导 BootOverlay：地图引擎 → 底图/数据 → 就绪淡出，弱网/内网样式加载失败时降级提示
- 前端监控上报：样式加载失败、数据源异常、WebGL 上下文丢失等事件（`services/monitor.ts`）

### 数据服务

- `BoardDataSource` 接口抽象：默认 `MockDataSource`（内存模拟，含周期列表/城市指标/飞线 OD/历史序列），预留 `HttpDataSource` 接真实后端
- 省市边界 GeoJSON 内存缓存（`boundaryService`），下钻零重复请求

## 目录结构

```
src/
  App.vue                    # 大屏外壳：状态提升 + 左右面板 + 中央地图
  config/
    basemap.ts               # 底图配置（卫星影像 / 街景地图 / 地形晕渲，均免 token）
    cameras.ts               # 预设机位与轮播参数
    theme.ts                 # 深色主题色板（CSS v-bind 与 deck 颜色常量）
  composables/
    useMapLibre.ts           # 地图初始化 / 双投影切换 / 自转 / glyphs 归一化 / 清理
    useDeckOverlay.ts        # deck 图层聚合 + overlay.setProps 同步 + tooltip
    useCityLabels.ts         # 城市中文标注（原生 symbol，TOP5 + 分级显隐）
    useMapAnnotations.ts     # 瓦片底图上的矢量地名注记叠加
    useLoopProgress.ts       # 全局循环进度（彗星尾迹/轨迹共用时间基准）
  map/layers/                # 数据图层纯函数封装
    boardLayers.ts           # 图层描述符注册表（createBoardDescriptors）
    registry.ts              # 描述符 → deck 图层实例的装配
    scatterPoints.ts         # 城市散点 + 亮斑
    metricColumns.ts         # 3D 柱状
    metricScale.ts           # 指标 → 半径/颜色/高度映射
    flightArcs.ts            # 飞线弧线 + 彗星尾迹（turf 大圆插值）
    tripTracks.ts            # 轨迹回放
    heatmap.ts               # 热力图
    regionGeoJson.ts         # 省界填充描边 + hover 高亮
    drillBoundary.ts         # 市界下钻描边
  components/
    ScreenFit.vue            # 1920×1080 等比缩放容器
    TitleBar.vue             # 顶部标题栏
    ModeSwitch.vue           # 2D/3D 切换按钮
    BasemapSwitch.vue        # 底图切换选择器（左下角，弹出式列表）
    MapControls.vue          # 缩放 / 回正北 / 复位 / 自转开关（右下角竖排）
    RegionNav.vue            # 区域导航 + 轮播模式
    TimelinePlayer.vue       # 周期时间轴播放器
    DrillBreadcrumb.vue      # 省份下钻面包屑
    BootOverlay.vue          # 首屏引导/降级提示
  panels/
    TopCityPanel.vue         # TOP5 城市列表（hover/click 双向联动）
    FlowStatPanel.vue        # 航线运输统计
    LayerPanel.vue           # 图层管理（开关 + 透明度滑杆）
    ToggleSwitch.vue / OpacitySlider.vue  # 面板通用控件
  services/
    dataSource.ts            # BoardDataSource 接口
    mockDataSource.ts        # 内存模拟数据源（默认）
    httpDataSource.ts        # HTTP 数据源（预留接真实后端）
    boundaryService.ts       # 省市边界 GeoJSON 加载与内存缓存
    monitor.ts               # 前端监控事件上报
  mock/                      # 城市指标 / 飞线 OD 模拟数据
  data/
    china-provinces.geojson  # 中国省级行政区（构建期打包，运行时零请求）
e2e/
  board.spec.ts              # Playwright 大屏冒烟用例
scripts/
  check-budget.mjs           # 构建产物体积预算检查
```

## 关键实现约定

- 地图实例、MapboxOverlay、deck 图层一律 `shallowRef + markRaw`，严禁深层响应式代理
- deck overlay 必须等地图 `load` 事件（`mapReady`）后挂载——maplibre v5 的 `getProjection()` 在样式未初始化前调用会抛错
- 底图切换 / glyphs 归一化会重载样式并清空自定义 source/layer：`styleVersion` 计数器驱动注记、城市标注等 maplibre 自定义图层自动重挂
- glyph 字体统一归一化到 OpenFreeMap 免 key 字体服务（含 CJK）；街景底图必须选 OpenFreeMap 自家样式（Carto 样式的复合字体栈在该字体服务上 404）
- globe 投影下 deck TextLayer 不渲染，文字标注一律用 maplibre 原生 symbol 图层；HeatmapLayer 不支持 globe，热力图开关在 3D 下锁定
- 图层更新走响应式管线：数据 ref → computed 描述符 → watch 后 `overlay.setProps({ layers })`；hover 驱动的重建需 rAF 合帧
- 卸载时 `map.remove()` / `overlay.finalize()`，防止热重载实例泄漏
