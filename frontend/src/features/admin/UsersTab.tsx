import { Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useSession } from '@/lib/auth/useAuth'
import { useAdminMutations, useUsers } from '@/lib/data/hooks'
import { ROLES, type AppUser, type Role } from '@/lib/schema/types'

const err = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed')

export function UsersTab() {
  const users = useUsers()
  const me = useSession()
  const { upsertUser, removeUser } = useAdminMutations()
  const [draft, setDraft] = useState<AppUser>({ email: '', name: '', role: 'viewer', active: true })
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email)

  if (users.isPending) return <p className="text-sm text-muted-foreground">Loading users…</p>
  if (users.isError) return <p className="text-sm text-destructive">{users.error.message}</p>
  const roleSelect = (value: Role, onChange: (r: Role) => void, label: string) => (
    <Select value={value} onValueChange={(v) => v && onChange(v as Role)}>
      <SelectTrigger className="w-32 capitalize" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
    </Select>
  )
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); upsertUser.mutate(draft, { onSuccess: () => { toast.success('User saved'); setDraft({ ...draft, email: '', name: '' }) }, onError: err }) }}>
        <Input className="w-64" type="email" placeholder="Google account email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
        <Input className="w-48" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        {roleSelect(draft.role, (role) => setDraft({ ...draft, role }), 'New user role')}
        <Button type="submit" disabled={!emailOk || upsertUser.isPending}><UserPlus /> Add user</Button>
      </form>
      <div className="rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Active</TableHead><TableHead className="w-12" /></TableRow></TableHeader>
          <TableBody>
            {users.data.map((u) => {
              const self = u.email.toLowerCase() === me.email.toLowerCase()
              return (
                <TableRow key={u.email}>
                  <TableCell><div>{u.name || '—'}{self && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</div><div className="text-xs text-muted-foreground">{u.email}</div></TableCell>
                  <TableCell>{roleSelect(u.role, (role) => upsertUser.mutate({ ...u, role }, { onError: err }), `Role for ${u.email}`)}</TableCell>
                  <TableCell><Switch checked={u.active} disabled={self} onCheckedChange={(active) => upsertUser.mutate({ ...u, active }, { onError: err })} aria-label={`Active: ${u.email}`} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" disabled={self} className="text-destructive" aria-label={`Remove ${u.email}`} onClick={() => removeUser.mutate(u.email, { onError: err })}><Trash2 /></Button></TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Only people listed here (and active) can sign in. Changes are written to the <code>_Users</code> tab.</p>
    </div>
  )
}
