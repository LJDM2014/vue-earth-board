# 大屏增强：全国环比 KPI + 航线 TOP10 + 省份聚合玫瑰图

## Context

用户认为大屏内容偏简单，从候选清单中选定第一档三项（零新增数据，纯前端聚合）：

1. **环比涨跌 KPI** — 现状缺口：FlowStatPanel 已有航线侧 3 个带环比的 KPI，TopCityPanel 每行有环比箭头，但缺「全国口径」三指标总量 KPI。
2. **航线 TOP10 排行** — 现状 FlowStatPanel 已有 TOP8 榜单，升级为 TOP10。
3. **省份聚合玫瑰图** — 完全缺失，新增 ECharts 夜莺玫瑰图面板。

数据源：现有 `cities`（75 城 × 3 指标，含 `province` 字段）+ `cityHistory`，零后端改动；唯一数据层变更是给快照补 `prevCities`（上一期城市，镜像既有 `prevFlows` 模式），用于全国环比。

## 布局结论（1080p 纵向预算 ~832px）

- **左栈**（`left-stack`，现有）：新增「全国总览」KPI 面板置于栈顶 → TopCityPanel → LayerPanel，总高 ~730px ✓
- **右列**：把 FlowStatPanel 从绝对定位改为新建 `.right-stack` 弹性栈（镜像 `.left-stack`），栈内 = FlowStatPanel（TOP10）+ 新增省份玫瑰图面板，总高 ~815px ✓
- 玫瑰图随 `activeMetric` 联动（与全大屏口径一致）

## 改动清单

### 1. 数据层：`src/composables/useBoardData.ts`

- `PeriodSnapshot` 增加 `prevCities: CityMetric[] | null`
- `loadSnapshot` 的 `Promise.all` 增加一支：`prevPeriod ? ds.getCities(prevPeriod) : null`（与 prevFlows 完全同构，LRU 缓存自动覆盖）
- `subscribeCities` 推送路径的 `applySnapshot` 调用补 `prevCities: prevCities.value`
- 返回值导出 `prevCities`

### 2. 新增 `src/panels/NationKpiPanel.vue`（全国总览 KPI）

- PanelChrome `title="全国总览"`；props：`cities`、`prevCities`
- 三张卡（复用 FlowStatPanel `.stat-grid` 视觉模式）：热度总量 / 客流总量（万人次）/ 经济总量（亿元），`CountNumber` 动数 + `METRIC_DEFS[m].unit`
- 环比：`pctOf(curr, prev)` 同 FlowStatPanel 口径（<0.05% 持平显示"— 持平"）；首期 prevCities=null 同样持平
- 复用 `src/panels/CountNumber.vue`

### 3. 新增 `src/panels/ProvincePanel.vue`（省份玫瑰图）

- PanelChrome 动态标题：`` `省份${METRIC_DEFS[metric].short}分布` ``（省份热度/客流/经济分布）
- props：`cities: CityMetric[]`（App.vue 传 `activeCities`）、`metric`
- 纯聚合函数 `aggregateProvinces(cities)`：按 `province` 求和 → 降序 → **TOP10 省 + 其余合并为「其他」**（11 个扇区，避免 20+ 省碎花）；输出 `{name, value, count}`
- ECharts option：`series.pie` `roseType:'radius'`，`radius:['14%','70%']`；仅前 6 名显示 label（item 级 `label.show`），tooltip 显示总量/城市数/占比
- 图表渲染复用 **VbEChart**（已注册 PieChart + 'vb-dark' 主题 + ResizeObserver + notMerge）

### 4. VbEChart 上移为共享组件

- `src/admin/components/VbEChart.vue` → `src/components/VbEChart.vue`
- 更新唯一引用点 `src/admin/views/OverviewView.vue` 的 import 路径（grep 确认无其他引用）

### 5. TOP8 → TOP10：`src/panels/FlowStatPanel.vue`

- `slice(0, 8)` → `slice(0, 10)`；标题「航线运量 TOP8」→「TOP10」
- `.flow-list` max-height 288px → ~330px（10 行可滚动）

### 6. 布局：`src/style.css` + `src/App.vue`

- style.css 新增 `.right-stack`（镜像 `.left-stack`：absolute top:108px right:28px width:340px flex column gap:14px z-index:10）
- App.vue：右列包 `<div class="right-stack" data-enter style="--enter-order: 2">`（data-enter 从 FlowStatPanel 移到包装层），内含 FlowStatPanel + ProvincePanel；左栈 `.left-stack` 内、TopCityPanel 之前插入 NationKpiPanel
- `useBoardData` 解构补 `prevCities`

### 7. 纯函数与测试

- 新增 `src/utils/aggregate.ts`：`aggregateProvinces(cities, metric)`、`metricTotal(cities, metric)`（面板 computed 调用）
- 新增 `src/utils/__tests__/aggregate.spec.ts`：聚合求和、排序、TOP10+其他合并边界（<10 省不出现「其他」）、全空数组

## 约束与注意

- 产物预算安全：`check-budget.mjs` 只统计 `index-*.js` 主包，echarts 独立 `echarts` chunk 不入考核；但大屏页面会新增加载 echarts chunk（~400KB raw），局域网展厅场景可接受（PieChart 本就因 admin 已注册，chunk 体积零增长）
- `.panel-pos` 的 `!important` 陷阱：新面板放在 flex 栈内（非 absolute 定位），不触发 PanelChrome scoped position 覆盖问题
- `pnpm build`（vue-tsc）会类型检查新文件，functional ref/联合类型等坑已知

## 验证

1. `pnpm test` — 新 spec + 全量回归（188 用例）
2. `pnpm build` — vue-tsc + tsc server + vite 三段类型检查
3. `pnpm lint` + `pnpm check:size`
4. `pnpm dev`（端口 3000，注意先清 3000 端口僵尸进程）+ Chrome DevTools MCP 浏览器验证：
   - 全国总览 3 卡数值正确（与 admin Overview KPI 交叉核对）且随切期出现 ▲/▼
   - TOP10 榜单渲染、hover 联动地图弧线高亮仍正常
   - 玫瑰图渲染、切指标（热度→客流）与切期联动、tooltip 占比正确
   - 1920×1080 下左右栈无溢出/无与时间轴重叠，console 无新增错误
