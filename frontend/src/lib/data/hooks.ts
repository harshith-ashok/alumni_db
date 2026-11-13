import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSession } from '@/lib/auth/useAuth'
import type { AlumniRecord, AppUser, CellValue, DataVersion, SchemaConfig } from '@/lib/schema/types'
import { dataSource } from '.'
import { alumniQuery, headersQuery, keys, schemaQuery, syncVersions, usersQuery } from './queries'

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

// ---- mutations (optimistic, rolled back on error, confirmed by a background refetch) ----

type Values = Record<string, CellValue>

export function useAlumniMutations() {
  const qc = useQueryClient()
  const { scope } = useSession()
  const key = keys.alumni(scope)

  const optimistic = async (apply: (rows: AlumniRecord[]) => AlumniRecord[]) => {
    await qc.cancelQueries({ queryKey: key })
    const prev = qc.getQueryData<AlumniRecord[]>(key)
    qc.setQueryData<AlumniRecord[]>(key, (rows) => apply(rows ?? []))
    return { prev }
  }
  const rollback = (_e: unknown, _v: unknown, ctx?: { prev?: AlumniRecord[] }) => {
    if (ctx?.prev) qc.setQueryData(key, ctx.prev)
  }
  const settle = (version?: DataVersion) => {
    if (version) qc.setQueryData(keys.meta(scope), version)
    void qc.invalidateQueries({ queryKey: key })
  }

  const create = useMutation({
    mutationFn: (values: Values) => dataSource.createAlumni(values),
    onMutate: (values) => optimistic((rows) => [{ ...values, _id: `tmp-${Date.now()}` } as AlumniRecord, ...rows]),
    onError: rollback,
    onSuccess: (r) => settle(r.version),
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Values }) => dataSource.updateAlumni(id, patch),
    onMutate: ({ id, patch }) => optimistic((rows) => rows.map((r) => (r._id === id ? { ...r, ...patch } : r))),
    onError: rollback,
    onSuccess: (r) => settle(r.version),
  })
  const remove = useMutation({
    mutationFn: (id: string) => dataSource.deleteAlumni(id),
    onMutate: (id) => optimistic((rows) => rows.filter((r) => r._id !== id)),
    onError: rollback,
    onSuccess: (r) => settle(r.version),
  })
  return { create, update, remove }
}

// ---- admin ----

export const useSheetHeaders = () => useQuery(headersQuery(useSession().scope))
export const useUsers = () => useQuery(usersQuery(useSession().scope))

export function useAdminMutations() {
  const qc = useQueryClient()
  const { scope } = useSession()
  const setUsers = (users: AppUser[]) => qc.setQueryData(keys.users(scope), users)
  return {
    saveSchema: useMutation({
      mutationFn: (columns: SchemaConfig['columns']) => dataSource.saveSchema(columns),
      onSuccess: (cfg) => {
        qc.setQueryData(keys.schema(scope), cfg)
        // re-mapping changes which sheet column feeds which field, so records must be re-read
        void qc.invalidateQueries({ queryKey: keys.alumni(scope) })
        void qc.invalidateQueries({ queryKey: keys.meta(scope) })
      },
    }),
    upsertUser: useMutation({ mutationFn: (u: AppUser) => dataSource.upsertUser(u), onSuccess: setUsers }),
    removeUser: useMutation({ mutationFn: (email: string) => dataSource.removeUser(email), onSuccess: setUsers }),
    clearServerCache: useMutation({
      mutationFn: () => dataSource.clearServerCache(),
      onSuccess: () => { void qc.invalidateQueries({ queryKey: ['app', scope] }) },
    }),
  }
}
