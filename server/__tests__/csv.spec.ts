/**
 * CSV 序列化与解析单测（A8，docs/admin-module-plan.md §9）：
 * 覆盖 RFC 4180 转义、BOM/CRLF 口径、引号字段往返、Excel 脏单元格宽容数值。
 */
import { describe, expect, it } from 'vitest'
import { csvEscape, lenientNumber, parseCsv, stringifyCsv } from '../csv'

describe('csvEscape 转义（RFC 4180）', () => {
  it('普通文本原样输出', () => {
    expect(csvEscape('上海市')).toBe('上海市')
    expect(csvEscape('')).toBe('')
  })

  it('含逗号加引号包裹', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
  })

  it('内部引号翻倍后再包裹', () => {
    expect(csvEscape('他说"你好"')).toBe('"他说""你好"""')
  })

  it('含换行加包裹', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"')
  })
})

describe('stringifyCsv 序列化', () => {
  it('统一 CRLF 行尾（Excel 兼容）', () => {
    expect(stringifyCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d')
  })

  it('空行数组作为块间分隔（scope=all 双块导出形态）', () => {
    const text = stringifyCsv([['name'], ['上海市'], [], ['from'], ['上海市']])
    expect(text).toBe('name\r\n上海市\r\n\r\nfrom\r\n上海市')
  })
})

describe('parseCsv 解析', () => {
  it('剥 UTF-8 BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('CRLF / LF 混合行尾', () => {
    expect(parseCsv('a,b\r\nc,d\ne,f')).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f']])
  })

  it('引号字段：逗号不切列、引号转义还原', () => {
    expect(parseCsv('"a,b",c\r\n"say ""hi""",d')).toEqual([['a,b', 'c'], ['say "hi"', 'd']])
  })

  it('引号内换行不切行', () => {
    expect(parseCsv('a,"b1\nb2",c')).toEqual([['a', 'b1\nb2', 'c']])
  })

  it('空行跳过（块间分隔/文件尾）', () => {
    expect(parseCsv('a,b\r\n\r\nc,d\r\n\r\n')).toEqual([['a', 'b'], ['c', 'd']])
  })

  it('尾行无换行仍成行', () => {
    expect(parseCsv('a,b\nc')).toEqual([['a', 'b'], ['c']])
  })

  it('导出 → 解析往返：含中文引号/逗号字段无损', () => {
    const rows = [['name', 'province'], ['「测试",城', '浙江']]
    expect(parseCsv(stringifyCsv(rows))).toEqual(rows)
  })
})

describe('lenientNumber 宽容转换（Excel 脏单元格）', () => {
  it('数字与数字字符串（含空白）', () => {
    expect(lenientNumber(12)).toBe(12)
    expect(lenientNumber(' 42 ')).toBe(42)
    expect(lenientNumber('-3.5')).toBe(-3.5)
  })

  it('空字符串 → 0（Number("") 语义，缺失单元格按 0 补齐）', () => {
    expect(lenientNumber('')).toBe(0)
  })

  it('乱码 / 非有限数 / 非字符串 → null 判脏', () => {
    expect(lenientNumber('abc')).toBe(null)
    expect(lenientNumber(NaN)).toBe(null)
    expect(lenientNumber(Infinity)).toBe(null)
    expect(lenientNumber(null)).toBe(null)
  })
})
