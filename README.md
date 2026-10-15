# 寰宇 · 数字地球可视化大屏（vue-earth-board）

纯展示型 2D/3D 地理数据大屏，深色科技风。基于 MapLibre GL JS v5 单实例双投影（globe / mercator）+ deck.gl v9 数据图层（经 MapboxOverlay 叠加），无任何需要 API key 的云服务。

## 启动

```bash
pnpm install
pnpm dev        # 开发预览 http://localhost:5173
pnpm build      # 类型检查 + 生产构建
pnpm lint       # ESLint
```

## 技术栈

- Vite 7 + Vue 3.5（`<script setup>` + TypeScript strict）
- MapLibre GL JS v5：`setProjection()` 在 globe / mercator 间平滑切换
- deck.gl v9：ScatterplotLayer / ArcLayer / GeoJsonLayer / HeatmapLayer，经 MapboxOverlay 挂载
- 底图：内置 6 套免 token 底图——默认 Esri World Imagery 卫星影像，另有明亮街景与深浅色矢量（Carto / OpenFreeMap）

## 功能

- 1920×1080 设计基准，ScreenFit 等比缩放自适应任意分辨率
- 3D 地球缓慢自转，用户交互暂停、5 秒后恢复；2D/3D 一键切换且图层无感保持
- 六套免 token 底图一键切换（卫星影像默认 / 明亮街景 / 暗夜深蓝 / 经典亮色 / 墨黑极简 / 银灰浅色），放大 / 缩小 / 回正北 / 复位视角控件
- 城市散点（指标映射半径/颜色）、北京出发飞线（弧线 + 彗星尾迹动画）、省界描边（hover 高亮 + tooltip）
- 城市热力图开关、TOP5 城市榜、航线运输统计

## 目录结构

```
src/
  App.vue                    # 大屏外壳：状态提升 + 左右面板 + 中央地图
  config/
    basemap.ts               # 底图配置（6 套免 token，卫星影像默认，预留天地图 tk / 自托管瓦片占位）
    theme.ts                 # 深色主题色板（CSS v-bind 与 deck 颜色常量）
  composables/
    useMapLibre.ts           # 地图初始化 / 投影切换 / 自转 / resize / 清理
    useDeckOverlay.ts        # deck 图层聚合（computed）+ overlay.setProps 同步
  map/layers/                # 数据图层纯函数封装
    scatterPoints.ts         # 城市散点 + 亮斑
    flightArcs.ts            # 飞线弧线 + 彗星尾迹（turf 大圆插值）
    regionGeoJson.ts         # 省界填充描边 + hover 高亮
    heatmap.ts               # 热力图
  components/
    ScreenFit.vue            # 1920×1080 等比缩放容器
    TitleBar.vue             # 顶部标题栏
    ModeSwitch.vue           # 2D/3D 切换按钮
    BasemapSwitch.vue        # 底图切换选择器（左下角，弹出式列表）
    MapControls.vue          # 缩放 / 回正北 / 复位控件（右下角竖排）
  panels/
    TopCityPanel.vue         # TOP5 城市列表
    FlowStatPanel.vue        # 飞线统计 + 热力开关
  mock/                      # 城市指标 / 飞线 OD 数据
  data/
    china-provinces.geojson  # 中国省级行政区（构建期打包，运行时零请求）
```

## 关键实现约定

- 地图实例、MapboxOverlay、deck 图层一律 `shallowRef + markRaw`，严禁深层响应式代理
- deck overlay 必须等地图 `load` 事件（`mapReady`）后挂载——maplibre v5 的 `getProjection()` 在样式未初始化前调用会抛错
- 图层更新走响应式管线：mock 数据 ref → computed 生成 Layer → watch 后 `overlay.setProps({ layers })`
- 卸载时 `map.remove()` / `overlay.finalize()`，防止热重载实例泄漏
