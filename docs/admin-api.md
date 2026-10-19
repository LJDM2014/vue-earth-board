# 后台数据管理模块 · 接口文档

> 版本：v1.0（2026-10-19，A1–A8 全部交付）· 服务端：Express 5 + JSON 文件存储（`server/`）
> 相关计划：[admin-module-plan.md](./admin-module-plan.md)（§4 API 设计）

## 1. 概述

### 1.1 Base URL 与端口

| 环境 | 地址 | 说明 |
|---|---|---|
| 开发（大屏/管理端经代理） | `http://localhost:3000/api/*` | vite dev server 将 `/api` 代理到 3100 |
| 开发（直连 API 服务） | `http://localhost:3100/api/*` | `pnpm server:dev` 启动，tsx watch 热重载 |
| 生产 | `http://<host>:3100/api/*` | `pnpm server:start` 启动 |

- API 端口可用 `SERVER_PORT` 环境变量覆盖（同步调整 vite proxy 目标）。
- 业务数据落盘 `server/data/db.json`（重启持久化）；`BOARD_DB_FILE` 环境变量可覆盖路径（单测隔离用）。
- 跨域默认放行（cors）；请求体限制 10mb。

### 1.2 统一错误契约

非 2xx 响应体统一为：

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "周期格式需为 YYYY-MM（月份 01-12）" } }
```

| HTTP | code | 典型场景 |
|---|---|---|
| 400 | `VALIDATION_ERROR` | 参数缺失/格式非法/引用资源不存在（起点城市、周期） |
| 404 | `NOT_FOUND` | 路径中的城市名 / 航线 id / 周期不存在 |
| 409 | `DUPLICATE` | 城市重名、航线 from+to+category 重复、周期重复 |

约定：所有参数校验发生在落盘之前——失败请求不触发写库，`meta.updatedAt` 不刷新。

### 1.3 周期与指标口径

- 周期键：`YYYY-MM` 字符串（月份限 01–12），全库升序存储；
- 三指标键：`heat`（热度）/ `passenger`（客流，万人次）/ `economy`（经济总量，亿元）；
- 航线类别：`passenger`（客运）/ `cargo`（货运），运量单位万人次；
- 种子态：75 城 / 45 条 OD / 12 期（2025-01 ~ 2025-12），管理端「重置」可随时回到该状态。

---

## 2. 数据模型

```ts
/** 城市档案 + 各期指标（name 为唯一键） */
interface CityRecord {
  name: string
  province: string
  lnglat: [number, number]      // [经度, 纬度]
  rank: number                  // 全国 GDP 排位（展示用）
  metrics: Record<string, { heat: number; passenger: number; economy: number }>  // 周期 → 三指标
}

/** 航线 OD + 各期运量（id 为唯一键，服务端自增、删除不复用） */
interface FlowRecord {
  id: number
  from: string
  to: string
  category: 'passenger' | 'cargo'
  volumes: Record<string, number>  // 周期 → 运量
}

/** 完整快照（GET /api/export?scope=all 的 JSON 载荷） */
interface DbData {
  version: number
  meta: { seededAt: string; updatedAt: string; nextFlowId: number }
  periods: string[]
  cities: CityRecord[]
  flows: FlowRecord[]
}
```

---

## 3. 大屏读端点（大屏契约，勿擅改）

> 响应形状与大屏 `dto.ts` zod 校验一一对应；语义对齐 MockDataSource。

### 3.1 GET /api/health

健康检查（管理端顶栏徽标 + 大屏降级诊断共用），计数口径：

```json
{ "ok": true, "periods": 12, "cities": 75, "flows": 45, "updatedAt": "2026-10-19T05:22:38.693Z" }
```

### 3.2 GET /api/periods

全部周期，升序字符串数组直出：

```json
["2025-01", "2025-02", "...", "2025-12"]
```

### 3.3 GET /api/cities?period=YYYY-MM

指定周期的城市指标 DTO（供地图标注/柱体/TOP 榜）：

```json
[
  {
    "name": "上海",
    "province": "上海市",
    "lnglat": [121.4737, 31.2304],
    "indicators": { "heat": 6560, "passenger": 812, "economy": 5430 }
  }
]
```

| 异常 | 行为 |
|---|---|
| 缺 `period` | 400 `VALIDATION_ERROR`「缺少 period 查询参数」 |
| 周期不存在 | 200 兜底：`indicators` 全 0（不断屏） |

### 3.4 GET /api/flows?period=YYYY-MM

指定周期的航线 OD DTO（供飞线/TOP8）：

```json
[{ "from": "北京", "to": "上海", "volume": 912, "category": "passenger" }]
```

缺 `period` → 400；未知周期 → 各条 `volume` 为 0。

### 3.5 GET /api/history?period=&city=&count=&metric=

以 `period` 为末期的近 `count` 期数值（**升序**，供 sparkline）：

| 参数 | 必填 | 缺省 | 说明 |
|---|---|---|---|
| `period` | ✅ | — | 末期 |
| `city` | ✅ | — | 城市名 |
| `count` | ❌ | 12 | 期数，非法值回落 12 |
| `metric` | ❌ | heat | heat / passenger / economy，非法值回落 heat |

- 期数不足 `count` 时返回可用部分（**不环形回卷**）；
- 城市或周期未知 → `[]`；缺必填参数 → 400。

---

## 4. 管理端 CRUD（/api/admin/*）

### 4.1 城市指标

#### GET /api/admin/cities

全量城市（管理端一次拉取、前端切期零请求）：`CityRecord[]`。

#### POST /api/admin/cities

```json
{
  "name": "苏州",
  "province": "江苏",
  "lnglat": [120.5853, 31.2989],
  "rank": 6,
  "metrics": { "heat": 9000, "passenger": 1200, "economy": 8000 },
  "onlyLastPeriod": false
}
```

→ `201` 返回创建的 `CityRecord`（全部期已稠密初始化）。

| 校验 | 状态码 |
|---|---|
| name 重名 | 409 |
| name/province 空或超 24 字、经纬度越界、指标为负、rank 非负整数 | 400 |

**指标初始化策略**（`metrics` 省略时全 0）：

| onlyLastPeriod | 行为 |
|---|---|
| `false`/缺省 | 「复制指定期」：metrics 复制到**全部**周期 |
| `true` | 仅**最新一期**取 metrics，其余期置 0 |

#### PUT /api/admin/cities/:name

body 按需携带（name 不可改）：

```json
{
  "province": "江苏",
  "lnglat": [120.5853, 31.2989],
  "rank": 6,
  "metrics": [{ "period": "2025-12", "heat": 9100, "passenger": 1210, "economy": 8050 }]
}
```

→ `200` 返回更新后的 `CityRecord`；`metrics` 数组可批量写 1~64 期（单次上限 64 期）。
未知城市 → 404；`metrics[].period` 不在库中 → 400「未知周期」。

#### DELETE /api/admin/cities/:name?confirm=0|1

两段式删除（前端二次确认防误删）：

| 调用 | 行为 | 响应 |
|---|---|---|
| `confirm=0`（或缺省） | **试探**：不删除，返回将级联删除的航线数 | `{ "city": "成都", "cascadeFlows": 11 }` |
| `confirm=1` | **真删**：删除城市 + 级联删除其关联航线 | 同上 |

未知城市 → 404。

### 4.2 航线 OD

#### GET /api/admin/flows

全量航线：`FlowRecord[]`。

#### POST /api/admin/flows

```json
{
  "from": "苏州",
  "to": "无锡",
  "category": "passenger",
  "volumes": { "2025-12": 999 }
}
```

→ `201` 返回创建的 `FlowRecord`；`id` 取 `meta.nextFlowId`（自增、删除不复用）；未提供的周期置 0。

| 校验 | 状态码 |
|---|---|
| 起点/终点城市不存在 | 400 |
| 起点与终点相同 | 400 |
| from + to + category 重复 | 409 |
| `volumes` 键为未知周期 | 400 |

#### PUT /api/admin/flows/:id

body 按需携带 `{ "from?", "to?", "category?", "volumes?" }`，拓扑变更同样做存在性/同城/未知周期校验。
→ `200` 更新后的 `FlowRecord`；未知 id → 404。

#### DELETE /api/admin/flows/:id

→ `200 { "id": 46, "deleted": true }`（无级联）；未知 id → 404。

### 4.3 周期管理

#### POST /api/admin/periods

```json
{ "period": "2026-01" }
```

→ `201 { "period": "2026-01", "periods": ["2025-01", "...", "2026-01"] }`。
初始化：全部城市该期三指标**复制最后一期**，全部航线该期运量复制最后一期。
重复 → 409；格式非法（如 `2026-13`）→ 400。

#### DELETE /api/admin/periods/:period

→ `200 { "period": "2025-06", "periods": [...] }`，级联清理城市 metrics 与航线 volumes 中该期键。
删除最后一期 → 400「不能删除最后一个周期」；未知周期 → 404。

### 4.4 重置（危险操作）

#### POST /api/admin/reset

丢弃当前数据、重建种子库并落盘：

```json
{ "ok": true, "periods": 12, "cities": 75, "flows": 45, "updatedAt": "..." }
```

前端以红色警示弹窗二次确认后调用。

---

## 5. 导入导出（/api/export · /api/import）

### 5.1 GET /api/export

| 参数 | 取值 | 缺省 |
|---|---|---|
| `scope` | `all` / `cities` / `flows` | all |
| `format` | `json` / `csv` | json |
| `template` | `1`（仅 CSV 生效：仅表头 + 2 行示例，供照格式填写） | — |

非法 scope/format → 400。响应带 `Content-Disposition: attachment; filename="board-<scope>[-template].<ext>"`。

**JSON 载荷**（可直接回导还原）：

| scope | 载荷 |
|---|---|
| all | 完整快照 `DbData`（含 meta/periods，`periods` 会在导入时并入 union） |
| cities | `{ "version": 1, "cities": CityRecord[] }` |
| flows | `{ "version": 1, "flows": FlowRecord[] }` |

**CSV 格式**（UTF-8 **BOM** + CRLF，Excel 中文兼容；RFC 4180 转义）：

```csv
name,province,lng,lat,period,heat,passenger,economy
上海市,上海市,121.4737,31.2304,2025-01,6560,812,5430

from,to,category,period,volume
北京,上海,passenger,2025-01,912
```

- cities 长表：每城 × 每期一行；flows 长表：每条 × 每期一行；`scope=all` 两块以空行分隔；
- `scope=cities|flows` 仅输出对应块。

### 5.2 POST /api/import?mode=merge|replace

| 项 | 说明 |
|---|---|
| `mode`（query） | `merge`（缺省）/ `replace`；其他值 → 400 |
| body（`application/json`） | JSON 对象：`{cities, flows}` = all / 仅 `{cities}` / 仅 `{flows}`；all 快照可携带 `periods` 并入 |
| body（`text/plain` / `text/csv`） | CSV 文本：按表头行（`name,province,…` / `from,to,…`）自动分块嗅探 scope |

**响应**（逐行校验、脏行跳过不整体失败）：

```json
{
  "total": 8,
  "accepted": 3,
  "skipped": 5,
  "errors": [
    { "row": "城市「坏城」#2", "detail": "lnglat.0: 经度需为数字" },
    { "row": "城市「周期城」#4", "detail": "周期「2026-13」格式需为 YYYY-MM（月份 01-12）" },
    { "row": "航线 好城 → 好城 #6", "detail": "起点与终点不能为同一城市" }
  ],
  "cascadeFlows": 45
}
```

**merge 语义**：城市按 `name` upsert（province 空回落「未知」，指标缺失项保留原值/补 0）；航线 `id` 优先匹配，无 id 按 `from+to+category` 匹配，未命中新建（id 自增，导入 id ≥ nextFlowId 时抬升计数器）。

**replace 语义**：先清空对应 scope 再导入；`cities` replace 会**级联删除**引用已消失城市的航线，删除数经 `cascadeFlows` 返回。

**通用口径**：

- 周期口径：`periods = union(现有, 导入出现过的合法周期)` 升序；导入后全库**稠密补齐**（缺失指标/运量置 0）；
- 航线起点/终点必须落在「现有城市 ∪ 本次导入城市」集合内（同批自洽，先城市后航线处理）；
- `category` 非法（不入 schema）回落 `passenger`；
- 数值宽容转换：数字字符串/带空白单元格自动转数（空单元格 → 缺省语义），无法转换的乱码保留原值判脏并在 errors 中给出中文原因；
- 错误（均 400）：body 为空 / CSV 无表头行 / JSON 无 cities·flows 数组 / 无有效数据行 / mode 非法。

**典型流程**：`GET /api/export?scope=all` → Excel 编辑 → `POST /api/import?mode=replace` 回导（种子态回导验证：逐位一致、零丢失）。

---

## 6. 端点速查

| # | 方法 | 路径 | 用途 | 成功响应 |
|---|---|---|---|---|
| 1 | GET | /api/health | 健康检查/计数口径 | `HealthInfo` |
| 2 | GET | /api/periods | 周期列表 | `string[]` |
| 3 | GET | /api/cities?period= | 大屏城市指标 DTO | `CityDto[]` |
| 4 | GET | /api/flows?period= | 大屏航线 OD DTO | `FlowDto[]` |
| 5 | GET | /api/history?period&city&count&metric | 城市历史序列（升序） | `number[]` |
| 6 | GET | /api/admin/cities | 全量城市 | `CityRecord[]` |
| 7 | POST | /api/admin/cities | 建城 | `201 CityRecord` |
| 8 | PUT | /api/admin/cities/:name | 更新城市 | `CityRecord` |
| 9 | DELETE | /api/admin/cities/:name?confirm= | 试探/真删（级联航线） | `{city, cascadeFlows}` |
| 10 | GET | /api/admin/flows | 全量航线 | `FlowRecord[]` |
| 11 | POST | /api/admin/flows | 建航线 | `201 FlowRecord` |
| 12 | PUT | /api/admin/flows/:id | 更新航线 | `FlowRecord` |
| 13 | DELETE | /api/admin/flows/:id | 删航线 | `{id, deleted: true}` |
| 14 | POST | /api/admin/periods | 追加周期（复制末期初始化） | `201 {period, periods}` |
| 15 | DELETE | /api/admin/periods/:period | 删周期（最后一期禁删） | `{period, periods}` |
| 16 | POST | /api/admin/reset | 重置回种子态 | `HealthInfo` |
| 17 | GET | /api/export?scope&format&template | 导出 JSON/CSV | 文件下载 |
| 18 | POST | /api/import?mode= | 导入 JSON/CSV（脏行跳过） | `ImportResult` |

> 测试覆盖：以上契约均有 vitest 用例保护（`server/__tests__/routes.spec.ts`，22 文件 188 用例）。
