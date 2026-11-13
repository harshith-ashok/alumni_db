import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSession } from '@/lib/auth/useAuth'
import { alumniQuery, schemaQuery, syncVersions } from './queries'

export const useSchema = () => useQuery(schemaQuery(useSession().scope))
export const useAlumni = () => useQuery(alumniQuery(useSession().scope))

/** Revalidate against the server version on mount, on tab focus, and every minute. */
export function useVersionSync() {
  const qc = useQueryClient()
  const { scope } = useSession()
  useEffect(() => {
    const run = () => { syncVersions(qc, scope).catch(() => { /* offline: keep serving cache */ }) }
    run()
    const t = setInterval(run, 60_000)
    const onVis = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [qc, scope])
}
