import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { Database, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/lib/auth/useAuth'
import { dataSource } from '@/lib/data'
import { useAdminMutations } from '@/lib/data/hooks'
import { mockSheet } from '@/lib/data/mock'
import { clearAllCaches, keys } from '@/lib/data/queries'
import type { DataVersion } from '@/lib/schema/types'

export function SyncTab() {
  const qc = useQueryClient()
  const { scope } = useSession()
  const { clearServerCache } = useAdminMutations()
  const busy = useIsFetching() > 0
  const meta = qc.getQueryData<DataVersion>(keys.meta(scope))
  const refetchAll = () => { void qc.invalidateQueries({ queryKey: ['app', scope] }); toast.success('Refreshing from the sheet…') }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Caching</CardTitle><CardDescription>The Google Sheet is the source of truth; everything else is a cache.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Source: <b>{dataSource.kind === 'mock' ? 'Demo (in-browser mock sheet)' : 'Google Sheet via Apps Script'}</b></p>
          <p>Versions seen: schema <b>{meta?.schema ?? '—'}</b>, data <b>{meta?.data ?? '—'}</b></p>
          <p className="text-muted-foreground">Clients check the version every minute and on tab focus; data is only re-downloaded when it changed.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={refetchAll}><RefreshCw className={busy ? 'animate-spin' : ''} /> Refresh from sheet</Button>
            <Button variant="outline" onClick={() => { clearAllCaches(); toast.success('Local cache cleared'); window.location.reload() }}><Trash2 /> Clear my local cache</Button>
            <Button variant="outline" disabled={clearServerCache.isPending} onClick={() => clearServerCache.mutate(undefined, { onSuccess: () => toast.success('Server cache cleared — all clients will refetch') })}><Database /> Clear server cache</Button>
          </div>
        </CardContent>
      </Card>
      {dataSource.kind === 'mock' && (
        <Card>
          <CardHeader><CardTitle>Simulate sheet edits</CardTitle><CardDescription>Demo mode only. Pretend someone edited the headers in Google Sheets, then use the Columns tab to re-map.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { mockSheet.renameHeader('City', 'Location'); toast.info('Renamed sheet header City → Location') }}>Rename "City" → "Location"</Button>
            <Button variant="outline" onClick={() => { mockSheet.addColumn('Batch Code', (i) => `B${2008 + (i % 17)}`); toast.info('Added sheet column "Batch Code"') }}>Add column "Batch Code"</Button>
            <Button variant="ghost" onClick={() => { mockSheet.reset(); clearAllCaches(); window.location.reload() }}>Reset demo data</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
