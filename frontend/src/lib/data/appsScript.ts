import { DataError, type DataSource } from './types'

/**
 * Talks to backend/Code.gs (deployed as a Web App). Uses text/plain POST so the browser
 * treats it as a "simple request" — Apps Script cannot answer CORS preflights.
 */
export function createAppsScriptDataSource(url: string, getToken: () => string | null): DataSource {
  async function call<T>(action: string, payload?: unknown): Promise<T> {
    const token = getToken()
    if (!token) throw new DataError('UNAUTHENTICATED', 'Not signed in')
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, payload }),
      })
    } catch {
      throw new DataError('SERVER', 'Could not reach the backend. Check your connection.')
    }
    const json = (await res.json().catch(() => null)) as
      | { ok: true; data: T }
      | { ok: false; error: { code: DataError['code']; message: string } }
      | null
    if (!json) throw new DataError('SERVER', `Backend returned an unreadable response (${res.status})`)
    if (!json.ok) throw new DataError(json.error.code, json.error.message)
    return json.data
  }

  return {
    kind: 'apps-script',
    whoAmI: () => call('whoAmI'),
    getVersion: () => call('getVersion'),
    getSchema: () => call('getSchema'),
    listAlumni: () => call('listAlumni'),
    createAlumni: (values) => call('createAlumni', { values }),
    updateAlumni: (id, patch) => call('updateAlumni', { id, patch }),
    deleteAlumni: (id) => call('deleteAlumni', { id }),
    getSheetHeaders: () => call('getSheetHeaders'),
    saveSchema: (columns) => call('saveSchema', { columns }),
    listUsers: () => call('listUsers'),
    upsertUser: (user) => call('upsertUser', { user }),
    removeUser: (email) => call('removeUser', { email }),
    clearServerCache: () => call('clearCache'),
  }
}
