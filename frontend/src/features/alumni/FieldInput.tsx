import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { CellValue, ColumnDef } from '@/lib/schema/types'

interface Props {
  col: ColumnDef
  value: CellValue | undefined
  onChange: (v: CellValue) => void
  id: string
  invalid?: boolean
}

/** Picks the right control for a column type. */
export function FieldInput({ col, value, onChange, id, invalid }: Props) {
  const common = { id, 'aria-invalid': invalid || undefined }
  switch (col.type) {
    case 'boolean':
      return <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
    case 'longtext':
      return <Textarea {...common} rows={4} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'number':
      return (
        <Input {...common} type="number" inputMode="decimal" value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
      )
    case 'date':
      return <Input {...common} type="date" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
    case 'select': {
      const items = (col.options ?? []).map((o) => ({ value: o, label: o }))
      return (
        <Select items={items} value={(value as string) ?? null} onValueChange={(v) => onChange(v as string | null)}>
          <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
        </Select>
      )
    }
    case 'multiselect': {
      const cur = Array.isArray(value) ? value : []
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border p-3" id={id}>
          {(col.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <Checkbox checked={cur.includes(o)} onCheckedChange={(c) => onChange(c ? [...cur, o] : cur.filter((x) => x !== o))} /> {o}
            </label>
          ))}
          {!col.options?.length && <span className="text-sm text-muted-foreground">No options configured for this field.</span>}
        </div>
      )
    }
    default:
      return (
        <Input {...common} type={col.type === 'email' ? 'email' : col.type === 'url' ? 'url' : col.type === 'phone' ? 'tel' : 'text'}
          value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />
      )
  }
}
