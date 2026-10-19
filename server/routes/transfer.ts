/**
 * 导入导出路由（A7，docs/admin-module-plan.md §4.3 / §6）：
 * - GET /api/export?scope=all|cities|flows&format=json|csv&template=1
 *   JSON = 快照结构（all 含 meta/periods，可直接回导还原；template 参数对 JSON 无效）；
 *   CSV = 长表（UTF-8 BOM + CRLF，Excel 中文兼容）：cities 块 name,province,lng,lat,period,heat,passenger,economy
 *   + flows 块 from,to,category,period,volume，scope=all 两块以空行分隔；template=1 仅表头 + 2 行示例；
 * - POST /api/import?mode=merge|replace：body 嗅探（JSON 对象 / CSV 文本，express.text 接 text/plain|csv），
 *   zod 逐条校验 → 脏行跳过并记录原因（不整体失败）；
 *   merge = 城市 name / 航线 id（无 id 按 from+to+category）upsert；replace = 先清空对应 scope 再导入
 *   （cities replace 级联删除引用已消失城市的航线）；category 非法回落 passenger；
 *   周期口径：periods = union(现有, 导入出现过的合法周期) 升序，导入后全库补齐稠密（缺失指标/运量置 0）；
 * - 校验发生在 mutateDb 之前（失败请求不触发落盘/updatedAt 刷新）。
 */
import express, { Router } from 'express'
import type { z } from 'zod'
import { lenientNumber, parseCsv, stringifyCsv } from '../csv'
import { mutateDb, readDb } from '../db'
import type { DbData, FlowCategory } from '../db'
import { cityImportRowSchema, firstZodMessage, flowImportRowSchema } from '../schemas'

type CityImportRow = z.infer<typeof cityImportRowSchema>
type FlowImportRow = z.infer<typeof flowImportRowSchema>

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/

interface ImportError {
  row: string
  detail: string
}

interface ImportResult {
  total: number
  accepted: number
  skipped: number
  errors: ImportError[]
  /** replace 模式清除的关联航线数（scope=all 全量清空 / cities 级联删除） */
  cascadeFlows?: number
  /** true：脏行数超出明细回显上限，errors 仅为前 MAX_ERRORS 条 */
  errorsTruncated?: boolean
}

/** 错误明细回显上限：超大脏文件只保留前 100 条原因（skipped 统计仍为全量），前端据此提示截断 */
const MAX_ERRORS = 100

function pushError(result: ImportResult, row: string, detail: string): void {
  if (result.errors.length < MAX_ERRORS) result.errors.push({ row, detail })
}

/* ---------------- 导出 ---------------- */

const CITIES_CSV_HEADER = ['name', 'province', 'lng', 'lat', 'period', 'heat', 'passenger', 'economy']
const FLOWS_CSV_HEADER = ['from', 'to', 'category', 'period', 'volume']

/** 模板示例行（template=1 时替代真实数据，供用户照格式填数） */
const CITY_TEMPLATE_ROWS = [
  ['上海市', '上海市', '121.4737', '31.2304', '2026-01', '1200', '800', '5400'],
  ['杭州市', '浙江省', '120.1551', '30.2741', '2026-01', '600', '350', '2100'],
]
const FLOW_TEMPLATE_ROWS = [
  ['上海市', '杭州市', 'passenger', '2026-01', '320'],
  ['上海市', '杭州市', 'cargo', '2026-01', '150'],
]

/** cities 长表：每城 × 每期一行 */
function citiesCsvRows(db: DbData): string[][] {
  const rows: string[][] = [CITIES_CSV_HEADER]
  for (const c of db.cities) {
    for (const p of db.periods) {
      const m = c.metrics[p]
      rows.push([
        c.name,
        c.province,
        String(c.lnglat[0]),
        String(c.lnglat[1]),
        p,
        String(m?.heat ?? 0),
        String(m?.passenger ?? 0),
        String(m?.economy ?? 0),
      ])
    }
  }
  return rows
}

/** flows 长表：每条 × 每期一行 */
function flowsCsvRows(db: DbData): string[][] {
  const rows: string[][] = [FLOWS_CSV_HEADER]
  for (const f of db.flows) {
    for (const p of db.periods) {
      rows.push([f.from, f.to, f.category, p, String(f.volumes[p] ?? 0)])
    }
  }
  return rows
}

/* ---------------- 导入：数值宽容转换与行归一 ---------------- */

/** 严格数值（经纬度/坐标类）：空白/缺失 → undefined（required 判脏），乱码保留原值供 zod 报可读错误 */
function strictNumber(v: unknown): unknown {
  if (v === undefined) return undefined
  if (typeof v === 'string' && v.trim() === '') return undefined
  return lenientNumber(v) ?? v
}

/** 宽容指标值：缺失/空单元格 → undefined（消费侧补 0），乱码保留原值供 zod 判脏 */
function lenientMetric(v: unknown): unknown {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'string' && v.trim() === '') return undefined
  return lenientNumber(v) ?? v
}

/** JSON 城市行归一：数值字符串宽容转换（Excel/手工编辑容错） */
function normalizeCityRow(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const src = raw as Record<string, unknown>
  const row: Record<string, unknown> = { ...src }
  if (Array.isArray(src.lnglat)) row.lnglat = src.lnglat.map(strictNumber)
  if ('rank' in src) row.rank = lenientMetric(src.rank)
  if (typeof src.metrics === 'object' && src.metrics !== null) {
    const metrics: Record<string, unknown> = {}
    for (const [p, v] of Object.entries(src.metrics as Record<string, unknown>)) {
      if (typeof v === 'object' && v !== null) {
        const m = v as Record<string, unknown>
        metrics[p] = {
          heat: lenientMetric(m.heat),
          passenger: lenientMetric(m.passenger),
          economy: lenientMetric(m.economy),
        }
      } else {
        metrics[p] = v // 非对象值原样交给 zod 判脏
      }
    }
    row.metrics = metrics
  }
  return row
}

/** JSON 航线行归一（category 不转换，由路由回落 passenger） */
function normalizeFlowRow(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const src = raw as Record<string, unknown>
  const row: Record<string, unknown> = { ...src }
  if ('id' in src) row.id = lenientMetric(src.id)
  if (typeof src.volumes === 'object' && src.volumes !== null) {
    const volumes: Record<string, unknown> = {}
    for (const [p, v] of Object.entries(src.volumes as Record<string, unknown>)) volumes[p] = lenientMetric(v)
    row.volumes = volumes
  }
  return row
}

/** CSV 城市行（name,province,lng,lat,period,heat,passenger,economy）→ JSON 行同构候选 */
function csvCityRow(cells: string[]): unknown {
  const [name = '', province = '', lng = '', lat = '', period = '', heat = '', passenger = '', economy = ''] = cells
  return {
    name,
    province,
    lnglat: [strictNumber(lng), strictNumber(lat)],
    metrics: {
      [period.trim()]: {
        heat: lenientMetric(heat),
        passenger: lenientMetric(passenger),
        economy: lenientMetric(economy),
      },
    },
  }
}

/** CSV 航线行（from,to,category,period,volume）→ JSON 行同构候选（category 原样携带，由路由回落非法值） */
function csvFlowRow(cells: string[]): unknown {
  const [from = '', to = '', category = '', period = '', volume = ''] = cells
  return {
    from,
    to,
    category,
    volumes: { [period.trim()]: lenientMetric(volume) },
  }
}

interface CsvBlocks {
  cityCandidates: unknown[]
  flowCandidates: unknown[]
  cityBlockSeen: boolean
  flowBlockSeen: boolean
}

/** CSV 行矩阵分块：按表头行切换归属（含 heat → cities，from/to → flows），空行已被 parseCsv 跳过 */
function splitCsvBlocks(rows: string[][]): CsvBlocks {
  const blocks: CsvBlocks = { cityCandidates: [], flowCandidates: [], cityBlockSeen: false, flowBlockSeen: false }
  let target: 'cities' | 'flows' | null = null
  for (const cells of rows) {
    if (cells[0] === 'name' && cells[1] === 'province') {
      target = 'cities'
      blocks.cityBlockSeen = true
      continue
    }
    if (cells[0] === 'from' && cells[1] === 'to') {
      target = 'flows'
      blocks.flowBlockSeen = true
      continue
    }
    if (target === 'cities') blocks.cityCandidates.push(csvCityRow(cells))
    else if (target === 'flows') blocks.flowCandidates.push(csvFlowRow(cells))
    // target 为 null（表头前的散行）：由调用方以 strayBeforeHeader 判定拒绝
  }
  return blocks
}

/** 错误明细行标签：尽量带上可读名（城市名 / OD 对） */
function rowLabel(kind: '城市' | '航线', candidate: unknown, idx: number): string {
  const src = typeof candidate === 'object' && candidate !== null ? (candidate as Record<string, unknown>) : null
  if (kind === '城市' && typeof src?.name === 'string' && src.name.trim() !== '') {
    return `城市「${src.name.trim()}」#${idx + 1}`
  }
  if (
    kind === '航线' &&
    typeof src?.from === 'string' &&
    typeof src?.to === 'string' &&
    src.from.trim() !== '' &&
    src.to.trim() !== ''
  ) {
    return `航线 ${src.from.trim()} → ${src.to.trim()} #${idx + 1}`
  }
  return `${kind} #${idx + 1}`
}

/** 候选行中格式非法的周期键（zod record 对键失败的文案不友好，这里前置给出中文原因） */
function invalidPeriodKeys(candidate: unknown): string[] {
  if (typeof candidate !== 'object' || candidate === null) return []
  const src = candidate as Record<string, unknown>
  const keys: string[] = []
  for (const bag of [src.metrics, src.volumes]) {
    if (typeof bag === 'object' && bag !== null) keys.push(...Object.keys(bag as Record<string, unknown>))
  }
  return keys.filter((k) => !PERIOD_RE.test(k))
}

export function createTransferRouter(): Router {
  const router = Router()

  // GET /api/export → JSON 快照 / CSV 长表下载
  router.get('/export', (req, res) => {
    const scope = req.query.scope
    if (scope !== undefined && scope !== 'all' && scope !== 'cities' && scope !== 'flows') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'scope 仅支持 all | cities | flows' } })
      return
    }
    const format = req.query.format
    if (format !== undefined && format !== 'json' && format !== 'csv') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'format 仅支持 json | csv' } })
      return
    }
    const effectiveScope = scope === 'cities' || scope === 'flows' ? scope : 'all'
    const effectiveFormat = format === 'csv' ? 'csv' : 'json'
    const template = effectiveFormat === 'csv' && req.query.template === '1'
    const suffix = template ? '-template' : ''
    const db = readDb()

    if (effectiveFormat === 'json') {
      const payload =
        effectiveScope === 'all'
          ? db
          : effectiveScope === 'cities'
            ? { version: db.version, cities: db.cities }
            : { version: db.version, flows: db.flows }
      res.set('Content-Disposition', `attachment; filename="board-${effectiveScope}.json"`)
      res.json(payload)
      return
    }

    const cityBlock = template ? [CITIES_CSV_HEADER, ...CITY_TEMPLATE_ROWS] : citiesCsvRows(db)
    const flowBlock = template ? [FLOWS_CSV_HEADER, ...FLOW_TEMPLATE_ROWS] : flowsCsvRows(db)
    const rows =
      effectiveScope === 'cities'
        ? cityBlock
        : effectiveScope === 'flows'
          ? flowBlock
          : [...cityBlock, [], ...flowBlock]
    res.set('Content-Type', 'text/csv; charset=utf-8')
    res.set('Content-Disposition', `attachment; filename="board-${effectiveScope}${suffix}.csv"`)
    // UTF-8 BOM：Excel 识别中文必需
    res.send(`\uFEFF${stringifyCsv(rows)}`)
  })

  // POST /api/import?mode=merge|replace → JSON / CSV 嗅探 + 逐条校验 + upsert/清空导入
  router.post('/import', express.text({ type: ['text/plain', 'text/csv'], limit: '10mb' }), (req, res) => {
    const modeQuery = req.query.mode
    if (modeQuery !== undefined && modeQuery !== 'merge' && modeQuery !== 'replace') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'mode 仅支持 merge | replace' } })
      return
    }
    const mode = modeQuery === 'replace' ? 'replace' : 'merge'
    const body: unknown = req.body

    let cityCandidates: unknown[] = []
    let flowCandidates: unknown[] = []
    let snapshotPeriods: unknown
    let scope: 'all' | 'cities' | 'flows'

    if (typeof body === 'string') {
      // CSV 文本（express.text 捕获 text/plain|csv；JSON 编码字符串也走此分支）
      if (body.trim() === '') {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '导入内容为空' } })
        return
      }
      const blocks = splitCsvBlocks(parseCsv(body))
      if (!blocks.cityBlockSeen && !blocks.flowBlockSeen) {
        res
          .status(400)
          .json({ error: { code: 'VALIDATION_ERROR', message: 'CSV 需以表头行开始（name,province,… 或 from,to,…）' } })
        return
      }
      cityCandidates = blocks.cityCandidates
      flowCandidates = blocks.flowCandidates
      scope = blocks.cityBlockSeen && blocks.flowBlockSeen ? 'all' : blocks.cityBlockSeen ? 'cities' : 'flows'
    } else if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
      // JSON 嗅探：snapshot（cities+flows）/ 仅 cities / 仅 flows
      const src = body as Record<string, unknown>
      const cities = Array.isArray(src.cities) ? src.cities : null
      const flows = Array.isArray(src.flows) ? src.flows : null
      if (!cities && !flows) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '无法识别导入内容：JSON 需含 cities / flows 数组' } })
        return
      }
      snapshotPeriods = src.periods
      cityCandidates = (cities ?? []).map(normalizeCityRow)
      flowCandidates = (flows ?? []).map(normalizeFlowRow)
      scope = cities && flows ? 'all' : cities ? 'cities' : 'flows'
    } else {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '无法识别导入内容：需为 JSON 对象或 CSV 文本' } })
      return
    }

    const result: ImportResult = {
      total: cityCandidates.length + flowCandidates.length,
      accepted: 0,
      skipped: 0,
      errors: [],
    }
    if (result.total === 0) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '导入内容为空（无数据行）' } })
      return
    }

    // 逐行 zod 校验（脏行跳过并记录原因，不整体失败）
    const cities: { row: CityImportRow }[] = []
    cityCandidates.forEach((candidate, i) => {
      const label = rowLabel('城市', candidate, i)
      const badPeriods = invalidPeriodKeys(candidate)
      if (badPeriods.length > 0) {
        result.skipped++
        pushError(result, label, `周期「${badPeriods[0]}」格式需为 YYYY-MM（月份 01-12）`)
        return
      }
      const parsed = cityImportRowSchema.safeParse(candidate)
      if (!parsed.success) {
        result.skipped++
        pushError(result, label, firstZodMessage(parsed.error))
        return
      }
      cities.push({ row: parsed.data })
    })

    const seenPeriods = new Set<string>()
    for (const { row } of cities) for (const p of Object.keys(row.metrics ?? {})) seenPeriods.add(p)

    // 航线起点/终点必须落在「导入后仍存在的城市集合」内（先城市后航线的处理顺序保证同批自洽）。
    // replace 且 scope 含 cities 时现有城市即将被清空：基线只认导入城市，避免建出引用已消失城市的悬空航线。
    const db0 = readDb()
    const citiesCleared = mode === 'replace' && (scope === 'all' || scope === 'cities')
    const cityNames = new Set(citiesCleared ? [] : db0.cities.map((c) => c.name))
    for (const { row } of cities) cityNames.add(row.name)

    const flows: { row: FlowImportRow; category: FlowCategory }[] = []
    /** 同批已出现的显式 id → 起讫签名（同 id 不同 OD 的行只接受第一条，其余判脏） */
    const batchFlowOD = new Map<number, string>()
    flowCandidates.forEach((candidate, i) => {
      const label = rowLabel('航线', candidate, i)
      const badPeriods = invalidPeriodKeys(candidate)
      if (badPeriods.length > 0) {
        result.skipped++
        pushError(result, label, `周期「${badPeriods[0]}」格式需为 YYYY-MM（月份 01-12）`)
        return
      }
      const parsed = flowImportRowSchema.safeParse(candidate)
      if (!parsed.success) {
        result.skipped++
        pushError(result, label, firstZodMessage(parsed.error))
        return
      }
      const row = parsed.data
      const category: FlowCategory = (candidate as { category?: unknown }).category === 'cargo' ? 'cargo' : 'passenger'
      if (row.id !== undefined) {
        const od = `${row.from}\u0000${row.to}`
        const prev = batchFlowOD.get(row.id)
        if (prev !== undefined && prev !== od) {
          result.skipped++
          pushError(result, label, `与同批另一行的航线 id #${row.id} 相同但起讫不一致`)
          return
        }
        batchFlowOD.set(row.id, od)
      }
      if (row.from === row.to) {
        result.skipped++
        pushError(result, rowLabel('航线', candidate, i), '起点与终点不能为同一城市')
        return
      }
      if (!cityNames.has(row.from)) {
        result.skipped++
        pushError(result, rowLabel('航线', candidate, i), `起点城市「${row.from}」不存在`)
        return
      }
      if (!cityNames.has(row.to)) {
        result.skipped++
        pushError(result, rowLabel('航线', candidate, i), `终点城市「${row.to}」不存在`)
        return
      }
      for (const p of Object.keys(row.volumes ?? {})) seenPeriods.add(p)
      flows.push({ row, category })
    })

    result.accepted = result.total - result.skipped
    if (result.skipped > result.errors.length) result.errorsTruncated = true

    // JSON 快照可选携带 periods：合法项并入 union
    if (Array.isArray(snapshotPeriods)) {
      for (const p of snapshotPeriods) if (typeof p === 'string' && PERIOD_RE.test(p)) seenPeriods.add(p)
    }

    mutateDb((db: DbData) => {
      // replace：先清空对应 scope（cities 清空需级联删除引用已消失城市的航线）
      if (mode === 'replace') {
        const flowsBefore = db.flows.length
        const importedNames = new Set(cities.map(({ row }) => row.name))
        if (scope === 'all' || scope === 'cities') {
          db.cities = []
          if (scope === 'cities') {
            db.flows = db.flows.filter((f) => importedNames.has(f.from) && importedNames.has(f.to))
          }
        }
        if (scope === 'all' || scope === 'flows') db.flows = []
        result.cascadeFlows = flowsBefore - db.flows.length
      }

      // 城市 upsert（merge 按 name；指标缺失补 0 / 保留原值）
      for (const { row } of cities) {
        let city = db.cities.find((c) => c.name === row.name)
        if (!city) {
          city = {
            name: row.name,
            province: row.province !== undefined && row.province !== '' ? row.province : '未知',
            lnglat: [...row.lnglat] as [number, number],
            rank: row.rank ?? 0,
            metrics: {},
          }
          db.cities.push(city)
        } else {
          if (row.province !== undefined && row.province !== '') city.province = row.province
          if (row.rank !== undefined) city.rank = row.rank
        }
        for (const [p, m] of Object.entries(row.metrics ?? {})) {
          const prev = city.metrics[p] ?? { heat: 0, passenger: 0, economy: 0 }
          city.metrics[p] = {
            heat: m.heat ?? prev.heat,
            passenger: m.passenger ?? prev.passenger,
            economy: m.economy ?? prev.economy,
          }
        }
      }

      // 航线 upsert（id 优先，缺省按 from+to+category；新纪录 nextFlowId 自增不复用）
      for (const { row, category } of flows) {
        let flow = row.id !== undefined ? db.flows.find((f) => f.id === row.id) : undefined
        if (!flow) flow = db.flows.find((f) => f.from === row.from && f.to === row.to && f.category === category)
        if (!flow) {
          flow = {
            id: row.id ?? db.meta.nextFlowId++,
            from: row.from,
            to: row.to,
            category,
            volumes: {},
          }
          if (row.id !== undefined && row.id >= db.meta.nextFlowId) db.meta.nextFlowId = row.id + 1
          db.flows.push(flow)
        }
        for (const [p, v] of Object.entries(row.volumes ?? {})) {
          if (v !== undefined) flow.volumes[p] = v
        }
      }

      // 周期 union（升序）+ 全库补齐稠密（新增周期缺失值置 0）
      db.periods = [...new Set([...db.periods, ...seenPeriods])].sort()
      for (const c of db.cities) {
        for (const p of db.periods) if (!c.metrics[p]) c.metrics[p] = { heat: 0, passenger: 0, economy: 0 }
      }
      for (const f of db.flows) {
        for (const p of db.periods) if (f.volumes[p] === undefined) f.volumes[p] = 0
      }
      return result
    })

    res.json(result)
  })

  return router
}
