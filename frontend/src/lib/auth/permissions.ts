import type { AlumniRecord, ColumnDef, Role } from '@/lib/schema/types'

/** Pure RBAC rules. Mirrored by backend/Code.gs — keep both in sync. */

export const can = {
  writeAlumni: (role: Role) => role === 'editor' || role === 'admin',
  manageSchema: (role: Role) => role === 'admin',
  manageUsers: (role: Role) => role === 'admin',
}

export const canViewColumn = (col: ColumnDef, role: Role) =>
  role === 'admin' || col.viewRoles.includes(role)

export const canEditColumn = (col: ColumnDef, role: Role) =>
  role === 'admin' || (can.writeAlumni(role) && col.editRoles.includes(role))

export const visibleColumns = (cols: ColumnDef[], role: Role) =>
  cols.filter((c) => canViewColumn(c, role)).sort((a, b) => a.order - b.order)

export const editableColumns = (cols: ColumnDef[], role: Role) =>
  visibleColumns(cols, role).filter((c) => canEditColumn(c, role))

/** Strip fields the role may not see. */
export function redactRecord(rec: AlumniRecord, cols: ColumnDef[], role: Role): AlumniRecord {
  const out: AlumniRecord = { _id: rec._id }
  for (const c of cols) if (canViewColumn(c, role) && c.key in rec) out[c.key] = rec[c.key]
  return out
}

/** Keep only fields the role may write. */
export function sanitizePatch(
  patch: Record<string, unknown>,
  cols: ColumnDef[],
  role: Role,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of cols) if (c.key in patch && canEditColumn(c, role)) out[c.key] = patch[c.key]
  return out
}
