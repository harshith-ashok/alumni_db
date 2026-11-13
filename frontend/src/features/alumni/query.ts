import type { AlumniRecord, CellValue, ColumnDef } from '@/lib/schema/types'

export interface ViewState {
  search: string
  filters: Record<string, string> // column key -> chosen value (absent = all)
  sort: { key: string; dir: 'asc' | 'desc' } | null
}

const text = (v: CellValue | undefined) =>
  v === null || v === undefined ? '' : Array.isArray(v) ? v.join(' ') : String(v)

export const matchesFilter = (v: CellValue | undefined, chosen: string) =>
  Array.isArray(v) ? v.includes(chosen) : text(v) === chosen

export function compareValues(a: CellValue | undefined, b: CellValue | undefined, type: ColumnDef['type']) {
  const an = a === null || a === undefined || a === '', bn = b === null || b === undefined || b === ''
  if (an || bn) return an === bn ? 0 : an ? 1 : -1 // blanks last (before direction flip handled by caller)
  if (type === 'number') return Number(a) - Number(b)
  if (type === 'boolean') return Number(a) - Number(b)
  return text(a).localeCompare(text(b), undefined, { numeric: true, sensitivity: 'base' })
}

/** Search + filter + sort, all driven purely by the column map. */
export function applyView(rows: AlumniRecord[], cols: ColumnDef[], view: ViewState): AlumniRecord[] {
  const q = view.search.trim().toLowerCase()
  const searchCols = cols.filter((c) => c.searchable)
  const filterCols = cols.filter((c) => c.filterable && view.filters[c.key] !== undefined)
  let out = rows.filter(
    (r) =>
      (!q || searchCols.some((c) => text(r[c.key]).toLowerCase().includes(q))) &&
      filterCols.every((c) => matchesFilter(r[c.key], view.filters[c.key])),
  )
  const sc = view.sort && cols.find((c) => c.key === view.sort!.key)
  if (sc) {
    const dir = view.sort!.dir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      const ab = [a[sc.key], b[sc.key]].map((v) => v === null || v === undefined || v === '')
      if (ab[0] || ab[1]) return ab[0] === ab[1] ? 0 : ab[0] ? 1 : -1
      return dir * compareValues(a[sc.key], b[sc.key], sc.type)
    })
  }
  return out
}

/** Filter choices: configured options plus whatever values actually occur in the data. */
export function filterOptions(rows: AlumniRecord[], col: ColumnDef): string[] {
  const set = new Set<string>(col.options ?? [])
  for (const r of rows) {
    const v = r[col.key]
    if (Array.isArray(v)) v.forEach((x) => set.add(x))
    else if (v !== null && v !== undefined && v !== '') set.add(String(v))
  }
  const arr = [...set]
  return col.type === 'number' ? arr.sort((a, b) => Number(b) - Number(a)) : arr.sort((a, b) => a.localeCompare(b))
}
