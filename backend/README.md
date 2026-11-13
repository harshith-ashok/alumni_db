# Backend (Google Apps Script)

1. Create a Google Sheet. Rename the first tab to **Alumni** and put your column names in row 1
   (any names — the admin dashboard maps them).
2. **Extensions → Apps Script.** Paste `Code.gs`; enable *Show appsscript.json* in Project Settings and paste `appsscript.json`.
3. **Project Settings → Script properties:**
   - `GOOGLE_CLIENT_ID` — OAuth *Web* client id (Google Cloud Console → Credentials; add your site origin, e.g. `http://localhost:5173`, to Authorized JavaScript origins)
   - `BOOTSTRAP_ADMIN` — your Google email (becomes the first admin)
4. Run `setup()` once (authorise). It creates `_Users` / `_Config` and infers a starter column map.
5. **Triggers → Add trigger:** function `onEdit`, event *From spreadsheet → On edit* (so manual sheet edits invalidate caches).
6. **Deploy → New deployment → Web app**, execute as *Me*, access *Anyone*. Copy the `/exec` URL.
7. In `frontend/.env.local`:
   ```
   VITE_DATA_SOURCE=apps-script
   VITE_APPS_SCRIPT_URL=<exec url>
   VITE_GOOGLE_CLIENT_ID=<client id>
   ```
Re-deploy (new version) after every `Code.gs` change.
