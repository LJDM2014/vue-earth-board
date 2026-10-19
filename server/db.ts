/**
 * JSON 文件存储层（后台数据管理模块 A1）：
 * 内存缓存 + 写时落盘（temp 文件 + rename 原子写，Windows rename 被占用时退化为覆盖写）。
 * 读写口径：readDb() 惰性加载（首次自动建种子库），mutateDb(fn) 串行修改后统一刷新
 * meta.updatedAt 并落盘——路由层只操作内存对象，不直接触碰文件。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSeedDb } from './seed'

export type FlowCategory = 'passenger' | 'cargo'

/** 城市三指标（显式数值，按周期键控） */
export interface CityMetrics {
  heat: number
  passenger: number
  economy: number
}

/** 城市档案 + 各期指标（name 为唯一键） */
export interface CityRecord {
  name: string
  province: string
  lnglat: [number, number]
  /** 全国 GDP 排位（展示用，不再参与数值生成） */
  rank: number
  /** 周期 'YYYY-MM' → 三指标 */
  metrics: Record<string, CityMetrics>
}

/** 航线 OD + 各期运量（id 为唯一键，服务端自增） */
export interface FlowRecord {
  id: number
  from: string
  to: string
  category: FlowCategory
  /** 周期 'YYYY-MM' → 运量 */
  volumes: Record<string, number>
}

export interface DbMeta {
  seededAt: string
  updatedAt: string
  /** 下一条航线分配的 id（删除不复用，避免外部引用漂移） */
  nextFlowId: number
}

export interface DbData {
  version: number
  meta: DbMeta
  /** 全部周期（升序） */
  periods: string[]
  cities: CityRecord[]
  flows: FlowRecord[]
}

/** 落盘路径：默认 server/data/db.json；BOARD_DB_FILE env 可覆盖（A8 单测隔离用，不污染开发库） */
const DB_FILE = process.env.BOARD_DB_FILE ?? join(dirname(fileURLToPath(import.meta.url)), 'data', 'db.json')

let cache: DbData | null = null

/** 从磁盘加载；文件不存在或损坏时返回 null（调用方回退种子） */
function loadFromDisk(): DbData | null {
  if (!existsSync(DB_FILE)) return null
  try {
    return JSON.parse(readFileSync(DB_FILE, 'utf-8')) as DbData
  } catch (err) {
    // 损坏文件改名保留现场，不阻塞服务启动
    try {
      renameSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`)
    } catch {
      // 改名失败（被占用）只能覆盖重建
    }
    console.error('[db] db.json 解析失败，已重建种子数据：', err)
    return null
  }
}

/** 序列化落盘：先写临时文件再原子替换，避免写入中途被读到半截数据 */
function persist(db: DbData): DbData {
  mkdirSync(dirname(DB_FILE), { recursive: true })
  const tmp = `${DB_FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8')
  try {
    renameSync(tmp, DB_FILE)
  } catch {
    // Windows 下目标被监视占用（编辑器/杀软）时 rename 可能 EPERM，退化为覆盖写
    copyFileSync(tmp, DB_FILE)
    unlinkSync(tmp)
  }
  return db
}

/** 读取当前库（惰性加载，首次自动种子建库并落盘） */
export function readDb(): DbData {
  if (!cache) {
    const fromDisk = loadFromDisk()
    cache = fromDisk ?? persist(buildSeedDb())
  }
  return cache
}

/**
 * 事务式修改：fn 内同步修改内存库，返回后统一刷新 updatedAt 并落盘。
 * fn 抛错则不落盘（内存修改可能已发生，但进程内下次 mutate 会重新收敛）。
 */
export function mutateDb<T>(fn: (db: DbData) => T): T {
  const db = readDb()
  const result = fn(db)
  db.meta.updatedAt = new Date().toISOString()
  persist(db)
  return result
}

/** 危险操作：丢弃当前数据，重建种子库并落盘 */
export function resetDb(): DbData {
  cache = persist(buildSeedDb())
  return cache
}

/** 当前库的磁盘路径（诊断/测试用） */
export function dbFilePath(): string {
  return DB_FILE
}
