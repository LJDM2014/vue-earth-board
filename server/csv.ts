/**
 * CSV 序列化与解析（A7，A8 单测覆盖：中文转义 / BOM / 表头嗅探 / 数值边界）：
 * - 导出统一 CRLF 行尾 + UTF-8 BOM（Excel 中文兼容）；
 * - 含逗号/引号/换行的字段按 RFC 4180 双引号转义；
 * - 解析支持带引号字段与 CRLF/LF 混合行尾，返回单元格矩阵（不含表头处理，由调用方负责）。
 */

/** 单元格转义：含逗号/引号/换行时加双引号包裹，内部引号翻倍；
 *  公式注入防御（与 schemas.ts 入库校验构成防御纵深）：以 = + - @ 或制表开头的前置单引号，Excel 按文本处理 */
export function csvEscape(value: string): string {
  const safe = /^[=+\-@\t]/.test(value) ? `'${value}` : value
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

/** 行矩阵 → CSV 文本（CRLF 行尾，不含 BOM，调用方按需添加） */
export function stringifyCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n')
}

/** 解析 CSV 文本为行矩阵：容忍 CRLF/LF、BOM 与引号内逗号/换行/转义引号；空行跳过 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const pushField = (): void => {
    row.push(field)
    field = ''
  }
  const pushRow = (): void => {
    pushField()
    // 跳过完全空行（常见于块间分隔/文件尾）
    if (row.length > 1 || row[0].trim() !== '') rows.push(row)
    row = []
  }
  while (i < src.length) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      pushField()
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      pushRow()
      if (ch === '\r' && src[i + 1] === '\n') i += 2
      else i++
      continue
    }
    field += ch
    i++
  }
  // 文件尾无换行的最后一行
  if (field !== '' || row.length > 0) pushRow()
  return rows
}

/** 数值宽容转换（Excel 脏单元格）：trim 后 Number()，失败返回 null 由调用方判脏 */
export function lenientNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const n = Number(v.trim())
  return Number.isFinite(n) ? n : null
}
