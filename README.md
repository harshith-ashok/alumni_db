# Alumni Database Manager

React + Vite + shadcn/ui front end with **Google Sheets as the database**, a **schema-driven UI**
(columns come from an admin-editable column map) and **role-based access** (viewer / editor / admin).

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and phase plan.

## Run it (demo mode — no Google setup)
```bash
cd frontend && npm install && npm run dev
```
Pick a demo role on the login screen. Data lives in your browser's localStorage and behaves like a
sheet (rows keyed by header text), so you can try the re-mapping flow: Admin → *Sync & cache* →
"Rename City → Location", then Admin → *Columns* and re-map the City field.

## Connect a real Google Sheet
Follow [backend/README.md](backend/README.md), then set `frontend/.env.local`
(see `frontend/.env.example`).

## What's where
| Area | Path |
|---|---|
| Column map, mapping, validation | `frontend/src/lib/schema/` |
| RBAC rules (mirrored in `backend/Code.gs`) | `frontend/src/lib/auth/permissions.ts` |
| Data sources (mock / Apps Script) + cache | `frontend/src/lib/data/` |
| Directory UI | `frontend/src/features/alumni/` |
| Admin dashboard | `frontend/src/features/admin/` |
| Backend (Apps Script web app) | `backend/Code.gs` |

## Scripts (in `frontend/`)
`npm run dev` · `npm run build` · `npm test` · `npm run lint`

## Security notes
- The sheet is never exposed to the browser; the Apps Script runs as the owner and re-checks the
  caller's Google ID token, role, field-level access and value validity on every request.
- Cached data is scoped per user and wiped on sign-out.
- CSV export only includes fields the caller's role can view and neutralises spreadsheet formulas.
