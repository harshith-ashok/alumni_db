import { fromCell, normHeader } from '@/lib/schema/mapping'
import type { AlumniRecord, CellValue, ColumnDef } from '@/lib/schema/types'

const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
// leading =,+,-,@ would execute as a formula when the CSV is opened in Excel/Sheets
const safe = (s: string) => (/^[=+\-@]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s) ? `'${s}` : s) // numbers & phone numbers are fine

/** Only the columns the caller's role can see are ever passed in, so export can't leak redacted fields. */
export function toCsv(rows: AlumniRecord[], cols: ColumnDef[]): string {
  const cell = (v: CellValue | undefined) => (v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v))
  return [cols.map((c) => esc(c.label)), ...rows.map((r) => cols.map((c) => esc(safe(cell(r[c.key])))))].map((r) => r.join(',')).join('\r\n')
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += ch
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export interface ImportPlan {
  /** CSV header -> column (matched on label or sheet header, case-insensitive) */
  matched: { csv: string; col: ColumnDef }[]
  unmatched: string[]
  records: Record<string, CellValue>[]
}

export function planImport(grid: string[][], editable: ColumnDef[]): ImportPlan {
  const [head = [], ...body] = grid
  const matched: ImportPlan['matched'] = [], unmatched: string[] = []
  head.forEach((h) => {
    const col = editable.find((c) => normHeader(c.label) === normHeader(h) || normHeader(c.header) === normHeader(h))
    if (col) matched.push({ csv: h, col }); else if (h.trim()) unmatched.push(h)
  })
  const idx = (h: string) => head.indexOf(h)
  const records = body.map((r) => {
    const rec: Record<string, CellValue> = {}
    for (const { csv, col } of matched) rec[col.key] = fromCell(r[idx(csv)], col.type)
    return rec
  })
  return { matched, unmatched, records }
}
