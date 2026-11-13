import { QueryClient, queryOptions, type QueryClient as QC } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { DataVersion } from '@/lib/schema/types'
import { dataSource, DataError } from '.'

/**
 * Caching model
 *  - Every key is scoped by the signed-in email, so one user's (role-redacted) data is never
 *    served to another user on a shared browser.
 *  - Stale-while-revalidate: persisted cache paints instantly, then we confirm via the cheap
 *    `getVersion` call and refetch only what actually changed.
 */
export const CACHE_BUSTER = 'v1'
const DAY = 24 * 60 * 60 * 1000

export const keys = {
  schema: (scope: string) => ['app', scope, 'schema'] as const,
  alumni: (scope: string) => ['app', scope, 'alumni'] as const,
  users: (scope: string) => ['app', scope, 'users'] as const,
  headers: (scope: string) => ['app', scope, 'headers'] as const,
  meta: (scope: string) => ['app', scope, 'meta'] as const,
}

const noRetryOnAuth = (count: number, err: unknown) =>
  !(err instanceof DataError && ['UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID'].includes(err.code)) && count < 2

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60_000, gcTime: DAY, retry: noRetryOnAuth, refetchOnWindowFocus: false },
  },
})

export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'alumni.query-cache',
  throttleTime: 1000,
})
export const persistOptions = {
  persister,
  maxAge: DAY,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) =>
      q.state.status === 'success' && q.queryKey[0] === 'app' && q.queryKey[2] !== 'users' && q.queryKey[2] !== 'headers',
  },
}

export const schemaQuery = (scope: string) =>
  queryOptions({ queryKey: keys.schema(scope), queryFn: () => dataSource.getSchema(), staleTime: 30 * 60_000 })

export const alumniQuery = (scope: string) =>
  queryOptions({ queryKey: keys.alumni(scope), queryFn: () => dataSource.listAlumni() })

export const usersQuery = (scope: string) =>
  queryOptions({ queryKey: keys.users(scope), queryFn: () => dataSource.listUsers(), staleTime: 0 })

export const headersQuery = (scope: string) =>
  queryOptions({ queryKey: keys.headers(scope), queryFn: () => dataSource.getSheetHeaders(), staleTime: 0 })

/** Compare server versions with what the cache was built from; invalidate only what changed. */
export async function syncVersions(qc: QC, scope: string): Promise<DataVersion> {
  const server = await dataSource.getVersion()
  const known = qc.getQueryData<DataVersion>(keys.meta(scope))
  if (!known || known.schema !== server.schema) qc.invalidateQueries({ queryKey: keys.schema(scope) })
  if (!known || known.data !== server.data) qc.invalidateQueries({ queryKey: keys.alumni(scope) })
  qc.setQueryData(keys.meta(scope), server)
  return server
}

export function clearAllCaches() {
  queryClient.clear()
  persister.removeClient()
}
