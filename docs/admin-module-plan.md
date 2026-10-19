# 后台数据管理模块 · 设计与开发计划

> 版本 v1.0 · 2026-10-19 · 状态：待评审
>
> 目标：为大屏（vue-earth-board）配套一个后台数据管理模块，管理大屏展示的全部业务数据（城市指标 / 航线 OD / 周期），支持上传、下载、增删改查，并提供以图表为主的数据概览首页。

---

## 1. 背景与现状盘点

### 1.1 大屏现有能力

| 维度 | 现状 | 对本模块的意义 |
|---|---|---|
| 数据模型 | `CityMetric`（name/province/lnglat + indicators{heat, passenger, economy}）、`FlowOD`（from/to/volume/category）、`Period`（`YYYY-MM`，当前 12 期） | 后台管理的数据对象即这三类 |
| 数据源抽象 | `BoardDataSource` 接口（listPeriods / getCities / getFlows / getCityHistory），mock / http 双实现 | 后端 API 对齐 `HttpDataSource` 既有端点约定即可，**大屏零改动接入** |
| DTO 契约 | `dto.ts` 用 zod 做逐条校验，脏数据跳过不抛断 | 导入校验沿用同一思路与口径 |
| Mock 数据 | `mock/cities.ts` 75 城 31 省、`mock/flows.ts` 46 条 OD、`mock/series.ts` 时序生成核心（纯函数零依赖） | 作为**种子数据生成器**被服务端复用 |
| HTTP 端点约定 | `/api/periods`、`/api/cities?period=`、`/api/flows?period=`、`/api/history?period&city&count&metric`（见 `createDataSource.ts` DEFAULT_ENDPOINTS） | 读接口路径必须一致 |
| 降级机制 | http 预检失败自动回落 mock，大屏永不白屏 | 后端不可用时大屏安全性已天然具备 |

### 1.2 关键差异：生成式 vs 显式值

现有 mock 是**生成式**数据（`value = base × trend × season × noise` 公式按期计算）。后台管理需要用户**编辑实际数值**，因此本模块改为**显式存储**：

- 服务端建库时用 `mock/series.ts` 的生成器把 12 期 × 75 城 × 3 指标 + 46 条 OD × 12 期全部物化为种子数据；
- 此后大屏与管理端读写的都是同一份显式数值，管理端编辑 = 大屏展示（种子态下两者与现行演示数据完全一致，无缝切换）。

---

## 2. 总体架构

```
┌─────────────────────────────  浏览器  ─────────────────────────────┐
│  大屏 SPA (/)                    后台管理 SPA (/admin.html)          │
│  maplibre + deck.gl              vue-router + Element Plus + ECharts│
│  HttpDataSource/MockDataSource   AdminApiClient (fetch)             │
└──────────────┬────────────────────────────┬───────────────────────┘
               │  VITE_DATA_SOURCE=http      │ /api/admin/*  /api/export /api/import
               │  /api/* (vite proxy)        │
┌──────────────▼─────────────────────────────▼───────────────────────┐
│                Node API 服务 (Express 5, tsx 运行 TS)               │
│  routes: 大屏读端点(契约对齐) + admin CRUD + import/export          │
│  schemas: zod 请求校验        storage: 内存缓存 + 原子写盘           │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ JSON 文件（server/data/db.json）
                        ┌──────▼──────┐
                        │  db.json    │ ← 种子初始化复用 src/mock/series.ts
                        └─────────────┘
```

### 2.1 技术选型（已确认）

| 项 | 选择 | 理由 |
|---|---|---|
| 后端框架 | **Express 5 + tsx**（TS 直接运行，`pnpm server:dev` = `tsx watch server/index.ts`） | 生态成熟、与现有 TS 技术栈一致、规模小无需 NestJS |
| 存储 | **JSON 文件**（`server/data/db.json`，内存缓存 + 写时落盘，temp+rename 原子写） | 数据量 < 1MB、低频写入，零运维；gitignore |
| 校验 | **zod**（已有依赖） | 与 DTO 层同一套心智 |
| admin 图表 | **ECharts 按需引入**（echarts/core + Line/Bar/Pie + Grid/Tooltip/Legend/DataZoom + CanvasRenderer） | 独立入口不占大屏 CI 体积预算 |
| admin UI | **Element Plus（暗色主题）**，全量引入 | 表格/表单/弹窗/上传开箱即用；暗色 + `--xb-*` token 微调贴合大屏科技风 |
| admin 路由 | **vue-router（hash 模式）** | 免服务端 history fallback 配置 |
| 端口 | vite dev **3000**，API 服务 **3100**，vite `server.proxy` 将 `/api` 代理到 3100 | 3001 是 vite 端口冲突回退位，避开 |

### 2.2 目录结构规划（新增部分）

```
server/
  index.ts            # Express 装配：路由挂载 / 错误中间件 / 启动建库
  db.ts               # 存储层：load/save/原子写/事务性修改（mutate 回调）
  seed.ts             # 种子生成：复用 src/mock/{cities,flows,series}.ts 物化 12 期
  schemas.ts          # zod：城市/航线/周期/导入请求体校验
  csv.ts              # CSV 序列化/解析（含表头嗅探）
  routes/
    board.ts          # 大屏读端点（/api/periods|cities|flows|history）
    admin.ts          # CRUD + periods + reset
    transfer.ts       # /api/export /api/import
  data/db.json        # 运行时数据（gitignore）
admin.html            # MPA 第二入口
src/admin/
  main.ts  router.ts  AdminApp.vue
  api/client.ts       # fetch 封装 + 错误归一
  composables/useAdminData.ts   # 全量数据加载与聚合（图表数据源）
  views/OverviewView.vue  CitiesView.vue  FlowsView.vue  TransferView.vue
  components/  # ECharts 封装、表格弹窗等
```

---

## 3. 数据模型与存储设计

`db.json` 顶层结构：

```jsonc
{
  "version": 1,
  "meta": { "seededAt": "...", "updatedAt": "..." },
  "periods": ["2025-01", "2025-02", ...],            // 升序
  "cities": [
    {
      "name": "上海", "province": "上海市",
      "lnglat": [121.473, 31.23], "rank": 1,          // rank 供排序展示，不再参与生成
      "metrics": {                                    // 城市名 × 周期 → 三指标
        "2025-01": { "heat": 962, "passenger": 5120, "economy": 3120 }
      }
    }
  ],
  "flows": [
    {
      "id": 1,                                        // 服务端自增稳定 id
      "from": "北京", "to": "上海", "category": "passenger",
      "volumes": { "2025-01": 912, "2025-02": 934 }   // OD id × 周期 → 运量
    }
  ]
}
```

约束与规则：

- 唯一键：城市 `name`；OD `id`（`from+to+category` 组合仅做导入时查重提示，不作为键）；
- 存储层 API：`readDb()` / `mutateDb(fn)`（fn 内同步修改，返回后统一落盘并更新 `meta.updatedAt`），避免竞态写坏文件；
- 种子初始化：启动时若 `db.json` 不存在 → 用 `MOCK_CITIES`/`MOCK_FLOWS` + `cityMetricValue`/`flowVolumeValue` 物化全量（数值与现行大屏演示态一致）；
- 数据量估算：75 城 × 12 期 × 3 指标 + 46 OD × 12 期 ≈ 500KB 内，JSON 文件方案成立。

---

## 4. API 设计

通用错误体：`{ "error": { "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT", "message": "...", "details?: [...] } }`；400 校验失败 / 404 不存在 / 409 唯一键冲突 / 500 内部错误。

### 4.1 大屏读端点（契约对齐 `HttpDataSource`，大屏零改动）

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/health` | `{ ok, periods, cities, flows, updatedAt }`，管理端状态栏与大屏降级诊断共用 |
| GET | `/api/periods` | 字符串数组直出（升序） |
| GET | `/api/cities?period=` | DTO 数组：`{name, province, lnglat, indicators}` |
| GET | `/api/flows?period=` | DTO 数组：`{from, to, volume, category}` |
| GET | `/api/history?period&city&count&metric` | 以 period 为末期的近 count 期数值（升序）；显式存储下不足 count 期返回可用部分 |

### 4.2 管理端 CRUD

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/admin/cities` | 全量：档案 + 各期 metrics（供列表与图表前端聚合） |
| POST | `/api/admin/cities` | 建城：档案必填 + 指标初始化策略（全部置 0 / 复制指定期）；重名 409 |
| PUT | `/api/admin/cities/:name` | 更新档案和/或指定周期的指标（body 按需携带） |
| DELETE | `/api/admin/cities/:name` | 删除城市；**级联删除引用该城市的航线**（前端弹窗明示条数） |
| GET | `/api/admin/flows` | 全量：OD + 各期 volumes |
| POST | `/api/admin/flows` | 新建 OD（from/to 必须是已存在城市，否则 400） |
| PUT | `/api/admin/flows/:id` | 更新拓扑/类别和/或指定周期运量 |
| DELETE | `/api/admin/flows/:id` | 删除单条 |
| POST | `/api/admin/periods` | 追加周期（`YYYY-MM` 校验、不可重复）；初始值 = 复制最后一期 |
| DELETE | `/api/admin/periods/:period` | 删除周期（危险操作，级联清除各城市/航线的该期数据） |
| POST | `/api/admin/reset` | 重置为种子数据（危险操作） |

### 4.3 导入导出

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/export?scope=all\|cities\|flows&format=json\|csv` | JSON = db 快照结构；CSV 长表（见 §6），`Content-Disposition` 触发浏览器下载 |
| POST | `/api/import?mode=merge\|replace` | body：JSON 或 CSV 文本；响应 `{total, accepted, skipped, errors:[{row, detail}]}` |

---

## 5. 后台前端设计

### 5.1 页面结构（hash 路由）

```
admin.html
├── #/overview   数据概览（首页）：KPI 卡 + 图表区（§5.2）
├── #/cities     城市指标管理：表格 CRUD（§5.3）
├── #/flows      航线 OD 管理：表格 CRUD（§5.3）
└── #/transfer   数据导入导出 + 周期管理 + 危险操作（§6）
```

布局：左侧固定侧边导航（图标 + 文案）+ 顶栏（服务健康状态徽标、最近更新时间、"查看大屏"外链 `/`）。视觉：Element Plus 暗色模式（`html.dark`）为基础，叠加 `--xb-*` 主题色 token（面板切角、发光描边克制使用），与大屏三主题的 deep-space 观感延续。

### 5.2 概览首页图表设计

数据来源：`GET /api/admin/cities` + `/api/admin/flows` 一次拉全量，`useAdminData` composable 前端聚合（数据量小，交互切期/切指标零请求）。

| 图表 | 类型 | 数据口径 | 交互 |
|---|---|---|---|
| KPI 指标卡 ×5 | 数字卡 | 城市数 / 航线数 / 周期数 / 指标数据点总数 / 最近更新时间 | — |
| 三指标全国趋势 | 折线 ×3 系列 | 各期 Σheat、Σpassenger、Σeconomy（双 Y 轴：热度无量纲，其余带单位） | tooltip 联动、legend 开关 |
| 城市 TOP10 | 横向条形 | 选中周期 + 选中指标（下拉切换，缺省 2025-12 经济总量） | 周期/指标联动刷新 |
| 客货运量占比 | 环形饼 | 选中周期 Σpassenger vs Σcargo | 选中周期联动 |
| 航线运量 TOP10 | 横向条形 | 选中周期单条 OD 追踪量排序（`from→to` 标签，客/货着色区分） | 周期联动 |
| 省份覆盖 | 条形 | 31 省覆盖城市数（2 期实现，P2 可换 ECharts 地图 + 省界 GeoJSON） | — |

实现：封装 `VbEChart` 薄组件（init/resize/setOption/dispose 生命周期 + 暗色注册），页面只传 option。

### 5.3 CRUD 交互设计（cities / flows 通用骨架）

- 列表：el-table 服务端全量数据 + 前端搜索（城市名/起讫点）、省份筛选、周期切换查看当期值；分页（每页 20）；
- 新增/编辑：el-dialog + el-form（zod 同规则前端预校验；经纬度支持小数输入 + 「在地图中查看」外链）；
  - 城市编辑：档案字段 + 当期三指标；提供「批量填充其他期 = 当期值」快捷操作；
  - 航线编辑：from/to 城市下拉（el-select filterable，选项来自城市表）+ category + 各期运量（当前期可编辑，其余期折叠展示）；
- 删除：el-popconfirm；删城市时后端返回将级联的航线数并二次确认；
- 保存成功后 toast + 列表局部刷新；全部操作经 `/api/admin/*`，失败按错误体展示 message。

---

## 6. 上传 / 下载设计

### 6.1 下载（导出）

- **JSON**：`db.json` 快照结构（含 version/meta），可直接回导还原；
- **CSV 长表**（Excel 友好，UTF-8 with BOM 防 Excel 中文乱码）：
  - cities：`name,province,lng,lat,period,heat,passenger,economy`（每城 × 期一行）
  - flows：`from,to,category,period,volume`（每条 × 期一行）
- **模板下载**：仅表头 + 2 行示例，供用户照格式填数。

### 6.2 上传（导入）

- 前端 el-upload 读文件为文本 → `POST /api/import?mode=merge|replace`；
- 格式嗅探：`.json` → 按 snapshot / `{cities:[...]}` / `{flows:[...]}` 容错解析；`.csv` → 表头判断归属（含 `heat` 列 → cities，含 `from,to` 列 → flows）；
- 校验：服务端 zod 逐条校验（口径与 `dto.ts` 一致：lnglat 必填缺失判脏、指标缺失补 0、category 非法回落 passenger），**脏行跳过并记录原因，不整体失败**；
- 模式：`merge`（默认，按唯一键 upsert）/ `replace`（scope 内先清空再导入）；
- 结果回显：总计 / 成功 / 跳过 + 错误明细表格（行号 + 原因），与 `data-source-error/contract` 上报口径一致。

---

## 7. 大屏接入方案

1. 开发态：`board.config.json` 设 `{ "dataSource": "http" }`（`VITE_API_BASE_URL` 留空走 vite proxy）→ 大屏 `createDataSource` 预检 `/api/periods` 通过后接入本地 API；
2. 后端不可用时自动回落 mock 并显示「演示数据」角标（现有机制，无新增工作）；
3. 数据一致性：种子态下 API 数值 = mock 生成数值，切换前后大屏表现无感；管理端改动后大屏刷新（或触发轮询/推送）即见新值；
4. 可选增强（P2）：管理端保存后 `BroadcastChannel('board-data')` 广播 → 大屏监听并调用 `refreshCurrent()` 免刷新生效。

---

## 8. 里程碑计划

> 每个里程碑独立可验收；A1→A2 为服务端主线，A3→A7 为前端主线（A3 起可与 A2 并行）。

### A1 服务端基础与种子数据
- 任务：装依赖（express、cors、tsx、supertest、@types/express）；`server/db.ts` 存储层 + 原子写；`server/seed.ts` 复用 mock 生成器物化 12 期；`/api/health`；`pnpm server:dev` 脚本；`server/data/` 加入 gitignore
- 验收：服务启动自动建库；`GET /api/health` 返回 75 城 / 46 OD / 12 期；重启服务数据持久；种子数值与 mock 口径抽样一致

### A2 大屏读端点 + 代理联调
- 任务：`routes/board.ts` 四个读端点（严格对齐 `HttpDataSource` 契约与参数名）；vite `server.proxy['/api'] → 3100`
- 验收：`board.config.json` 切 `dataSource:"http"` 后大屏全链路正常——时间轴 12 期、TOP5 榜单、tooltip sparkline、飞线/柱层渲染，角标显示「实时数据」

### A3 后台前端骨架
- 任务：`admin.html` MPA 入口（vite input 多入口 + manualChunks 增加 echarts/element 分包）；vue-router hash 路由；Element Plus 暗色 + 主题微调；整体布局与导航；api/client 封装
- 验收：`/admin.html` 打开，四页路由切换正常；暗色主题与导航交互完整；构建产物不增大屏主包体积（`check:size` 通过）

### A4 概览首页图表
- 任务：`useAdminData` 聚合 composable；KPI 卡 + 6 图表（§5.2）；`VbEChart` 封装；周期/指标联动状态
- 验收：图表数值与 `/api/health` 及列表页数据交叉一致；切周期/指标图表正确联动；窗口 resize 自适应

### A5 城市指标 CRUD
- 任务：列表（搜索/省份筛选/分页/切期）；新增/编辑弹窗（zod 预校验、指标初始化策略、批量填充）；删除级联确认
- 验收：改某城某期经济值 → 大屏该城柱体/标注/TOP5 排名随之变化；重名/非法经纬度被拦截；删城后大屏该城消失且关联航线同步消失

### A6 航线 OD CRUD
- 任务：列表（起讫搜索/类别筛选）；新增/编辑（城市下拉联动、分周期运量编辑）；删除
- 验收：新增 OD 后大屏飞线立即出现（刷新后）；from/to 选到不存在城市被后端 400 拦截

### A7 导入导出 + 周期管理 + 危险操作
- 任务：`routes/transfer.ts`（export 三 scope × 两格式、模板下载、import 嗅探/校验/merge|replace）；`TransferView`（下载区、上传区、结果回显、周期追加/删除、重置种子）
- 验收：导出 JSON 原样回导 → 数据不变（accepted=all, skipped=0）；CSV 在 Excel 编辑后导入生效；脏行跳过并回显原因；追周期后大屏时间轴出现新期；重置后回到种子态

### A8 测试、回归与收尾（已完成）

- 任务：vitest 单测（seed 确定性、db 原子写、CSV 解析、import 校验分支、board 路由契约——supertest）；`pnpm build` + `lint` + `check:size` 回归；`docs` 补运行说明（启动命令、配置切换、端口约定）
- 验收：`pnpm test` 全绿；大屏 `pnpm dev` + `pnpm server:dev` 双进程联调通过；CI 体积预算不回归
- 交付：22 文件 188 用例全绿（新增 server 侧 csv/seed/db/routes + admin 聚合纯函数 5 个 spec）；`BOARD_DB_FILE` env 测试隔离；build/lint/check:size 零回归；运行说明见 §12

---

## 9. 测试策略

| 层 | 工具 | 覆盖点 |
|---|---|---|
| 服务端存储/种子 | vitest | 种子确定性（同输入同输出）、mutateDb 落盘、原子写失败不损坏旧文件（temp 目录模拟） |
| 服务端路由 | vitest + supertest | 大屏四端点响应形状与 `dto.ts` schema 兼容；CRUD 状态码（400/404/409）；import 脏行跳过统计 |
| CSV 序列化 | vitest | 中文转义、BOM、表头嗅探、数值边界（0/负数/小数） |
| admin 前端 | vitest（纯函数/composable） | 聚合计算（趋势求和、TOP10 排序、占比）；api/client 错误归一 |
| E2E（可选 P2） | Playwright | 打开 admin → 改值 → 开大屏验证 的最小冒烟链路 |

约束延续：`vite.config.ts` test.exclude 保持排除 `e2e/**`；新增类型/泛型后必须跑 `pnpm build`（vitest 不做类型检查）。

---

## 10. 风险与对策

| 风险 | 对策 |
|---|---|
| JSON 文件并发写损坏 | mutateDb 串行化 + temp/rename 原子写；单实例部署假设写明文档 |
| 管理端与大屏数据口径漂移 | 大屏读端点响应直接复用 `dto.ts` 的 schema 做测试断言；种子复用同一生成器 |
| Element Plus 全量引入体积 | 仅进 admin 入口；vite manualChunks 独立分包；`check:size` 只考核大屏主包不受影响 |
| Windows 端口占用（3000/3100） | 延续既有教训：启动前检查端口；API 端口可用 `SERVER_PORT` env 覆盖 |
| 删除城市级联误伤 | 后端返回级联明细 + 前端二次确认；危险操作（重置/删期/replace 导入）统一红色警示样式 |
| Excel 编辑 CSV 带来的隐性脏数据（数字变文本等） | 导入校验对数值字符串做宽容转换（trim/Number()），仍失败才判脏跳过 |

---

## 11. 里程碑之外（P2 备选）

- BroadcastChannel 免刷新联动大屏；
- 概览页省份分布 ECharts 地图（复用 `public` 省界 GeoJSON）；
- 批量表格行内编辑 / Excel 直传 xlsx 解析；
- 简单访问口令（管理端入口 token 校验）；
- db.json → SQLite（better-sqlite3）升级路径（存储层已隔离，接口不变）。

---

## 12. 运行说明

### 12.1 启动命令

| 命令 | 作用 |
|---|---|
| `pnpm server:dev` | 启动本地 API 服务（Express 5 + tsx watch，默认端口 3100），首次启动自动种子建库 |
| `pnpm dev` | 启动 vite（大屏 + 管理端 MPA，端口 3000），`/api` 自动代理到 3100 |
| `pnpm server:start` | 生产态启动 API（不经 tsx watch） |
| `pnpm test` | vitest 全量单测（服务端存储/路由/CSV + admin 聚合纯函数） |
| `pnpm build` | `vue-tsc -b` + `tsc -p server/tsconfig.json` + `vite build`（三段类型检查后打包） |
| `pnpm check:size` | CI 体积预算（仅考核大屏业务主包 gzip，admin 依赖独立分包不计入） |

### 12.2 入口与端口

- 大屏：`http://localhost:3000`；管理端：`http://localhost:3000/admin.html`（hash 路由 `#/overview` `#/cities` `#/flows` `#/transfer`）；
- 端口约定：vite 3000 / API 3100；API 端口可用 `SERVER_PORT` env 覆盖（需同步调整 vite proxy 目标）；
- 启动前检查端口占用（Windows 僵尸 vite 进程曾静默回落 3001）。

### 12.3 配置切换（数据源）

优先级：`VITE_BOARD_CONFIG`（内联 JSON）> `public/board.config.json` > 缺省 mock。
本地联调标准形态：`board.config.json` 置 `{ "dataSource": "http" }`（当前已配置），
且 `.env.development` 的 `VITE_API_BASE_URL` 必须为空（走同源 `/api` 代理）——
若误填远端地址，预检失败会静默回落 mock（大屏角标「演示数据」）。

### 12.4 数据与测试隔离

- 业务数据落盘 `server/data/db.json`（已 gitignore，重启持久化）；管理端「危险操作 → 重置」可随时回到种子态（75 城/45 OD/12 期）；
- `BOARD_DB_FILE` env 可覆盖落盘路径，单测（db/routes spec）用它指向临时文件，不污染开发库；
- zod/类型新增后必须跑 `pnpm build`（vitest 不做类型检查，见 §9 约束）。

