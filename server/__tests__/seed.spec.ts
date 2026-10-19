/**
 * 种子数据单测（A8）：确定性可复现、口径（75 城/45 OD/12 期）、稠密非负、OD 拓扑自洽。
 */
import { describe, expect, it } from 'vitest'
import { buildSeedDb, buildSeedPeriods } from '../seed'

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/

describe('buildSeedDb 种子确定性（A1）', () => {
  it('同参数两次构建：数据体逐位一致（仅 meta 时间戳随构建时刻不同）', () => {
    const a = buildSeedDb(new Date('2026-01-01T00:00:00Z'))
    const b = buildSeedDb(new Date('2026-01-02T00:00:00Z'))
    expect(JSON.stringify({ ...a, meta: undefined })).toBe(JSON.stringify({ ...b, meta: undefined }))
    expect(a.meta.seededAt).toContain('2026-01-01')
    expect(b.meta.seededAt).toContain('2026-01-02')
  })

  it('口径：75 城 / 45 条 OD / 12 期，城市名唯一', () => {
    const db = buildSeedDb()
    expect(db.cities).toHaveLength(75)
    expect(db.flows).toHaveLength(45)
    expect(db.periods).toHaveLength(12)
    expect(new Set(db.cities.map((c) => c.name)).size).toBe(75)
  })

  it('周期升序、格式 YYYY-MM 且为 2025-01 起连续 12 个月', () => {
    const periods = buildSeedPeriods()
    expect(periods).toEqual(['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'])
    for (const p of periods) expect(p).toMatch(PERIOD_RE)
  })

  it('指标/运量稠密非负：每城每期三指标、每条航线每期运量齐全', () => {
    const db = buildSeedDb()
    for (const c of db.cities) {
      expect(Object.keys(c.metrics)).toHaveLength(12)
      for (const m of Object.values(c.metrics)) {
        expect(m.heat).toBeGreaterThanOrEqual(0)
        expect(m.passenger).toBeGreaterThanOrEqual(0)
        expect(m.economy).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(m.heat + m.passenger + m.economy)).toBe(true)
      }
    }
    for (const f of db.flows) {
      expect(Object.keys(f.volumes)).toHaveLength(12)
      for (const v of Object.values(f.volumes)) expect(v).toBeGreaterThanOrEqual(0)
    }
  })

  it('OD 拓扑合法：起讫不同且均为种子城市；nextFlowId 大于最大 id', () => {
    const db = buildSeedDb()
    const names = new Set(db.cities.map((c) => c.name))
    for (const f of db.flows) {
      expect(f.from).not.toBe(f.to)
      expect(names.has(f.from)).toBe(true)
      expect(names.has(f.to)).toBe(true)
      expect(['passenger', 'cargo']).toContain(f.category)
    }
    expect(db.meta.nextFlowId).toBeGreaterThan(Math.max(...db.flows.map((f) => f.id)))
    expect(db.meta.nextFlowId).toBe(46)
  })
})
