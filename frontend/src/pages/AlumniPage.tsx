import { useAlumni, useSchema } from '@/lib/data/hooks'
import { useSession } from '@/lib/auth/useAuth'

/** Placeholder until Phase 3 — proves auth, RBAC redaction and caching end to end. */
export function AlumniPage() {
  const s = useSession()
  const schema = useSchema()
  const alumni = useAlumni()
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Directory</h1>
      <p className="text-sm text-muted-foreground">
        {alumni.data?.length ?? '…'} records · {schema.data?.columns.length ?? '…'} visible fields for role <b>{s.role}</b>
      </p>
    </div>
  )
}
