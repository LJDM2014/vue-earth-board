/**
 * 路由契约单测（A8，docs/admin-module-plan.md §9：supertest 验证响应形状与 CRUD 状态码）：
 * - BOARD_DB_FILE 指向临时文件，内联 express app 与 server/index.ts 同构挂载；
 * - describe 间 beforeEach resetDb() 归零，测试互不污染。
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { parseCsv } from '../csv'

const tmpDir = mkdtempSync(join(tmpdir(), 'vb-routes-test-'))
process.env.BOARD_DB_FILE = join(tmpDir, 'db.json')

const { readDb, resetDb } = await import('../db')
const { createBoardRouter } = await import('../routes/board')
const { createAdminRouter } = await import('../routes/admin')
const { createTransferRouter } = await import('../routes/transfer')

/** 与 server/index.ts 同构：json 中间件 + board/transfer 挂 /api + admin 挂 /api/admin + 内联 health */
const app = express()
app.use(express.json({ limit: '10mb' }))
app.use('/api', createBoardRouter())
app.use('/api', createTransferRouter())
app.use('/api/admin', createAdminRouter())
app.get('/api/health', (_req, res) => {
  const db = readDb()
  res.json({ ok: true, periods: db.periods.length, cities: db.cities.length, flows: db.flows.length, updatedAt: db.meta.updatedAt })
})

const SEED_PERIODS = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12']

interface CityDto {
  name: string
  province: string
  lnglat: [number, number]
  indicators: { heat: number; passenger: number; economy: number }
}

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
  resetDb()
})

describe('board 读端点（大屏契约 A2）', () => {
  it('GET /api/periods → 升序周期数组直出', async () => {
    const res = await request(app).get('/api/periods')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(SEED_PERIODS)
  })

  it('GET /api/cities?period → DTO 形状（indicators 三指标取自显式存储）', async () => {
    const res = await request(app).get('/api/cities?period=2025-06')
    expect(res.status).toBe(200)
    const body = res.body as CityDto[]
    expect(Object.keys(body[0]).sort()).toEqual(['indicators', 'lnglat', 'name', 'province'])
    const sh = body.find((c) => c.name === '上海')
    expect(sh?.lnglat).toHaveLength(2)
    expect(sh?.indicators.heat).toBeGreaterThan(0)
    expect(sh?.indicators.passenger).toBeGreaterThan(0)
    expect(sh?.indicators.economy).toBeGreaterThan(0)
  })

  it('GET /api/cities：缺 period → 400；未知周期 → indicators 全 0 兜底', async () => {
    const miss = await request(app).get('/api/cities')
    expect(miss.status).toBe(400)
    expect(miss.body.error.code).toBe('VALIDATION_ERROR')
    const unknown = await request(app).get('/api/cities?period=2099-01')
    expect(unknown.status).toBe(200)
    expect((unknown.body as CityDto[])[0].indicators).toEqual({ heat: 0, passenger: 0, economy: 0 })
  })

  it('GET /api/flows?period → OD DTO 形状（from/to/volume/category）；缺 period → 400', async () => {
    const res = await request(app).get('/api/flows?period=2025-06')
    expect(res.status).toBe(200)
    const body = res.body as { from: string; to: string; volume: number; category: string }[]
    expect(Object.keys(body[0]).sort()).toEqual(['category', 'from', 'to', 'volume'])
    expect(body.some((f) => f.volume > 0)).toBe(true)
    expect(body.every((f) => ['passenger', 'cargo'].includes(f.category))).toBe(true)
    const miss = await request(app).get('/api/flows')
    expect(miss.status).toBe(400)
  })

  it('GET /api/history：近 count 期升序数值，不足 count 返回可用部分', async () => {
    const full = await request(app).get('/api/history?period=2025-06&city=上海&count=99&metric=heat')
    expect(full.status).toBe(200)
    expect(full.body).toHaveLength(6) // 2025-01 ~ 2025-06
    const clipped = await request(app).get('/api/history?period=2025-06&city=上海&count=3&metric=heat')
    expect(clipped.body).toEqual(full.body.slice(-3))
    const all = await request(app).get('/api/history?period=2025-12&city=上海&count=12&metric=heat')
    expect(all.body).toHaveLength(12)
    for (const v of all.body as number[]) expect(v).toBeGreaterThan(0)
  })

  it('GET /api/history：未知城市/未知周期 → 空数组；非法 metric 回落 heat；缺参 → 400', async () => {
    expect((await request(app).get('/api/history?period=2025-06&city=不存在')).body).toEqual([])
    expect((await request(app).get('/api/history?period=2099-01&city=上海')).body).toEqual([])
    const fallback = await request(app).get('/api/history?period=2025-06&city=上海&metric=bogus')
    const heat = await request(app).get('/api/history?period=2025-06&city=上海&metric=heat')
    expect(fallback.body).toEqual(heat.body)
    const miss = await request(app).get('/api/history?period=2025-06')
    expect(miss.status).toBe(400)
  })
})

describe('admin 城市 CRUD（A5）', () => {
  it('POST：重名 409；经纬度非法 400', async () => {
    const dup = await request(app).post('/api/admin/cities').send({ name: '上海', province: '上海市', lnglat: [121, 31] })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('DUPLICATE')
    const bad = await request(app).post('/api/admin/cities').send({ name: '新市', province: '浙江省', lnglat: [121, 95] })
    expect(bad.status).toBe(400)
    expect(bad.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('POST 建城：「复制指定期」策略（init 复制到全部期）', async () => {
    const res = await request(app).post('/api/admin/cities').send({
      name: '测试市', province: '浙江省', lnglat: [120, 30], metrics: { heat: 5, passenger: 6, economy: 7 },
    })
    expect(res.status).toBe(201)
    for (const p of SEED_PERIODS) expect(res.body.metrics[p]).toEqual({ heat: 5, passenger: 6, economy: 7 })
  })

  it('POST 建城：onlyLastPeriod 仅末期取 init、其余期置 0', async () => {
    const res = await request(app).post('/api/admin/cities').send({
      name: '测试市', province: '浙江省', lnglat: [120, 30], rank: 3, metrics: { heat: 5, passenger: 6, economy: 7 }, onlyLastPeriod: true,
    })
    expect(res.status).toBe(201)
    expect(res.body.rank).toBe(3)
    expect(res.body.metrics['2025-12']).toEqual({ heat: 5, passenger: 6, economy: 7 })
    expect(res.body.metrics['2025-01']).toEqual({ heat: 0, passenger: 0, economy: 0 })
  })

  it('PUT：更新档案与指定周期指标；未知城市 404、未知周期 400', async () => {
    const ok = await request(app).put('/api/admin/cities/上海').send({
      province: '沪', metrics: [{ period: '2025-01', heat: 111, passenger: 222, economy: 333 }],
    })
    expect(ok.status).toBe(200)
    expect(ok.body.province).toBe('沪')
    expect(ok.body.metrics['2025-01']).toEqual({ heat: 111, passenger: 222, economy: 333 })
    expect((await request(app).put('/api/admin/cities/不存在').send({ province: 'x' })).status).toBe(404)
    expect(
      (await request(app).put('/api/admin/cities/上海').send({ metrics: [{ period: '2099-01', heat: 1, passenger: 1, economy: 1 }] })).status,
    ).toBe(400)
  })

  it('DELETE：confirm=0 试探返回级联数不删除；confirm=1 真删并级联航线；未知 404', async () => {
    const city = readDb().cities[0].name
    const cascade = readDb().flows.filter((f) => f.from === city || f.to === city).length
    const probe = await request(app).delete(`/api/admin/cities/${encodeURIComponent(city)}`)
    expect(probe.status).toBe(200)
    expect(probe.body).toEqual({ city, cascadeFlows: cascade })
    expect(readDb().cities).toHaveLength(75)
    const del = await request(app).delete(`/api/admin/cities/${encodeURIComponent(city)}?confirm=1`)
    expect(del.status).toBe(200)
    expect(del.body.cascadeFlows).toBe(cascade)
    const db = readDb()
    expect(db.cities).toHaveLength(74)
    expect(db.flows).toHaveLength(45 - cascade)
    expect(db.flows.every((f) => f.from !== city && f.to !== city)).toBe(true)
    expect((await request(app).delete('/api/admin/cities/不存在?confirm=1')).status).toBe(404)
  })
})

describe('admin 航线 CRUD（A6）', () => {
  it('POST：起讫城市不存在 400、同城 400、重复 409、未知周期 400', async () => {
    const seedFlow = readDb().flows[0]
    expect((await request(app).post('/api/admin/flows').send({ from: '北京', to: '不存在市', category: 'cargo' })).status).toBe(400)
    expect((await request(app).post('/api/admin/flows').send({ from: '不存在市', to: '上海', category: 'cargo' })).status).toBe(400)
    expect((await request(app).post('/api/admin/flows').send({ from: '北京', to: '北京', category: 'cargo' })).status).toBe(400)
    expect(
      (await request(app).post('/api/admin/flows').send({ from: seedFlow.from, to: seedFlow.to, category: seedFlow.category })).status,
    ).toBe(409)
    expect(
      (await request(app).post('/api/admin/flows').send({ from: '北京', to: '上海', category: 'cargo', volumes: { '2099-01': 5 } })).status,
    ).toBe(400)
  })

  it('POST 建航线：id 自增取 nextFlowId，未提供的周期置 0', async () => {
    const seedFlow = readDb().flows[0]
    const flip = seedFlow.category === 'passenger' ? 'cargo' : 'passenger' // 换类别避免 409
    const nextId = readDb().meta.nextFlowId
    const res = await request(app).post('/api/admin/flows').send({
      from: seedFlow.from, to: seedFlow.to, category: flip, volumes: { '2025-01': 100 },
    })
    expect(res.status).toBe(201)
    expect(res.body.id).toBe(nextId)
    expect(res.body.volumes['2025-01']).toBe(100)
    expect(res.body.volumes['2025-02']).toBe(0)
    expect(readDb().meta.nextFlowId).toBe(nextId + 1)
  })

  it('PUT：未知 id 404、未知周期 400、更新成功', async () => {
    const id = readDb().flows[0].id
    expect((await request(app).put('/api/admin/flows/99999').send({ to: '上海' })).status).toBe(404)
    expect((await request(app).put(`/api/admin/flows/${id}`).send({ volumes: { '2099-01': 5 } })).status).toBe(400)
    const ok = await request(app).put(`/api/admin/flows/${id}`).send({ volumes: { '2025-01': 777 } })
    expect(ok.status).toBe(200)
    expect(ok.body.volumes['2025-01']).toBe(777)
  })

  it('DELETE：未知 404；成功返回 { id, deleted: true }', async () => {
    const id = readDb().flows[0].id
    expect((await request(app).delete('/api/admin/flows/99999')).status).toBe(404)
    const res = await request(app).delete(`/api/admin/flows/${id}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ id, deleted: true })
    expect(readDb().flows).toHaveLength(44)
  })
})

describe('admin 周期管理（A7）', () => {
  it('POST 追加：201 + 复制最后一期初始化；重复 409；格式非法 400（2026-13）', async () => {
    const res = await request(app).post('/api/admin/periods').send({ period: '2026-01' })
    expect(res.status).toBe(201)
    expect(res.body.periods).toHaveLength(13)
    const db = readDb()
    const sh = db.cities.find((c) => c.name === '上海')
    expect(sh?.metrics['2026-01']).toEqual(sh?.metrics['2025-12'])
    const f = db.flows[0]
    expect(f.volumes['2026-01']).toBe(f.volumes['2025-12'])
    expect((await request(app).post('/api/admin/periods').send({ period: '2026-01' })).status).toBe(409)
    expect((await request(app).post('/api/admin/periods').send({ period: '2026-13' })).status).toBe(400)
  })

  it('DELETE：最后一期 400；未知 404；删中期级联清理指标/运量', async () => {
    expect((await request(app).delete('/api/admin/periods/2025-12')).status).toBe(400)
    expect((await request(app).delete('/api/admin/periods/2099-01')).status).toBe(404)
    const res = await request(app).delete('/api/admin/periods/2025-06')
    expect(res.status).toBe(200)
    expect(res.body.periods).toHaveLength(11)
    const db = readDb()
    expect(db.periods).toHaveLength(11)
    expect(db.cities.every((c) => !('2025-06' in c.metrics))).toBe(true)
    expect(db.flows.every((f) => !('2025-06' in f.volumes))).toBe(true)
  })
})

describe('transfer 导出（A7）', () => {
  it('JSON 快照：all 全量 / cities、flows 分 scope 形状', async () => {
    const all = await request(app).get('/api/export?scope=all&format=json')
    expect(all.status).toBe(200)
    expect(Object.keys(all.body).sort()).toEqual(['cities', 'flows', 'meta', 'periods', 'version'])
    expect(all.headers['content-disposition']).toContain('board-all.json')
    const cities = await request(app).get('/api/export?scope=cities&format=json')
    expect(Object.keys(cities.body).sort()).toEqual(['cities', 'version'])
    const flows = await request(app).get('/api/export?scope=flows&format=json')
    expect(Object.keys(flows.body).sort()).toEqual(['flows', 'version'])
  })

  it('CSV：UTF-8 BOM + CRLF + 双块表头；行数 = 城市块 + 航线块', async () => {
    const all = await request(app).get('/api/export?scope=all&format=csv')
    expect(all.status).toBe(200)
    expect(all.headers['content-type']).toContain('text/csv')
    expect(all.text.startsWith('\uFEFF')).toBe(true)
    expect(all.text).toContain('name,province,lng,lat,period,heat,passenger,economy')
    expect(all.text).toContain('from,to,category,period,volume')
    expect(all.text.includes('\r\n')).toBe(true)
    expect(parseCsv(all.text)).toHaveLength(1 + 75 * 12 + 1 + 45 * 12)
  })

  it('CSV cities scope：仅城市块；template=1 仅表头 + 2 行示例', async () => {
    const only = await request(app).get('/api/export?scope=cities&format=csv')
    expect(parseCsv(only.text)).toHaveLength(1 + 75 * 12)
    expect(only.text).not.toContain('from,to,category')
    const tpl = await request(app).get('/api/export?scope=cities&format=csv&template=1')
    const rows = parseCsv(tpl.text)
    expect(rows).toHaveLength(3)
    expect(rows[1][0]).toBe('上海市')
  })

  it('scope / format 非法 → 400', async () => {
    expect((await request(app).get('/api/export?scope=bogus')).status).toBe(400)
    expect((await request(app).get('/api/export?format=xml')).status).toBe(400)
  })
})

describe('transfer 导入（A7）', () => {
  it('CSV 脏行逐条跳过：统计 + 中文错误原因（不整体失败）', async () => {
    const csv = [
      'name,province,lng,lat,period,heat,passenger,economy',
      '坏城,浙江省,abc,31,2025-01,1,1,1', // 经度乱码
      '负城,浙江省,120,31,2025-01,-5,1,1', // 指标为负
      '周期城,浙江省,120,31,2026-13,1,1,1', // 周期月份非法
      '好城,浙江省,120.15,30.27,2025-01,600,350,2100',
      'from,to,category,period,volume',
      '好城,上海,passenger,2025-01,100', // 起讫均为「现有 ∪ 导入」
      '好城,不存在城,cargo,2025-01,50', // 终点不存在
      '好城,好城,cargo,2025-01,50', // 同城
    ].join('\r\n')
    const res = await request(app).post('/api/import').set('Content-Type', 'text/plain').send(csv)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ total: 7, accepted: 2, skipped: 5 })
    const details = (res.body.errors as { detail: string }[]).map((e) => e.detail).join('\n')
    expect(details).toContain('经度')
    expect(details).toContain('指标不能为负数')
    expect(details).toContain('2026-13')
    expect(details).toContain('不存在')
    expect(details).toContain('同一城市')
    const db = readDb()
    expect(db.cities.some((c) => c.name === '好城')).toBe(true)
    expect(db.flows.some((f) => f.from === '好城' && f.to === '上海')).toBe(true)
  })

  it('JSON cities-only merge：新城市稠密补 0 + 新周期并入 union', async () => {
    const res = await request(app).post('/api/import').send({
      cities: [{ name: '导入市', province: '导入省', lnglat: [100, 30], metrics: { '2026-02': { heat: 5 } } }],
    })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBe(1)
    const db = readDb()
    expect(db.periods).toHaveLength(13)
    expect(db.periods).toContain('2026-02')
    const c = db.cities.find((x) => x.name === '导入市')
    expect(c?.metrics['2026-02']).toEqual({ heat: 5, passenger: 0, economy: 0 })
    expect(c?.metrics['2025-01']).toEqual({ heat: 0, passenger: 0, economy: 0 })
    expect(db.flows).toHaveLength(45)
  })

  it('JSON cities replace：清空后导入并级联删除引用已消失城市的航线', async () => {
    const res = await request(app).post('/api/import?mode=replace').send({
      cities: [{ name: '替换市', province: '浙江省', lnglat: [120, 30], metrics: {} }],
    })
    expect(res.status).toBe(200)
    expect(res.body.cascadeFlows).toBe(45)
    const db = readDb()
    expect(db.cities).toHaveLength(1)
    expect(db.cities[0].name).toBe('替换市')
    expect(db.flows).toHaveLength(0)
  })

  it('边界：空 body 400 / JSON 无 cities·flows 400 / CSV 无表头 400 / mode 非法 400', async () => {
    expect((await request(app).post('/api/import').set('Content-Type', 'text/plain').send('')).status).toBe(400)
    expect((await request(app).post('/api/import').send({ foo: 1 })).status).toBe(400)
    expect((await request(app).post('/api/import').set('Content-Type', 'text/plain').send('random,text\r\n1,2')).status).toBe(400)
    expect((await request(app).post('/api/import?mode=upsert').send({ cities: [] })).status).toBe(400)
  })
})

describe('health 计数口径', () => {
  it('GET /api/health 与库一致', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ ok: true, periods: 12, cities: 75, flows: 45 })
    expect(typeof res.body.updatedAt).toBe('string')
  })
})
