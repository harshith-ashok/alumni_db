import { useContext } from 'react'
import { AuthContext } from './authContext'
import { can } from './permissions'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

/** For screens that only render when signed in. */
export function useSession() {
  const { state } = useAuth()
  if (state.status !== 'ready') throw new Error('useSession outside an authenticated route')
  const { session } = state
  return {
    ...session,
    /** Cache scope: keeps each user's role-redacted data separate. */
    scope: session.email.toLowerCase(),
    canWrite: can.writeAlumni(session.role),
    isAdmin: session.role === 'admin',
  }
}
