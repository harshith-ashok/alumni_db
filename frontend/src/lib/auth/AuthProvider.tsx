import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearAllCaches, queryClient } from '@/lib/data/queries'
import { dataSource, DataError, setIdToken } from '@/lib/data'
import { mockIdentity } from '@/lib/data/mock'
import { AuthContext, type AuthState } from './authContext'

const TOKEN_KEY = 'alumni.idtoken'
const mode = dataSource.kind === 'mock' ? 'mock' : 'google'

function tokenExpiry(jwt: string): number {
  try {
    return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000
  } catch {
    return 0
  }
}
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null } }
const writeToken = (t: string | null) => {
  try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY) } catch { /* noop */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const t = mode === 'mock' ? mockIdentity.get() : readToken()
    const live = mode === 'mock' ? !!t : !!t && tokenExpiry(t) > Date.now() + 30_000
    return live ? { status: 'loading' } : { status: 'signedOut' }
  })

  const resolve = useCallback(() =>
    dataSource.whoAmI().then(
      (session) => setState({ status: 'ready', session }),
      (e) => {
        mockIdentity.set(null); writeToken(null); setIdToken(null)
        setState({ status: 'signedOut', error: e instanceof DataError && e.code === 'FORBIDDEN' ? e.message : undefined })
      },
    ), [])

  // restore a previous session (state was initialised to 'loading' only if one exists)
  useEffect(() => {
    const t = readToken()
    if (mode === 'google' && t) setIdToken(t)
    if (state.status === 'loading') void resolve()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  const signOut = useCallback((reason?: string) => {
    mockIdentity.set(null); writeToken(null); setIdToken(null)
    clearAllCaches() // never leave another role's data in the persisted cache
    setState({ status: 'signedOut', error: reason })
  }, [])

  // an expired/invalid token anywhere ends the session
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((ev) => {
      const err = ev.type === 'updated' && ev.action.type === 'error' ? ev.action.error : null
      if (err instanceof DataError && err.code === 'UNAUTHENTICATED') signOut('Your session expired. Please sign in again.')
    })
  }, [signOut])

  const value = useMemo(
    () => ({
      state,
      mode: mode as 'mock' | 'google',
      async signInMock(email: string) { mockIdentity.set(email); setState({ status: 'loading' }); await resolve() },
      async signInGoogle(idToken: string) { writeToken(idToken); setIdToken(idToken); setState({ status: 'loading' }); await resolve() },
      signOut,
    }),
    [state, resolve, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
