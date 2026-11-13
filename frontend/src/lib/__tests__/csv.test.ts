import { describe, expect, it } from 'vitest'
import { DEFAULT_COLUMNS as cols } from '@/lib/schema/defaults'
import { parseCsv, planImport, toCsv } from '@/features/alumni/csv'

describe('csv', () => {
  it('round-trips quoting, commas, newlines', () => {
    const csv = toCsv([{ _id: '1', full_name: 'Doe, "J"\nX', email: 'a@b.co' }], cols.slice(0, 2))
    expect(parseCsv(csv)).toEqual([['Full Name', 'Email'], ['Doe, "J"\nX', 'a@b.co']])
  })
  it('neutralises spreadsheet formulas on export', () => {
    expect(toCsv([{ _id: '1', full_name: '=HYPERLINK("x")' }], cols.slice(0, 1))).toContain("'=HYPERLINK")
  })
  it('plans an import by label/header and coerces types', () => {
    const p = planImport(parseCsv('Full Name,Graduation Year,Willing to Mentor,Nope\nAda,2011,yes,x'), cols)
    expect(p.unmatched).toEqual(['Nope'])
    expect(p.records[0]).toMatchObject({ full_name: 'Ada', graduation_year: 2011, mentor: true })
  })
})

import { checkValue } from '@/lib/schema/validation'
describe('server-side value checks', () => {
  const col = (k: string) => cols.find((c) => c.key === k)!
  it('rejects bad email / option / number, allows blanks', () => {
    expect(checkValue(col('email'), 'bad')).toMatch(/valid email/)
    expect(checkValue(col('degree'), 'Wizardry')).toMatch(/allowed option/)
    expect(checkValue(col('graduation_year'), 'abc')).toMatch(/number/)
    expect(checkValue(col('email'), null)).toBeNull()
  })
  it('keeps phone numbers intact on export', () => {
    expect(toCsv([{ _id: '1', phone: '+91 98100' }], [col('phone')])).toContain('\r\n+91 98100')
  })
})
