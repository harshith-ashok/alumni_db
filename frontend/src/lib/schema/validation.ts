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
          : s
    } else {
      shape[c.key] = s.nullable().optional()
    }
  }
  return z.object(shape)
}
