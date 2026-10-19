/**
 * 大屏读端点（后台数据管理模块 A2）：
 * 契约严格对齐 HttpDataSource（createDataSource.ts DEFAULT_ENDPOINTS）——
 * 响应形状经大屏 dto.ts zod 校验消费，字段名/参数名不得擅改。
 * 语义对齐 MockDataSource：显式存储下 history 不足 count 期返回可用部分（不环形回卷）。
 */
import { Router } from 'express'
import type { MetricKey } from '../../src/mock/cities'
import { readDb } from '../db'

const METRICS: readonly MetricKey[] = ['heat', 'passenger', 'economy']

/** 查询参数取字符串（重复参数取首个） */
function queryStr(v: unknown): string | null {
  if (Array.isArray(v)) v = v[0]
  return typeof v === 'string' && v.length > 0 ? v : null
}

export function createBoardRouter(): Router {
  const router = Router()

  // GET /api/periods → 字符串数组直出（升序）
  router.get('/periods', (_req, res) => {
    res.json(readDb().periods)
  })

  // GET /api/cities?period= → 指定周期城市指标 DTO（缺 period 判契约错误；未知周期返回全量城市、指标置 0 不抛断）
  router.get('/cities', (req, res) => {
    const period = queryStr(req.query.period)
    if (!period) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '缺少 period 查询参数' } })
      return
    }
    const db = readDb()
    res.json(
      db.cities.map((city) => ({
        name: city.name,
        province: city.province,
        lnglat: city.lnglat,
        indicators: city.metrics[period] ?? { heat: 0, passenger: 0, economy: 0 },
      })),
    )
  })

  // GET /api/flows?period= → 指定周期航线 OD DTO
  router.get('/flows', (req, res) => {
    const period = queryStr(req.query.period)
    if (!period) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '缺少 period 查询参数' } })
      return
    }
    const db = readDb()
    res.json(
      db.flows.map((flow) => ({
        from: flow.from,
        to: flow.to,
        volume: flow.volumes[period] ?? 0,
        category: flow.category,
      })),
    )
  })

  // GET /api/history?period&city&count&metric → 以 period 为末期的近 count 期数值（升序）
  router.get('/history', (req, res) => {
    const period = queryStr(req.query.period)
    const city = queryStr(req.query.city)
    if (!period || !city) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '缺少 period 或 city 查询参数' } })
      return
    }
    const countRaw = Number.parseInt(queryStr(req.query.count) ?? '12', 10)
    const count = Number.isFinite(countRaw) && countRaw > 0 ? countRaw : 12
    const metricRaw = queryStr(req.query.metric) ?? 'heat'
    const metric: MetricKey = (METRICS as readonly string[]).includes(metricRaw) ? (metricRaw as MetricKey) : 'heat'

    const db = readDb()
    const record = db.cities.find((c) => c.name === city)
    const endIdx = db.periods.indexOf(period)
    if (!record || endIdx < 0) {
      res.json([])
      return
    }
    const startIdx = Math.max(0, endIdx - count + 1)
    res.json(db.periods.slice(startIdx, endIdx + 1).map((p) => record.metrics[p]?.[metric] ?? 0))
  })

  return router
}
