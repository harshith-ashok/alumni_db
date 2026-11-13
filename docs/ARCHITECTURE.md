# Alumni Database Manager — Architecture

## Goals
- React (Vite + TS) + shadcn/ui front end.
- **Google Sheet is the system of record.** Everything else is a cache.
- **Schema-driven UI:** table columns, forms, filters, detail views are all generated from a
  column map. Rename / re-map / hide a column in the Admin dashboard and the UI follows.
- **Role-based access** enforced server-side (and mirrored in the UI).

## System overview
```
 React SPA (Vite)                       Google Apps Script web app          Google Sheet
┌──────────────────────┐  HTTPS+ID token ┌──────────────────────────┐      ┌────────────┐
│ TanStack Query cache │ ───────────────▶│ verify token → role      │ ───▶ │ Alumni     │ data
│ (persisted, SWR)     │ ◀───────────────│ RBAC + field-level perms │ ◀─── │ _Config    │ column map
│ Schema-driven UI     │                 │ CacheService (versioned) │      │ _Users     │ email → role
└──────────────────────┘                 └──────────────────────────┘      └────────────┘
        │  VITE_DATA_SOURCE=mock → in-browser adapter (localStorage), same interface
```
Why Apps Script: a browser cannot enforce RBAC on a Sheet by itself (any client-side
credential is user-readable). A script bound to the sheet runs as the owner, so the sheet
can stay private; users only ever hold a Google ID token.

## Data model (sheet tabs)
| Tab | Purpose |
|---|---|
| `Alumni` | Row 1 = headers (free to rename/reorder). One row per alumnus. Hidden `_id` column is stable row identity. |
| `_Config` | Single JSON cell: the **column map** (see below) + version counter. |
| `_Users` | `email, name, role, active`. |

### Column map (the heart of the dynamic UI)
```ts
ColumnDef { header: string      // exact sheet header (the mapping target)
            key: string         // stable internal key
            label: string       // display name
            type: text|longtext|email|phone|url|number|date|select|multiselect|boolean
            options?: string[]  // select types
            order: number; required; unique?
            showInTable; filterable; searchable; sortable
            viewRoles: Role[]; editRoles: Role[]   // field-level access
            primary?: boolean   // title field in cards / detail }
```
Re-mapping = changing `header` of a def. "Sync headers" diffs the live sheet headers against the
map and proposes: new columns (auto-defs inferred from sample values), missing columns (flag).

## Roles
| Role | Can |
|---|---|
| `viewer` | Read alumni (only fields whose `viewRoles` include viewer) |
| `editor` | + create / edit / delete alumni (fields per `editRoles`), import/export |
| `admin` | + edit column map, manage users/roles, clear caches |
Authoritative check on the server; client uses the same pure `permissions` module for UX only.

## Caching strategy
1. **Client:** TanStack Query, stale-while-revalidate, persisted to localStorage (per-user key,
   buster = schema version). App opens instantly from cache, then revalidates.
2. **Version stamp:** a cheap `getVersion` call (schema + data version). Full refetch only when changed.
3. **Server:** Apps Script `CacheService` holds parsed sheet rows + config; invalidated on every write.
4. Optimistic updates on edit/create/delete with rollback.

## Phases
| # | Phase | Deliverable |
|---|---|---|
| 0 | Foundations | Tailwind v4, shadcn, aliases, structure, this doc |
| 1 | Data layer | Types, column-map model, `DataSource` interface, mock adapter, Apps Script adapter, persisted query cache |
| 2 | Auth + RBAC | Google sign-in (+ mock login), permission module, route guards, app shell, Apps Script backend |
| 3 | Dynamic alumni UI | Schema-driven table (search/sort/filter/paginate/column visibility), create/edit/detail form, delete |
| 4 | Admin dashboard | Column-map editor, header sync/re-map, user & role management, cache controls |
| 5 | Polish | CSV import/export, audit log, docs, setup guide |

## Folder layout (frontend/src)
```
lib/schema/    ColumnDef types, zod builders, header-sync
lib/data/      DataSource interface, mock + apps-script adapters, cache config
lib/auth/      auth context, permissions
features/      alumni/, admin/, auth/
components/ui  shadcn primitives
```
