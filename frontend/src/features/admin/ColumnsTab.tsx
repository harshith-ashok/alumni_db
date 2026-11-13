import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAdminMutations, useSchema, useSheetHeaders } from '@/lib/data/hooks'
import { diffHeaders, inferColumnDef, normHeader } from '@/lib/schema/mapping'
import { COLUMN_TYPES, type ColumnDef, type Role } from '@/lib/schema/types'

const FLAGS: { k: 'showInTable' | 'filterable' | 'searchable' | 'sortable' | 'required'; label: string }[] = [
  { k: 'showInTable', label: 'Show in table' },
  { k: 'searchable', label: 'Searchable' },
  { k: 'filterable', label: 'Filter dropdown' },
  { k: 'sortable', label: 'Sortable' },
  { k: 'required', label: 'Required' },
]
const NON_ADMIN: Exclude<Role, 'admin'>[] = ['viewer', 'editor']
const withOptions = (t: ColumnDef['type']) => t === 'select' || t === 'multiselect'

export function ColumnsTab() {
  const schema = useSchema()
  const headers = useSheetHeaders()
  if (schema.isPending || headers.isPending) return <p className="text-sm text-muted-foreground">Loading column map…</p>
  if (schema.isError || headers.isError) return <p className="text-sm text-destructive">{(schema.error ?? headers.error)?.message}</p>
  // remount the editor whenever the saved version changes so the draft resets cleanly
  return <Editor key={schema.data.version} initial={schema.data.columns} headers={headers.data.headers} samples={headers.data.samples} onRefreshHeaders={() => void headers.refetch()} />
}

function Editor({ initial, headers, samples, onRefreshHeaders }: { initial: ColumnDef[]; headers: string[]; samples: Record<string, (string | number | boolean | null)[]>; onRefreshHeaders: () => void }) {
  const { saveSchema } = useAdminMutations()
  const [cols, setCols] = useState<ColumnDef[]>(() => [...initial].sort((a, b) => a.order - b.order))
  const [open, setOpen] = useState<string | null>(null)
  const dirty = JSON.stringify(cols) !== JSON.stringify([...initial].sort((a, b) => a.order - b.order))
  const diff = useMemo(() => diffHeaders(headers, cols), [headers, cols])
  const patch = (key: string, p: Partial<ColumnDef>) => setCols((cs) => cs.map((c) => (c.key === key ? { ...c, ...p } : c)))
  const move = (i: number, d: -1 | 1) => setCols((cs) => { const n = [...cs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n })

  const dupHeaders = new Set(cols.map((c) => normHeader(c.header)).filter((h, i, a) => a.indexOf(h) !== i))
  const invalid = cols.some((c) => !c.label.trim() || !c.header.trim()) || dupHeaders.size > 0 || cols.length === 0
  const primaryCount = cols.filter((c) => c.primary).length

  const addHeader = (h: string) => setCols((cs) => [...cs, inferColumnDef(h, samples[h] ?? [], cs)])
  const save = () =>
    saveSchema.mutate(cols.map((c, i) => ({ ...c, order: i + 1, options: withOptions(c.type) ? c.options ?? [] : undefined })), {
      onSuccess: () => toast.success('Column map saved — the UI has been updated'),
      onError: (e) => toast.error(e.message),
    })

  return (
    <div className="space-y-4 pb-2">
      {(diff.newHeaders.length > 0 || diff.missing.length > 0) && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>The sheet and the column map are out of sync</AlertTitle>
          <AlertDescription className="space-y-2">
            {diff.newHeaders.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span>New in sheet:</span>
                {diff.newHeaders.map((h) => <Button key={h} size="sm" variant="outline" onClick={() => addHeader(h)}><Plus /> {h}</Button>)}
                <Button size="sm" onClick={() => diff.newHeaders.forEach(addHeader)}>Add all</Button>
              </div>
            )}
            {diff.missing.length > 0 && (
              <p>Not found in sheet: {diff.missing.map((c) => <Badge key={c.key} variant="destructive" className="mr-1">{c.header}</Badge>)} — open the field and re-map it to the renamed column, or remove it.</p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {cols.map((c, i) => {
          const missing = diff.missing.some((m) => m.key === c.key)
          const isOpen = open === c.key
          const headerItems = [...new Set([...headers, c.header])].map((h) => ({ value: h, label: headers.includes(h) ? h : `${h} (not in sheet)` }))
          return (
            <Card key={c.key} className={missing || dupHeaders.has(normHeader(c.header)) ? 'border-destructive/60' : ''}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <Button variant="ghost" size="icon" aria-label={isOpen ? 'Collapse' : 'Expand'} onClick={() => setOpen(isOpen ? null : c.key)}>{isOpen ? <ChevronDown /> : <ChevronRight />}</Button>
                <div className="min-w-32 flex-1">
                  <Input aria-label="Display label" value={c.label} onChange={(e) => patch(c.key, { label: e.target.value })} />
                </div>
                <div className="w-56">
                  <Select items={headerItems} value={c.header} onValueChange={(v) => v && patch(c.key, { header: v })}>
                    <SelectTrigger className="w-full" aria-label="Sheet column"><SelectValue /></SelectTrigger>
                    <SelectContent>{headerItems.map((h) => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="w-36">
                  <Select value={c.type} onValueChange={(v) => v && patch(c.key, { type: v as ColumnDef['type'] })}>
                    <SelectTrigger className="w-full" aria-label="Type"><SelectValue /></SelectTrigger>
                    <SelectContent>{COLUMN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp /></Button>
                <Button variant="ghost" size="icon" disabled={i === cols.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setCols((cs) => cs.filter((x) => x.key !== c.key))} aria-label="Remove field"><Trash2 /></Button>
              </div>
              {isOpen && (
                <div className="grid gap-5 border-t px-4 py-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Behaviour</p>
                    {FLAGS.map((f) => (
                      <label key={f.k} className="flex items-center justify-between text-sm">{f.label}<Switch checked={!!c[f.k]} onCheckedChange={(v) => patch(c.key, { [f.k]: v })} /></label>
                    ))}
                    <label className="flex items-center justify-between text-sm">Title field<Switch checked={!!c.primary} onCheckedChange={(v) => setCols((cs) => cs.map((x) => ({ ...x, primary: x.key === c.key ? v : v ? false : x.primary })))} /></label>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Access (admins always have access)</p>
                    {(['viewRoles', 'editRoles'] as const).map((k) => (
                      <div key={k} className="space-y-1">
                        <p className="text-sm">{k === 'viewRoles' ? 'Can view' : 'Can edit'}</p>
                        <div className="flex gap-4">
                          {NON_ADMIN.map((r) => (
                            <label key={r} className="flex items-center gap-2 text-sm capitalize">
                              <Checkbox checked={c[k].includes(r)} onCheckedChange={(on) => {
                                const set = new Set(c[k]); if (on) set.add(r); else set.delete(r)
                                const p: Partial<ColumnDef> = { [k]: [...set] }
                                if (k === 'editRoles' && on && !c.viewRoles.includes(r)) p.viewRoles = [...c.viewRoles, r] // can't edit what you can't see
                                if (k === 'viewRoles' && !on) p.editRoles = c.editRoles.filter((x) => x !== r)
                                patch(c.key, p)
                              }} /> {r}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`opt-${c.key}`} className="text-xs text-muted-foreground">Options (comma separated)</Label>
                    <Input id={`opt-${c.key}`} disabled={!withOptions(c.type)} placeholder={withOptions(c.type) ? 'e.g. B.Tech, M.Tech' : 'Only for select types'}
                      defaultValue={(c.options ?? []).join(', ')} key={`${c.key}-${c.type}`}
                      onChange={(e) => patch(c.key, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                    <p className="text-xs text-muted-foreground">Internal key: <code>{c.key}</code></p>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="sticky bottom-4 flex items-center justify-between rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {dupHeaders.size > 0 ? <span className="text-destructive">Two fields map to the same sheet column.</span> : primaryCount === 0 ? 'Tip: mark one field as the title field.' : dirty ? 'Unsaved changes' : 'All changes saved'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefreshHeaders}>Re-scan sheet</Button>
          <Button variant="ghost" disabled={!dirty} onClick={() => setCols([...initial].sort((a, b) => a.order - b.order))}>Discard</Button>
          <Button disabled={!dirty || invalid || saveSchema.isPending} onClick={save}>{saveSchema.isPending ? 'Saving…' : 'Save column map'}</Button>
        </div>
      </div>
    </div>
  )
}
