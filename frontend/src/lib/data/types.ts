import type { AlumniRecord, AppUser, CellValue, DataVersion, Role, SchemaConfig } from '@/lib/schema/types'

export interface Session {
  email: string
  name: string
  role: Role
  picture?: string
}

export interface Mutated<T> {
  value: T
  version: DataVersion
}

export class DataError extends Error {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID' | 'SERVER'
  constructor(code: DataError['code'], message: string) {
    super(message)
    this.code = code
  }
}

/** Everything the UI needs from the backend. Implemented by the mock and Apps Script adapters. */
export interface DataSource {
  readonly kind: 'mock' | 'apps-script'
  /** Resolves the caller's role. Throws UNAUTHENTICATED / FORBIDDEN. */
  whoAmI(): Promise<Session>
  /** Cheap call used to decide whether cached data is stale. */
  getVersion(): Promise<DataVersion>
  getSchema(): Promise<SchemaConfig>
  listAlumni(): Promise<AlumniRecord[]>
  createAlumni(values: Record<string, CellValue>): Promise<Mutated<AlumniRecord>>
  updateAlumni(id: string, patch: Record<string, CellValue>): Promise<Mutated<AlumniRecord>>
  deleteAlumni(id: string): Promise<Mutated<null>>

  // admin
  getSheetHeaders(): Promise<{ headers: string[]; samples: Record<string, (string | number | boolean | null)[]> }>
  saveSchema(columns: SchemaConfig['columns']): Promise<SchemaConfig>
  listUsers(): Promise<AppUser[]>
  upsertUser(user: AppUser): Promise<AppUser[]>
  removeUser(email: string): Promise<AppUser[]>
  clearServerCache(): Promise<void>
}
