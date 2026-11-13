import { createContext } from 'react'
import type { Session } from '@/lib/data'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; error?: string }
  | { status: 'ready'; session: Session }

export interface AuthContextValue {
  state: AuthState
  mode: 'mock' | 'google'
  signInMock(email: string): Promise<void>
  signInGoogle(idToken: string): Promise<void>
  signOut(reason?: string): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
