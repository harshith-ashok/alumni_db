import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth/useAuth'
import type { Role } from '@/lib/schema/types'

export function RequireAuth() {
  const { state } = useAuth()
  const loc = useLocation()
  if (state.status === 'loading')
    return <div className="mx-auto max-w-5xl space-y-4 p-8"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>
  if (state.status === 'signedOut') return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <Outlet />
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { state } = useAuth()
  if (state.status !== 'ready') return null
  if (!roles.includes(state.session.role))
    return (
      <div className="mx-auto max-w-md p-12 text-center">
        <h2 className="text-xl font-semibold">No access</h2>
        <p className="mt-2 text-sm text-muted-foreground">Your role ({state.session.role}) can't open this page.</p>
      </div>
    )
  return <Outlet />
}
