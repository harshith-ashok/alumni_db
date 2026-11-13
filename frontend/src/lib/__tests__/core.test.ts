import { describe, expect, it } from 'vitest'
import { DEFAULT_COLUMNS } from '@/lib/schema/defaults'
import { diffHeaders, fromCell, inferColumnDef, recordToRow, rowToRecord, slugKey, toCell } from '@/lib/schema/mapping'
import { buildRecordSchema } from '@/lib/schema/validation'
import { redactRecord, sanitizePatch, canEditColumn } from '@/lib/auth/permissions'

const cols = DEFAULT_COLUMNS
const col = (k: string) => cols.find((c) => c.key === k)!

describe('cell coercion', () => {
  it('round-trips multiselect and booleans', () => {
    expect(fromCell('React; Python', 'multiselect')).toEqual(['React', 'Python'])
    expect(toCell(['a', 'b'], 'multiselect')).toBe('a; b')
    expect(fromCell('yes', 'boolean')).toBe(true)
    expect(fromCell('', 'number')).toBeNull()
    expect(fromCell('1,200', 'number')).toBe(1200)
  })
})

describe('header mapping', () => {
  it('maps rows by header and follows a re-map', () => {
    const row = { 'Full Name': 'Ada', Email: 'a@x.io' }
    expect(rowToRecord('1', row, cols).full_name).toBe('Ada')
    const remapped = cols.map((c) => (c.key === 'full_name' ? { ...c, header: 'Name' } : c))
    expect(rowToRecord('1', { Name: 'Ada' }, remapped).full_name).toBe('Ada')
    expect(recordToRow({ full_name: 'Bo' }, remapped)).toEqual({ Name: 'Bo' })
  })
  it('diffs headers case/space-insensitively', () => {
    const d = diffHeaders(['full  name', 'Batch', 'Email'], cols)
    expect(d.newHeaders).toEqual(['Batch'])
    expect(d.missing.map((c) => c.key)).not.toContain('full_name')
    expect(d.missing.map((c) => c.key)).toContain('phone')
  })
  it('infers defs and unique keys', () => {
    const d = inferColumnDef('Batch Year', ['2010', '2011'], cols)
    expect(d.type).toBe('number')
    expect(slugKey('Full Name', new Set(['full_name']))).toBe('full_name_2')
  })
})

describe('RBAC', () => {
  const rec = { _id: '1', full_name: 'A', phone: '123', notes: 'x' }
  it('redacts by role', () => {
    expect(redactRecord(rec, cols, 'viewer')).toEqual({ _id: '1', full_name: 'A' })
    expect(redactRecord(rec, cols, 'editor').phone).toBe('123')
  })
  it('viewers cannot write, editors can, admin can', () => {
    expect(canEditColumn(col('full_name'), 'viewer')).toBe(false)
    expect(canEditColumn(col('full_name'), 'editor')).toBe(true)
    expect(sanitizePatch({ full_name: 'z' }, cols, 'viewer')).toEqual({})
  })
})

describe('validation', () => {
  it('builds a schema from columns', () => {
    const s = buildRecordSchema(cols)
    expect(s.safeParse({ full_name: 'A', email: 'bad', graduation_year: 2020, mentor: false }).success).toBe(false)
    expect(s.safeParse({ full_name: 'A', email: 'a@b.co', graduation_year: 2020, mentor: false }).success).toBe(true)
  })
})
