import { z } from 'zod'
import type { ColumnDef } from './types'

/** Build a zod schema for the create/edit form from the live column map. */
export function buildRecordSchema(cols: ColumnDef[]) {
  const shape: Record<string, z.ZodType> = {}
  for (const c of cols) {
    let s: z.ZodType
    switch (c.type) {
      case 'email':
        s = z.email('Invalid email')
        break
      case 'url':
        s = z.url('Invalid URL')
        break
      case 'number':
        s = z.number('Must be a number')
        break
      case 'boolean':
        s = z.boolean()
        break
      case 'multiselect':
        s = z.array(z.string())
        break
      case 'select':
        s = c.options?.length ? z.enum(c.options as [string, ...string[]]) : z.string()
        break
      default:
        s = z.string()
    }
    if (c.type === 'boolean') {
      shape[c.key] = s
    } else if (c.required) {
      shape[c.key] =
        c.type === 'multiselect'
          ? (s as z.ZodArray<z.ZodString>).min(1, `${c.label} is required`)
          : ['number', 'select', 'email', 'url'].includes(c.type)
            ? s
            : z.string().min(1, `${c.label} is required`)
    } else {
      shape[c.key] = s.nullable().optional()
    }
  }
  return z.object(shape)
}

/** Server-side value check (used by the mock backend; Code.gs mirrors it). Returns an error message or null. */
export function checkValue(c: ColumnDef, v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  switch (c.type) {
    case 'email': return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : `${c.label} must be a valid email`
    case 'url': return /^https?:\/\/\S+$/i.test(String(v)) ? null : `${c.label} must be a http(s) URL`
    case 'number': return Number.isFinite(Number(v)) ? null : `${c.label} must be a number`
    case 'select': return !c.options?.length || c.options.includes(String(v)) ? null : `${c.label}: "${v}" is not an allowed option`
    case 'multiselect': return Array.isArray(v) && (!c.options?.length || v.every((x) => c.options!.includes(String(x)))) ? null : `${c.label} has an invalid option`
    default: return null
  }
}
