import { createAppsScriptDataSource } from './appsScript'
import { createMockDataSource } from './mock'
import type { DataSource } from './types'

/** Set by the auth layer (Phase 2): the current Google ID token. */
let idToken: string | null = null
export const setIdToken = (t: string | null) => { idToken = t }

const url = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined
const mode = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? (url ? 'apps-script' : 'mock')

export const dataSource: DataSource =
  mode === 'apps-script' && url ? createAppsScriptDataSource(url, () => idToken) : createMockDataSource()

export type { DataSource, Session } from './types'
export { DataError } from './types'
