import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { editableColumns } from '@/lib/auth/permissions'
import { useSession } from '@/lib/auth/useAuth'
import { dataSource } from '@/lib/data'
import { keys } from '@/lib/data/queries'
import type { AlumniRecord, ColumnDef } from '@/lib/schema/types'
import { useQueryClient } from '@tanstack/react-query'
import { parseCsv, planImport, toCsv, type ImportPlan } from './csv'

const MAX_ROWS = 200

export function ExportButton({ rows, cols }: { rows: AlumniRecord[]; cols: ColumnDef[] }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv(rows, cols)], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `alumni-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click(); URL.revokeObjectURL(url)
  }
  return <Button variant="outline" onClick={download}><Download /> Export CSV</Button>
}

export function ImportButton({ cols }: { cols: ColumnDef[] }) {
  const { role, scope } = useSession()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  const onFile = async (f: File) => {
    const p = planImport(parseCsv(await f.text()), editableColumns(cols, role))
    if (!p.records.length || !p.matched.length) return toast.error('No importable rows found. Check that the header row matches your field names.')
    if (p.records.length > MAX_ROWS) return toast.error(`Import is limited to ${MAX_ROWS} rows at a time.`)
    setPlan(p)
  }
  const run = async () => {
    if (!plan) return
    let ok = 0; const failed: string[] = []
    for (const [i, rec] of plan.records.entries()) {
      setProgress(i)
      try { await dataSource.createAlumni(rec); ok++ } catch (e) { failed.push(`Row ${i + 2}: ${e instanceof Error ? e.message : 'failed'}`) }
    }
    setProgress(null); setPlan(null)
    void qc.invalidateQueries({ queryKey: keys.alumni(scope) })
    if (failed.length) toast.warning(`Imported ${ok}, skipped ${failed.length}. ${failed.slice(0, 3).join(' · ')}`)
    else toast.success(`Imported ${ok} alumni`)
  }
  return (
    <>
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
      <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Import CSV</Button>
      <Dialog open={!!plan} onOpenChange={(o) => !o && progress === null && setPlan(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import {plan?.records.length} rows</DialogTitle><DialogDescription>Rows are appended to the sheet; nothing existing is changed.</DialogDescription></DialogHeader>
          <div className="space-y-2 text-sm">
            <p><b>Matched:</b> {plan?.matched.map((m) => m.col.label).join(', ')}</p>
            {!!plan?.unmatched.length && <p className="text-muted-foreground"><b>Ignored</b> (no matching field you can edit): {plan.unmatched.join(', ')}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={progress !== null} onClick={() => setPlan(null)}>Cancel</Button>
            <Button disabled={progress !== null} onClick={() => void run()}>{progress !== null ? `Importing ${progress + 1}/${plan?.records.length}…` : 'Import'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
