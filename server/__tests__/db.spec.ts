/**
 * JSON 文件存储层单测（A8）：
 * - BOARD_DB_FILE env 隔离落盘路径（模块级常量读 env，须在动态导入前设置）；
 * - 覆盖：损坏文件改名重建、mutateDb 落盘/updatedAt、fn 抛错不落盘、resetDb 回种子态。
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const tmpDir = mkdtempSync(join(tmpdir(), 'vb-db-test-'))
const dbFile = join(tmpDir, 'db.json')
process.env.BOARD_DB_FILE = dbFile

const { dbFilePath, mutateDb, readDb, resetDb } = await import('../db')

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('db 存储层（A1）', () => {
  it('损坏文件：改名保留现场 + 自动重建种子（cache 未初始化首读触发）', () => {
    writeFileSync(dbFile, '{corrupted!!', 'utf-8')
    const db = readDb()
    expect(db.cities).toHaveLength(75)
    expect(existsSync(dbFile)).toBe(true)
    const rebuilt = JSON.parse(readFileSync(dbFile, 'utf-8')) as { cities: unknown[] }
    expect(rebuilt.cities).toHaveLength(75)
    expect(readdirSync(tmpDir).filter((f) => f.startsWith('db.json.corrupt-'))).toHaveLength(1)
  })

  it('BOARD_DB_FILE env 覆盖落盘路径（不触碰开发库）', () => {
    expect(dbFilePath()).toBe(dbFile)
  })

  it('mutateDb：内存修改落盘 + updatedAt 刷新', () => {
    const before = JSON.parse(readFileSync(dbFile, 'utf-8')) as { cities: unknown[] }
    const t0 = Date.now()
    mutateDb((db) => {
      db.cities.push({ name: '测试市', province: '测试省', lnglat: [0, 0], rank: 0, metrics: {} })
    })
    const after = JSON.parse(readFileSync(dbFile, 'utf-8')) as { cities: unknown[]; meta: { updatedAt: string } }
    expect(after.cities).toHaveLength(before.cities.length + 1)
    expect(new Date(after.meta.updatedAt).getTime()).toBeGreaterThanOrEqual(t0)
    expect(readDb().cities.some((c) => c.name === '测试市')).toBe(true)
  })

  it('mutateDb：fn 抛错时不落盘（文件内容与 updatedAt 均不变）', () => {
    const fileBefore = readFileSync(dbFile, 'utf-8')
    const updatedAtBefore = readDb().meta.updatedAt
    expect(() =>
      mutateDb(() => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(readFileSync(dbFile, 'utf-8')).toBe(fileBefore)
    expect(readDb().meta.updatedAt).toBe(updatedAtBefore)
  })

  it('resetDb：丢弃当前数据回到种子态并落盘', () => {
    const db = resetDb()
    expect(db.cities).toHaveLength(75)
    expect(db.flows).toHaveLength(45)
    expect(db.periods).toHaveLength(12)
    expect(readDb().cities.some((c) => c.name === '测试市')).toBe(false)
    const persisted = JSON.parse(readFileSync(dbFile, 'utf-8')) as { cities: unknown[]; flows: unknown[] }
    expect(persisted.cities).toHaveLength(75)
    expect(persisted.flows).toHaveLength(45)
  })
})
