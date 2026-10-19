/**
 * 管理端路由（A4 读端点 / A5 城市 CRUD / A6 航线 CRUD / A7 导入导出）：
 * 全量返回 db 存储结构（档案 + 各期 metrics/volumes），供管理端一次拉取后前端聚合，
 * 周期/指标切换零请求（docs/admin-module-plan.md §5.2）。
 * 错误契约：{ error: { code, message } } —— 400 VALIDATION_ERROR / 404 NOT_FOUND / 409 DUPLICATE。
 * 约定：参数校验全部发生在 mutateDb 之前（失败请求不触发落盘/updatedAt 刷新）。
 */
import { Router } from 'express'
import type { Response } from 'express'
import type { ZodType } from 'zod'
import { mutateDb, readDb, resetDb } from '../db'
import type { CityRecord, DbData, FlowRecord } from '../db'
import { cityCreateSchema, cityUpdateSchema, firstZodMessage, flowCreateSchema, flowUpdateSchema, periodCreateSchema } from '../schemas'

/** body 校验：失败向 res 发 400 并返回 null（路由内短路 return） */
function parseBody<T>(schema: ZodType<T>, body: unknown, res: Response): T | null {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: firstZodMessage(parsed.error) } })
    return null
  }
  return parsed.data
}

function sendNotFound(res: Response, what: string): void {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `${what}不存在` } })
}

export function createAdminRouter(): Router {
  const router = Router()

  // GET /api/admin/cities → 全量城市（name 唯一键，metrics 按周期键控）
  router.get('/cities', (_req, res) => {
    res.json(readDb().cities)
  })

  // POST /api/admin/cities → 建城（重名 409；指标初始化策略见 schemas.ts）
  router.post('/cities', (req, res) => {
    const body = parseBody(cityCreateSchema, req.body, res)
    if (!body) return
    if (readDb().cities.some((c) => c.name === body.name)) {
      res.status(409).json({ error: { code: 'DUPLICATE', message: `城市「${body.name}」已存在` } })
      return
    }
    const city = mutateDb((db: DbData) => {
      const lastPeriod = db.periods[db.periods.length - 1] ?? ''
      const init = body.metrics ?? { heat: 0, passenger: 0, economy: 0 }
      const metrics: CityRecord['metrics'] = {}
      for (const p of db.periods) {
        // 「全部置 0」= init 全 0；「复制指定期」= init 复制到全部期；onlyLastPeriod 仅末期取 init
        metrics[p] = body.onlyLastPeriod && p !== lastPeriod ? { heat: 0, passenger: 0, economy: 0 } : { ...init }
      }
      const created: CityRecord = {
        name: body.name,
        province: body.province,
        lnglat: [...body.lnglat] as [number, number],
        rank: body.rank ?? 0,
        metrics,
      }
      db.cities.push(created)
      return created
    })
    res.status(201).json(city)
  })

  // PUT /api/admin/cities/:name → 更新档案和/或指定周期指标（body 按需携带）
  router.put('/cities/:name', (req, res) => {
    const body = parseBody(cityUpdateSchema, req.body, res)
    if (!body) return
    const name = req.params.name
    const db = readDb()
    if (!db.cities.some((c) => c.name === name)) {
      sendNotFound(res, `城市「${name}」`)
      return
    }
    const badPeriod = body.metrics?.find((m) => !db.periods.includes(m.period))
    if (badPeriod) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `未知周期「${badPeriod.period}」` } })
      return
    }
    const city = mutateDb((db: DbData) => {
      const target = db.cities.find((c) => c.name === name)
      if (!target) return null
      if (body.province !== undefined) target.province = body.province
      if (body.lnglat !== undefined) target.lnglat = [...body.lnglat] as [number, number]
      if (body.rank !== undefined) target.rank = body.rank
      for (const m of body.metrics ?? []) {
        target.metrics[m.period] = { heat: m.heat, passenger: m.passenger, economy: m.economy }
      }
      return target
    })
    if (!city) {
      sendNotFound(res, `城市「${name}」`)
      return
    }
    res.json(city)
  })

  // DELETE /api/admin/cities/:name?confirm=0|1 → confirm=0 试探（返回级联航线数不删除），confirm=1 真删
  router.delete('/cities/:name', (req, res) => {
    const name = req.params.name
    if (req.query.confirm !== '1') {
      const db = readDb()
      if (!db.cities.some((c) => c.name === name)) {
        sendNotFound(res, `城市「${name}」`)
        return
      }
      res.json({ city: name, cascadeFlows: db.flows.filter((f) => f.from === name || f.to === name).length })
      return
    }
    const result = mutateDb((db: DbData) => {
      const idx = db.cities.findIndex((c) => c.name === name)
      if (idx < 0) return null
      db.cities.splice(idx, 1)
      const cascade = db.flows.filter((f) => f.from === name || f.to === name)
      db.flows = db.flows.filter((f) => f.from !== name && f.to !== name)
      return { city: name, cascadeFlows: cascade.length }
    })
    if (!result) {
      sendNotFound(res, `城市「${name}」`)
      return
    }
    res.json(result)
  })

  // GET /api/admin/flows → 全量航线 OD（id 唯一键，volumes 按周期键控）
  router.get('/flows', (_req, res) => {
    res.json(readDb().flows)
  })

  // POST /api/admin/flows → 新建 OD（from/to 必须是已存在城市，否则 400；起点=终点 400）
  router.post('/flows', (req, res) => {
    const body = parseBody(flowCreateSchema, req.body, res)
    if (!body) return
    const db = readDb()
    if (!db.cities.some((c) => c.name === body.from)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `起点城市「${body.from}」不存在` } })
      return
    }
    if (!db.cities.some((c) => c.name === body.to)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `终点城市「${body.to}」不存在` } })
      return
    }
    if (body.from === body.to) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '起点与终点不能为同一城市' } })
      return
    }
    const badPeriod = body.volumes && Object.keys(body.volumes).find((p) => !db.periods.includes(p))
    if (badPeriod) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `未知周期「${badPeriod}」` } })
      return
    }
    if (
      db.flows.some((f) => f.from === body.from && f.to === body.to && f.category === body.category)
    ) {
      res
        .status(409)
        .json({ error: { code: 'DUPLICATE', message: `航线「${body.from} → ${body.to}」(${body.category === 'passenger' ? '客运' : '货运'})已存在` } })
      return
    }
    const flow = mutateDb((db: DbData) => {
      const volumes: FlowRecord['volumes'] = {}
      for (const p of db.periods) volumes[p] = body.volumes?.[p] ?? 0
      const created: FlowRecord = {
        id: db.meta.nextFlowId++,
        from: body.from,
        to: body.to,
        category: body.category,
        volumes,
      }
      db.flows.push(created)
      return created
    })
    res.status(201).json(flow)
  })

  // PUT /api/admin/flows/:id → 更新拓扑/类别和/或指定周期运量
  router.put('/flows/:id', (req, res) => {
    const body = parseBody(flowUpdateSchema, req.body, res)
    if (!body) return
    const id = Number.parseInt(req.params.id, 10)
    const db = readDb()
    const flow = db.flows.find((f) => f.id === id)
    if (!flow) {
      sendNotFound(res, `航线 #${req.params.id}`)
      return
    }
    const nextFrom = body.from ?? flow.from
    const nextTo = body.to ?? flow.to
    if (!db.cities.some((c) => c.name === nextFrom)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `起点城市「${nextFrom}」不存在` } })
      return
    }
    if (!db.cities.some((c) => c.name === nextTo)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `终点城市「${nextTo}」不存在` } })
      return
    }
    if (nextFrom === nextTo) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '起点与终点不能为同一城市' } })
      return
    }
    const badPeriod = body.volumes && Object.keys(body.volumes).find((p) => !db.periods.includes(p))
    if (badPeriod) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `未知周期「${badPeriod}」` } })
      return
    }
    const updated = mutateDb((db: DbData) => {
      const target = db.flows.find((f) => f.id === id)
      if (!target) return null
      if (body.from !== undefined) target.from = body.from
      if (body.to !== undefined) target.to = body.to
      if (body.category !== undefined) target.category = body.category
      if (body.volumes) for (const [p, v] of Object.entries(body.volumes)) target.volumes[p] = v
      return target
    })
    if (!updated) {
      sendNotFound(res, `航线 #${id}`)
      return
    }
    res.json(updated)
  })

  // DELETE /api/admin/flows/:id → 删除单条（无级联）
  router.delete('/flows/:id', (req, res) => {
    const id = Number.parseInt(req.params.id, 10)
    const deleted = mutateDb((db: DbData) => {
      const idx = db.flows.findIndex((f) => f.id === id)
      if (idx < 0) return null
      const [removed] = db.flows.splice(idx, 1)
      return removed
    })
    if (!deleted) {
      sendNotFound(res, `航线 #${req.params.id}`)
      return
    }
    res.json({ id, deleted: true })
  })

  // POST /api/admin/periods → 追加周期（409 重复；初始值 = 复制最后一期到全部城市/航线）
  router.post('/periods', (req, res) => {
    const body = parseBody(periodCreateSchema, req.body, res)
    if (!body) return
    if (readDb().periods.includes(body.period)) {
      res.status(409).json({ error: { code: 'DUPLICATE', message: `周期「${body.period}」已存在` } })
      return
    }
    const created = mutateDb((db: DbData) => {
      const prevLast = db.periods[db.periods.length - 1]
      db.periods = [...db.periods, body.period].sort()
      for (const c of db.cities) {
        const prev = prevLast !== undefined ? c.metrics[prevLast] : undefined
        c.metrics[body.period] = prev ? { ...prev } : { heat: 0, passenger: 0, economy: 0 }
      }
      for (const f of db.flows) {
        f.volumes[body.period] = prevLast !== undefined ? (f.volumes[prevLast] ?? 0) : 0
      }
      return { period: body.period, periods: [...db.periods] }
    })
    res.status(201).json(created)
  })

  // DELETE /api/admin/periods/:period → 删除周期（404 未知；最后一期 400；级联清理指标/运量）
  router.delete('/periods/:period', (req, res) => {
    const period = req.params.period
    const db = readDb()
    if (!db.periods.includes(period)) {
      sendNotFound(res, `周期「${period}」`)
      return
    }
    if (db.periods[db.periods.length - 1] === period) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: '不能删除最后一个周期' } })
      return
    }
    const result = mutateDb((db: DbData) => {
      db.periods = db.periods.filter((p) => p !== period)
      for (const c of db.cities) delete c.metrics[period]
      for (const f of db.flows) delete f.volumes[period]
      return { period, periods: [...db.periods] }
    })
    res.json(result)
  })

  // POST /api/admin/reset → 危险操作：丢弃当前数据回到种子态（前端红色警示二次确认）
  router.post('/reset', (_req, res) => {
    const db = resetDb()
    res.json({
      ok: true,
      periods: db.periods.length,
      cities: db.cities.length,
      flows: db.flows.length,
      updatedAt: db.meta.updatedAt,
    })
  })

  return router
}
