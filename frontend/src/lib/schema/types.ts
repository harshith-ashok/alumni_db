export const ROLES = ['viewer', 'editor', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const COLUMN_TYPES = [
  'text',
  'longtext',
  'email',
  'phone',
  'url',
  'number',
  'date',
  'select',
  'multiselect',
  'boolean',
] as const
export type ColumnType = (typeof COLUMN_TYPES)[number]

export type CellValue = string | number | boolean | string[] | null

/** One alumnus, keyed by ColumnDef.key (NOT the sheet header). `_id` is the stable row identity. */
export interface AlumniRecord {
  _id: string
  [key: string]: CellValue
}

/** Maps one sheet column to the UI. Editing `header` re-maps it to a different sheet column. */
export interface ColumnDef {
  /** Stable internal key; record fields are stored under this. */
  key: string
  /** Exact header text in the sheet row 1. */
  header: string
  label: string
  type: ColumnType
  options?: string[]
  order: number
  required?: boolean
  primary?: boolean
  showInTable: boolean
  filterable: boolean
  searchable: boolean
  sortable: boolean
  /** Roles allowed to see / edit this field. Admin is always allowed. */
  viewRoles: Role[]
  editRoles: Role[]
}

export interface SchemaConfig {
  /** Bumped on every config save; used as cache buster. */
  version: number
  columns: ColumnDef[]
}

export interface DataVersion {
  schema: number
  data: number
}

export interface AppUser {
  email: string
  name: string
  role: Role
  active: boolean
}
