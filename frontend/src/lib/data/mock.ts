import { redactRecord, sanitizePatch, can, visibleColumns } from '@/lib/auth/permissions'
import { DEFAULT_SCHEMA } from '@/lib/schema/defaults'
import { recordToRow, rowToRecord, type RawRow } from '@/lib/schema/mapping'
import type { AlumniRecord, AppUser, CellValue, ColumnDef, DataVersion, SchemaConfig } from '@/lib/schema/types'
import { DataError, type DataSource, type Mutated, type Session } from './types'

/**
 * In-browser stand-in for the Google Sheet + Apps Script backend. It deliberately mimics the
 * sheet: rows are keyed by *header text*, and the column map translates headers <-> keys, so
 * header renames / re-mapping behave exactly like the real thing.
 */

const DB_KEY = 'alumni.mock.db.v1'
const ID_KEY = 'alumni.mock.identity'

interface MockDb {
  headers: string[]
  rows: { id: string; cells: RawRow }[]
  schema: SchemaConfig
  users: AppUser[]
  version: DataVersion
}

const FIRST = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Karthik', 'Meera', 'Vikram', 'Sneha', 'Arjun', 'Priya', 'Rahul', 'Isha', 'Nikhil', 'Kavya', 'Siddharth']
const LAST = ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Gupta', 'Menon', 'Rao', 'Singh', 'Das']
const CITIES = ['Bengaluru', 'Hyderabad', 'Mumbai', 'Chennai', 'Pune', 'Delhi', 'London', 'San Francisco', 'Singapore']
const COMPANIES = ['Google', 'Infosys', 'Microsoft', 'TCS', 'Flipkart', 'Goldman Sachs', 'Zoho', 'Amazon', 'Deloitte', 'ISRO']
const TITLES = ['Software Engineer', 'Data Scientist', 'Product Manager', 'Analyst', 'Consultant', 'Researcher', 'Engineering Manager']

function seed(): MockDb {
  const cols = DEFAULT_SCHEMA.columns
  const headers = cols.map((c) => c.header)
  const pick = <T,>(arr: T[], i: number, m = 1) => arr[(i * m + (i >> 1)) % arr.length]
  const rows = Array.from({ length: 60 }, (_, i) => {
    const name = `${pick(FIRST, i, 7)} ${pick(LAST, i, 3)}`
    const values: Record<string, CellValue> = {
      full_name: name,
      email: `${name.toLowerCase().replace(' ', '.')}${i}@alumni.example.edu`,
      phone: `+91 98${String(10000000 + i * 137731).slice(0, 8)}`,
      graduation_year: 2008 + (i % 17),
      degree: pick(cols[4].options!, i, 5),
      department: pick(cols[5].options!, i, 3),
      company: pick(COMPANIES, i, 7),
      job_title: pick(TITLES, i, 5),
      city: pick(CITIES, i, 4),
      linkedin: `https://linkedin.com/in/${name.toLowerCase().replace(' ', '-')}-${i}`,
      mentor: i % 3 === 0,
      skills: [pick(cols[11].options!, i, 2), pick(cols[11].options!, i + 3, 5)].filter((v, j, a) => a.indexOf(v) === j),
      notes: i % 7 === 0 ? 'Guest lecture candidate.' : null,
    }
    return { id: `r${i + 1}`, cells: recordToRow(values, cols) }
  })
  const users: AppUser[] = [
    { email: 'admin@demo.edu', name: 'Ada Admin', role: 'admin', active: true },
    { email: 'editor@demo.edu', name: 'Ed Editor', role: 'editor', active: true },
    { email: 'viewer@demo.edu', name: 'Vi Viewer', role: 'viewer', active: true },
  ]
  return { headers, rows, schema: DEFAULT_SCHEMA, users, version: { schema: 1, data: 1 } }
}

function load(): MockDb {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through */ }
  const db = seed()
  save(db)
  return db
}
function save(db: MockDb) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { /* quota/private mode */ }
}
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms))
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

export const mockIdentity = {
  get: () => { try { return localStorage.getItem(ID_KEY) } catch { return null } },
  set: (email: string | null) => { try { if (email) localStorage.setItem(ID_KEY, email); else localStorage.removeItem(ID_KEY) } catch { /* noop */ } },
  demoUsers: () => load().users,
}

/** Dev helpers that simulate someone editing the sheet directly. */
export const mockSheet = {
  headers: () => load().headers,
  renameHeader(from: string, to: string) {
    const db = load()
    db.headers = db.headers.map((h) => (h === from ? to : h))
    for (const r of db.rows) if (from in r.cells) { r.cells[to] = r.cells[from]; delete r.cells[from] }
    db.version.data++
    save(db)
  },
  addColumn(header: string, fill: (i: number) => string | number | boolean) {
    const db = load()
    db.headers.push(header)
    db.rows.forEach((r, i) => (r.cells[header] = fill(i)))
    db.version.data++
    save(db)
  },
  reset() { try { localStorage.removeItem(DB_KEY) } catch { /* noop */ } },
}

function session(db: MockDb): Session {
  const email = mockIdentity.get()
  if (!email) throw new DataError('UNAUTHENTICATED', 'Not signed in')
  const u = db.users.find((x) => x.email.toLowerCase() === email.toLowerCase())
  if (!u || !u.active) throw new DataError('FORBIDDEN', `${email} is not authorised for this app`)
  return { email: u.email, name: u.name, role: u.role }
}

function validate(cols: ColumnDef[], values: Record<string, CellValue>, partial: boolean) {
  for (const c of cols) {
    const v = values[c.key]
    if (c.required && (!partial || c.key in values) && (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)))
      throw new DataError('INVALID', `${c.label} is required`)
  }
}

export function createMockDataSource(): DataSource {
  const view = (db: MockDb, role: Session['role']) =>
    db.rows.map((r) => redactRecord(rowToRecord(r.id, r.cells, db.schema.columns), db.schema.columns, role))

  return {
    kind: 'mock',
    async whoAmI() { await wait(); return session(load()) },
    async getVersion() { await wait(40); const db = load(); session(db); return db.version },
    async getSchema() {
      await wait(); const db = load(); const s = session(db)
      const columns = s.role === 'admin' ? db.schema.columns : visibleColumns(db.schema.columns, s.role)
      return clone({ version: db.schema.version, columns })
    },
    async listAlumni() { await wait(250); const db = load(); const s = session(db); return view(db, s.role) },
    async createAlumni(values) {
      await wait(); const db = load(); const s = session(db)
      if (!can.writeAlumni(s.role)) throw new DataError('FORBIDDEN', 'Read-only access')
      const safe = sanitizePatch(values, db.schema.columns, s.role) as Record<string, CellValue>
      validate(db.schema.columns.filter((c) => c.key in safe || c.required), safe, false)
      const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      db.rows.push({ id, cells: recordToRow(safe, db.schema.columns) })
      db.version.data++; save(db)
      return { value: redactRecord(rowToRecord(id, db.rows.at(-1)!.cells, db.schema.columns), db.schema.columns, s.role), version: db.version }
    },
    async updateAlumni(id, patch) {
      await wait(); const db = load(); const s = session(db)
      if (!can.writeAlumni(s.role)) throw new DataError('FORBIDDEN', 'Read-only access')
      const row = db.rows.find((r) => r.id === id)
      if (!row) throw new DataError('NOT_FOUND', 'Record not found')
      const safe = sanitizePatch(patch, db.schema.columns, s.role) as Record<string, CellValue>
      validate(db.schema.columns, safe, true)
      Object.assign(row.cells, recordToRow(safe, db.schema.columns))
      db.version.data++; save(db)
      return { value: redactRecord(rowToRecord(id, row.cells, db.schema.columns), db.schema.columns, s.role), version: db.version } as Mutated<AlumniRecord>
    },
    async deleteAlumni(id) {
      await wait(); const db = load(); const s = session(db)
      if (!can.writeAlumni(s.role)) throw new DataError('FORBIDDEN', 'Read-only access')
      db.rows = db.rows.filter((r) => r.id !== id); db.version.data++; save(db)
      return { value: null, version: db.version }
    },
    async getSheetHeaders() {
      await wait(); const db = load(); const s = session(db)
      if (!can.manageSchema(s.role)) throw new DataError('FORBIDDEN', 'Admin only')
      const samples: Record<string, (string | number | boolean | null)[]> = {}
      for (const h of db.headers) samples[h] = db.rows.slice(0, 20).map((r) => (r.cells[h] ?? null) as string | number | boolean | null)
      return { headers: db.headers, samples }
    },
    async saveSchema(columns) {
      await wait(); const db = load(); const s = session(db)
      if (!can.manageSchema(s.role)) throw new DataError('FORBIDDEN', 'Admin only')
      db.schema = { version: db.schema.version + 1, columns: clone(columns) }
      db.version.schema = db.schema.version; save(db)
      return clone(db.schema)
    },
    async listUsers() {
      await wait(); const db = load(); const s = session(db)
      if (!can.manageUsers(s.role)) throw new DataError('FORBIDDEN', 'Admin only')
      return db.users
    },
    async upsertUser(user) {
      await wait(); const db = load(); const s = session(db)
      if (!can.manageUsers(s.role)) throw new DataError('FORBIDDEN', 'Admin only')
      const i = db.users.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase())
      if (i >= 0) db.users[i] = user; else db.users.push(user)
      if (!db.users.some((u) => u.role === 'admin' && u.active)) throw new DataError('INVALID', 'At least one active admin is required')
      save(db); return db.users
    },
    async removeUser(email) {
      await wait(); const db = load(); const s = session(db)
      if (!can.manageUsers(s.role)) throw new DataError('FORBIDDEN', 'Admin only')
      const next = db.users.filter((u) => u.email.toLowerCase() !== email.toLowerCase())
      if (!next.some((u) => u.role === 'admin' && u.active)) throw new DataError('INVALID', 'At least one active admin is required')
      db.users = next; save(db); return db.users
    },
    async clearServerCache() { await wait(80) },
  }
}
