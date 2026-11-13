import type { ColumnDef, SchemaConfig } from './types'

const base = {
  showInTable: true,
  filterable: false,
  searchable: false,
  sortable: true,
  viewRoles: ['viewer', 'editor'],
  editRoles: ['editor'],
} satisfies Partial<ColumnDef>

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { ...base, key: 'full_name', header: 'Full Name', label: 'Full Name', type: 'text', order: 1, required: true, primary: true, searchable: true },
  { ...base, key: 'email', header: 'Email', label: 'Email', type: 'email', order: 2, required: true, searchable: true },
  { ...base, key: 'phone', header: 'Phone', label: 'Phone', type: 'phone', order: 3, showInTable: false, viewRoles: ['editor'], editRoles: ['editor'] },
  { ...base, key: 'graduation_year', header: 'Graduation Year', label: 'Grad Year', type: 'number', order: 4, required: true, filterable: true },
  { ...base, key: 'degree', header: 'Degree', label: 'Degree', type: 'select', options: ['B.Tech', 'M.Tech', 'MBA', 'B.Sc', 'M.Sc', 'PhD'], order: 5, filterable: true },
  { ...base, key: 'department', header: 'Department', label: 'Department', type: 'select', options: ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Management', 'Physics'], order: 6, filterable: true },
  { ...base, key: 'company', header: 'Current Company', label: 'Company', type: 'text', order: 7, searchable: true },
  { ...base, key: 'job_title', header: 'Job Title', label: 'Job Title', type: 'text', order: 8, searchable: true },
  { ...base, key: 'city', header: 'City', label: 'City', type: 'text', order: 9, filterable: true, searchable: true },
  { ...base, key: 'linkedin', header: 'LinkedIn', label: 'LinkedIn', type: 'url', order: 10, showInTable: false, sortable: false },
  { ...base, key: 'mentor', header: 'Willing to Mentor', label: 'Mentor?', type: 'boolean', order: 11, filterable: true },
  { ...base, key: 'skills', header: 'Skills', label: 'Skills', type: 'multiselect', options: ['React', 'Python', 'Data', 'Cloud', 'Finance', 'Design', 'Research'], order: 12, showInTable: false, sortable: false, filterable: true },
  { ...base, key: 'notes', header: 'Notes', label: 'Internal Notes', type: 'longtext', order: 13, showInTable: false, sortable: false, searchable: true, viewRoles: ['editor'], editRoles: ['editor'] },
]

export const DEFAULT_SCHEMA: SchemaConfig = { version: 1, columns: DEFAULT_COLUMNS }
