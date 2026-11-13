import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { visibleColumns } from '@/lib/auth/permissions'
import { useSession } from '@/lib/auth/useAuth'
import { useAlumni, useSchema } from '@/lib/data/hooks'
import { CellView } from './cells'
import { applyView, filterOptions, type ViewState } from './query'
import { ExportButton, ImportButton } from './ImportExport'
import { RecordSheet, type SheetMode } from './RecordSheet'

const PAGE = 25
const ALL = '__all'

function useStoredSet(key: string): [Set<string> | null, (s: Set<string>) => void] {
  const [v, setV] = useState<Set<string> | null>(() => {
    try { const r = localStorage.getItem(key); return r ? new Set(JSON.parse(r)) : null } catch { return null }
  })
  return [v, (s) => { setV(s); try { localStorage.setItem(key, JSON.stringify([...s])) } catch { /* noop */ } }]
}

export function AlumniTable() {
  const { role, scope, canWrite } = useSession()
  const schema = useSchema()
  const alumni = useAlumni()
  const [view, setView] = useState<ViewState>({ search: '', filters: {}, sort: null })
  const [page, setPage] = useState(0)
  const [mode, setMode] = useState<SheetMode>({ type: 'closed' })
  const [shown, setShown] = useStoredSet(`alumni.cols.${scope}`)

  const cols = useMemo(() => visibleColumns(schema.data?.columns ?? [], role), [schema.data, role])
  // user's own column choice wins; otherwise the admin's showInTable default. New columns follow the default.
  const tableCols = useMemo(() => cols.filter((c) => (shown ? shown.has(c.key) : c.showInTable)), [cols, shown])
  const rows = useMemo(() => applyView(alumni.data ?? [], cols, view), [alumni.data, cols, view])
  const filterCols = cols.filter((c) => c.filterable)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const safePage = Math.min(page, pages - 1)
  const pageRows = rows.slice(safePage * PAGE, safePage * PAGE + PAGE)
  const patchView = (p: Partial<ViewState>) => { setView((v) => ({ ...v, ...p })); setPage(0) }
  const anyFilter = view.search || Object.keys(view.filters).length

  // an open record follows cache refreshes (e.g. after a background sync)
  const liveMode: SheetMode = mode.type === 'view'
    ? { type: 'view', record: alumni.data?.find((r) => r._id === mode.record._id) ?? mode.record }
    : mode

  const toggleSort = (key: string) =>
    patchView({ sort: view.sort?.key !== key ? { key, dir: 'asc' } : view.sort.dir === 'asc' ? { key, dir: 'desc' } : null })

  if (schema.isPending || alumni.isPending)
    return <div className="space-y-3"><Skeleton className="h-9 w-72" /><Skeleton className="h-96 w-full" /></div>
  if (schema.isError || alumni.isError)
    return <div className="rounded-md border border-destructive/40 p-6 text-sm"><p className="font-medium text-destructive">Couldn't load the directory</p><p className="text-muted-foreground">{(schema.error ?? alumni.error)?.message}</p><Button className="mt-3" variant="outline" onClick={() => { void schema.refetch(); void alumni.refetch() }}>Retry</Button></div>
  if (!cols.length)
    return <p className="text-sm text-muted-foreground">No fields are visible to your role yet. Ask an admin to configure the column map.</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder={`Search ${cols.filter((c) => c.searchable).map((c) => c.label.toLowerCase()).slice(0, 3).join(', ')}…`} value={view.search} onChange={(e) => patchView({ search: e.target.value })} />
        </div>
        {filterCols.map((c) => {
          const items = [{ value: ALL, label: `All ${c.label}` }, ...filterOptions(alumni.data ?? [], c).map((o) => ({ value: o, label: c.type === 'boolean' ? (o === 'true' ? 'Yes' : 'No') : o }))]
          return (
            <Select key={c.key} items={items} value={view.filters[c.key] ?? ALL}
              onValueChange={(v) => { const f = { ...view.filters }; if (!v || v === ALL) delete f[c.key]; else f[c.key] = v; patchView({ filters: f }) }}>
              <SelectTrigger className="w-auto min-w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{items.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
            </Select>
          )
        })}
        {anyFilter ? <Button variant="ghost" size="sm" onClick={() => patchView({ search: '', filters: {} })}><X /> Clear</Button> : null}
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}><Columns3 /> Columns</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {cols.map((c) => (
                  <DropdownMenuCheckboxItem key={c.key} checked={tableCols.includes(c)} onCheckedChange={(on) => {
                    const next = new Set(tableCols.map((t) => t.key)); if (on) next.add(c.key); else next.delete(c.key); setShown(next)
                  }}>{c.label}</DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <ExportButton rows={rows} cols={cols} />
          {canWrite && <ImportButton cols={cols} />}
          {canWrite && <Button onClick={() => setMode({ type: 'create' })}><Plus /> Add alumnus</Button>}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {tableCols.map((c) => {
                const active = view.sort?.key === c.key
                return (
                  <TableHead key={c.key} aria-sort={active ? (view.sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sortable ? (
                      <button className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted" onClick={() => toggleSort(c.key)}>
                        {c.label}{active ? (view.sort!.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ArrowUpDown className="size-3.5 opacity-40" />}
                      </button>
                    ) : c.label}
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((r) => (
              <TableRow key={r._id} className="cursor-pointer" tabIndex={0} onClick={() => setMode({ type: 'view', record: r })} onKeyDown={(e) => e.key === 'Enter' && setMode({ type: 'view', record: r })}>
                {tableCols.map((c) => <TableCell key={c.key}><CellView col={c} value={r[c.key]} /></TableCell>)}
              </TableRow>
            ))}
            {!pageRows.length && <TableRow><TableCell colSpan={Math.max(1, tableCols.length)} className="h-24 text-center text-muted-foreground">No alumni match.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{rows.length} of {alumni.data?.length} {alumni.isFetching && '· syncing…'}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft /></Button>
          <span>Page {safePage + 1} / {pages}</span>
          <Button variant="outline" size="icon" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </div>
      <RecordSheet mode={liveMode} columns={cols} onMode={setMode} />
    </div>
  )
}
