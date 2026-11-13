import { describe, expect, it } from 'vitest'
import { DEFAULT_COLUMNS as cols } from '@/lib/schema/defaults'
import { applyView, filterOptions } from '@/features/alumni/query'

const rows = [
  { _id: '1', full_name: 'Ada', company: 'Zoho', graduation_year: 2010, mentor: true, skills: ['React'], city: 'Pune' },
  { _id: '2', full_name: 'Bo', company: 'Google', graduation_year: 2015, mentor: false, skills: ['Data', 'React'], city: null },
  { _id: '3', full_name: 'Cy', company: null, graduation_year: null, mentor: true, skills: [], city: 'Pune' },
]
const v = (o = {}) => ({ search: '', filters: {}, sort: null, ...o })

describe('applyView', () => {
  it('searches only searchable columns', () => {
    expect(applyView(rows, cols, v({ search: 'goog' })).map((r) => r._id)).toEqual(['2'])
    expect(applyView(rows, cols, v({ search: '2015' }))).toHaveLength(0) // year is not searchable
  })
  it('filters incl. multiselect + boolean', () => {
    expect(applyView(rows, cols, v({ filters: { skills: 'React' } }))).toHaveLength(2)
    expect(applyView(rows, cols, v({ filters: { mentor: 'true' } }))).toHaveLength(2)
  })
  it('sorts numerically with blanks last in both directions', () => {
    const asc = applyView(rows, cols, v({ sort: { key: 'graduation_year', dir: 'asc' } })).map((r) => r._id)
    const desc = applyView(rows, cols, v({ sort: { key: 'graduation_year', dir: 'desc' } })).map((r) => r._id)
    expect(asc).toEqual(['1', '2', '3'])
    expect(desc).toEqual(['2', '1', '3'])
  })
  it('lists filter options from data', () => {
    expect(filterOptions(rows, cols.find((c) => c.key === 'city')!)).toEqual(['Pune'])
  })
})
