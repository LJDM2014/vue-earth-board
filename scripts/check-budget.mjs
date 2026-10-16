/**
 * 产物大小预算检查（M4.5 CI 门禁）：
 * 业务主包 = dist/assets/index-*.js（含 maplibre 传递依赖 zod），
 * gzip 总和超过 900KB 即失败；vue/maplibre/deck 为独立 vendor chunk，可长期
 * 缓存且体积稳定，不参与本预算（大额变更时人工评审即可）。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET_BYTES = 900 * 1024
const assetsDir = 'dist/assets'

const entries = readdirSync(assetsDir).filter((f) => /^index-.*\.js$/.test(f))
if (entries.length === 0) {
  console.error('[budget] 未找到 dist/assets/index-*.js，请先执行 pnpm build')
  process.exit(1)
}

let total = 0
for (const file of entries) {
  const gz = gzipSync(readFileSync(join(assetsDir, file))).length
  total += gz
  console.log(`[budget] ${file} gzip=${(gz / 1024).toFixed(1)}KB`)
}
console.log(
  `[budget] 业务主包 gzip 合计 ${(total / 1024).toFixed(1)}KB / 预算 ${(BUDGET_BYTES / 1024) | 0}KB`,
)
if (total > BUDGET_BYTES) {
  console.error('[budget] 超出预算：请先做产物体积治理（分包/按需引入）再发布')
  process.exit(1)
}
