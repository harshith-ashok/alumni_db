import { Check, ExternalLink, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CellValue, ColumnDef } from '@/lib/schema/types'

/** Renders any cell according to its column type. */
export function CellView({ col, value }: { col: ColumnDef; value: CellValue | undefined }) {
  const empty = value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)
  if (col.type === 'boolean') return value ? <Check className="size-4 text-emerald-600" aria-label="Yes" /> : <Minus className="size-4 text-muted-foreground" aria-label="No" />
  if (empty) return <span className="text-muted-foreground">—</span>
  switch (col.type) {
    case 'email':
      return <a className="underline-offset-2 hover:underline" href={`mailto:${value}`} onClick={(e) => e.stopPropagation()}>{String(value)}</a>
    case 'phone':
      return <a className="underline-offset-2 hover:underline" href={`tel:${value}`} onClick={(e) => e.stopPropagation()}>{String(value)}</a>
    case 'url':
      return (
        <a className="inline-flex items-center gap-1 underline-offset-2 hover:underline" href={String(value)} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
          {String(value).replace(/^https?:\/\/(www\.)?/, '').slice(0, 28)} <ExternalLink className="size-3" />
        </a>
      )
    case 'multiselect':
      return <span className="flex flex-wrap gap-1">{(value as string[]).map((v) => <Badge key={v} variant="secondary">{v}</Badge>)}</span>
    case 'select':
      return <Badge variant="outline">{String(value)}</Badge>
    case 'longtext':
      return <span className="whitespace-pre-wrap">{String(value)}</span>
    default:
      return <>{String(value)}</>
  }
}
