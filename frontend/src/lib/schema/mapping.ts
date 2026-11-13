import type { AlumniRecord, CellValue, ColumnDef, ColumnType } from './types'

export type RawCell = string | number | boolean | null | undefined
export type RawRow = Record<string, RawCell> // keyed by sheet header

const LIST_SEP = '; '

export const normHeader = (h: string) => h.trim().replace(/\s+/g, ' ').toLowerCase()

export function slugKey(header: string, taken: Set<string> = new Set()) {
  const base =
    header
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'col'
  let key = /^[0-9]/.test(base) ? `c_${base}` : base
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`
  return key
}

export function fromCell(raw: RawCell, type: ColumnType): CellValue {
  if (raw === null || raw === undefined || raw === '') return null
  switch (type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
      return Number.isFinite(n) ? n : null
    }
    case 'boolean':
      return raw === true || /^(true|yes|y|1)$/i.test(String(raw).trim())
    case 'multiselect':
      return String(raw)
        .split(/\s*[;,]\s*/)
        .filter(Boolean)
    default:
      return String(raw).trim() || null
  }
}

export function toCell(value: CellValue | undefined, type: ColumnType): RawCell {
  if (value === null || value === undefined) return ''
  if (type === 'multiselect' && Array.isArray(value)) return value.join(LIST_SEP)
  if (Array.isArray(value)) return value.join(LIST_SEP)
  return value
}

export function rowToRecord(id: string, row: RawRow, cols: ColumnDef[]): AlumniRecord {
  const rec: AlumniRecord = { _id: id }
  for (const c of cols) rec[c.key] = fromCell(row[c.header], c.type)
  return rec
}

export function recordToRow(values: Record<string, CellValue | undefined>, cols: ColumnDef[]): RawRow {
  const row: RawRow = {}
  for (const c of cols) if (c.key in values) row[c.header] = toCell(values[c.key], c.type)
  return row
}

// ---- header sync -----------------------------------------------------------------

export interface HeaderDiff {
  /** Sheet headers with no column def yet. */
  newHeaders: string[]
  /** Column defs whose header no longer exists in the sheet. */
  missing: ColumnDef[]
}

export function diffHeaders(headers: string[], cols: ColumnDef[]): HeaderDiff {
  const live = new Set(headers.map(normHeader))
  const mapped = new Set(cols.map((c) => normHeader(c.header)))
  return {
    newHeaders: headers.filter((h) => h && !mapped.has(normHeader(h))),
    missing: cols.filter((c) => !live.has(normHeader(c.header))),
  }
}

/** Guess a ColumnDef for a header we have not seen, using its name and sample values. */
export function inferColumnDef(
  header: string,
  samples: RawCell[],
  existing: ColumnDef[],
): ColumnDef {
  const h = header.toLowerCase()
  const vals = samples.filter((s) => s !== '' && s != null).map(String)
  const all = (re: RegExp) => vals.length > 0 && vals.every((v) => re.test(v))
  let type = 'text' as ColumnType
  if (/e-?mail/.test(h) || all(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) type = 'email'
  else if (/phone|mobile|contact no/.test(h)) type = 'phone'
  else if (/url|link|website|linkedin/.test(h) || all(/^https?:\/\//)) type = 'url'
  else if (all(/^\d{4}-\d{2}-\d{2}/)) type = 'date'
  else if (all(/^-?\d+(\.\d+)?$/)) type = 'number'
  else if (all(/^(true|false|yes|no)$/i)) type = 'boolean'
  else if (/notes?|comment|about|bio|description/.test(h)) type = 'longtext'
  const distinct = new Set(vals)
  let options: string[] | undefined
  if (type === 'text' && vals.length >= 8 && distinct.size <= 8) {
    type = 'select'
    options = [...distinct].sort()
  }
  return {
    key: slugKey(header, new Set(existing.map((c) => c.key))),
    header,
    label: header.trim(),
    type,
    options,
    order: existing.reduce((m, c) => Math.max(m, c.order), 0) + 1,
    showInTable: existing.filter((c) => c.showInTable).length < 8,
    filterable: type === 'select' || type === 'boolean' || type === 'multiselect',
    searchable: ['text', 'email', 'longtext', 'phone'].includes(type),
    sortable: type !== 'multiselect' && type !== 'longtext',
    viewRoles: ['viewer', 'editor'],
    editRoles: ['editor'],
  }
}
