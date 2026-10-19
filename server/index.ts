/**
 * 大屏后台 API 服务（后台数据管理模块 A1）：
 * A1 交付健康检查端点；A2 起挂载大屏读端点（/api/periods|cities|flows|history），
 * A7 起挂载管理端 CRUD 与导入导出（/api/admin/*、/api/export、/api/import）。
 * 开发态由 vite dev server 将 /api 代理到本服务（默认端口 3100）。
 */
import cors from 'cors'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { readDb } from './db'
import { createBoardRouter } from './routes/board'
import { createAdminRouter } from './routes/admin'
import { createTransferRouter } from './routes/transfer'

const app = express()

/**
 * 允许的浏览器来源（vite dev/preview 页面 origin），CORS 与写方法 Origin 校验共用。
 * dev 大屏/管理端经 vite proxy 同源访问不经过此处；白名单覆盖跨端口直连调试场景，
 * 分离部署/局域网访问时用 CORS_ORIGINS env 追加（逗号分隔）。
 */
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ??
  'http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// 仅白名单来源可跨域读取；无 Origin（同源/curl）放行
app.use(
  cors({
    origin(origin, callback) {
      callback(null, origin === undefined || ALLOWED_ORIGINS.includes(origin))
    },
  }),
)

// 写方法 CSRF 防线：浏览器发起的跨站请求必带 Origin，非白名单一律 403
// （否则恶意网页可用 text/plain 简单请求打 /api/import?mode=replace 清库，CORS 挡不住不读响应的写请求）
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
  const origin = req.headers.origin
  if (origin === undefined || ALLOWED_ORIGINS.includes(origin)) return next()
  res.status(403).json({ error: { code: 'FORBIDDEN_ORIGIN', message: '跨站写请求已被拒绝' } })
})

// 导入大 JSON 放宽 body 限制
app.use(express.json({ limit: '10mb' }))

/**
 * 管理/导入导出端点可选 token 门禁：设置 ADMIN_TOKEN env 后启用，
 * 请求须携带 x-admin-token 头（管理端由 VITE_ADMIN_TOKEN 构建注入自动携带）。
 */
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? ''

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  if (ADMIN_TOKEN === '' || req.headers['x-admin-token'] === ADMIN_TOKEN) return next()
  res.status(401).json({ error: { code: 'UNAUTHORIZED', message: '缺少或错误的 x-admin-token 请求头' } })
}

// 健康检查（公开）：管理端状态栏与大屏降级诊断共用。必须注册在 token 挂载层之前——
// app.use('/api', mw, router) 的中间件会拦截该前缀下所有未被前面路由消费的请求
app.get('/api/health', (_req, res) => {
  const db = readDb()
  res.json({
    ok: true,
    periods: db.periods.length,
    cities: db.cities.length,
    flows: db.flows.length,
    updatedAt: db.meta.updatedAt,
  })
})

// 大屏读端点（契约对齐 HttpDataSource，A2）
app.use('/api', createBoardRouter())

// 导入导出（A7：/api/export /api/import，CSV 以 text/plain|csv 文本上传）
app.use('/api', requireAdminToken, createTransferRouter())

// 管理端点（A4 读 / A5-A6 CRUD / A7 导入导出）
app.use('/api/admin', requireAdminToken, createAdminRouter())

const port = Number.parseInt(process.env.SERVER_PORT ?? '3100', 10)

app.listen(port, () => {
  // 启动即加载（磁盘无库时自动种子建库并落盘）
  const db = readDb()
  console.log(`[board-api] listening on http://localhost:${port}`)
  console.log(
    `[board-api] db ready: ${db.periods.length} periods / ${db.cities.length} cities / ${db.flows.length} flows`,
  )
})
