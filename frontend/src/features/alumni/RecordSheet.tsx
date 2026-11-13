import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { editableColumns } from '@/lib/auth/permissions'
import { useSession } from '@/lib/auth/useAuth'
import { useAlumniMutations } from '@/lib/data/hooks'
import type { AlumniRecord, CellValue, ColumnDef } from '@/lib/schema/types'
import { buildRecordSchema } from '@/lib/schema/validation'
import { CellView } from './cells'
import { FieldInput } from './FieldInput'

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

export type SheetMode = { type: 'closed' } | { type: 'view' | 'edit'; record: AlumniRecord } | { type: 'create' }

interface Props { mode: SheetMode; columns: ColumnDef[]; onMode: (m: SheetMode) => void }

export function RecordSheet({ mode, columns, onMode }: Props) {
  const open = mode.type !== 'closed'
  const close = () => onMode({ type: 'closed' })
  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {/* key forces fresh form state per record/mode */}
        {mode.type === 'view' && <View record={mode.record} columns={columns} onMode={onMode} />}
        {(mode.type === 'edit' || mode.type === 'create') && (
          <Form key={mode.type === 'edit' ? mode.record._id : 'new'} record={mode.type === 'edit' ? mode.record : undefined} columns={columns} onDone={close} onCancel={() => onMode(mode.type === 'edit' ? { type: 'view', record: mode.record } : { type: 'closed' })} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function titleOf(record: AlumniRecord, columns: ColumnDef[]) {
  const p = columns.find((c) => c.primary) ?? columns[0]
  return (p && record[p.key] ? String(record[p.key]) : 'Alumnus')
}

function View({ record, columns, onMode }: { record: AlumniRecord; columns: ColumnDef[]; onMode: Props['onMode'] }) {
  const { canWrite } = useSession()
  const { remove } = useAlumniMutations()
  return (
    <>
      <SheetHeader><SheetTitle>{titleOf(record, columns)}</SheetTitle><SheetDescription>Alumni record</SheetDescription></SheetHeader>
      <dl className="space-y-4 px-4">
        {columns.filter((c) => !c.primary).map((c) => (
          <div key={c.key}><dt className="text-xs font-medium text-muted-foreground">{c.label}</dt><dd className="mt-1 text-sm"><CellView col={c} value={record[c.key]} /></dd></div>
        ))}
      </dl>
      {canWrite && (
        <SheetFooter className="flex-row justify-between">
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" className="text-destructive" />}><Trash2 /> Delete</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete {titleOf(record, columns)}?</AlertDialogTitle><AlertDialogDescription>This removes the row from the Google Sheet.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => { remove.mutate(record._id, { onError: (e: unknown) => toast.error(msg(e)), onSuccess: () => toast.success('Deleted') }); onMode({ type: 'closed' }) }}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => onMode({ type: 'edit', record })}><Pencil /> Edit</Button>
        </SheetFooter>
      )}
    </>
  )
}

function Form({ record, columns, onDone, onCancel }: { record?: AlumniRecord; columns: ColumnDef[]; onDone: () => void; onCancel: () => void }) {
  const { role } = useSession()
  const { create, update } = useAlumniMutations()
  const fields = useMemo(() => editableColumns(columns, role), [columns, role])
  const schema = useMemo(() => buildRecordSchema(fields), [fields])
  const defaults = useMemo(() => {
    const d: Record<string, CellValue> = {}
    for (const c of fields) d[c.key] = record?.[c.key] ?? (c.type === 'boolean' ? false : c.type === 'multiselect' ? [] : null)
    return d
  }, [fields, record])
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Record<string, CellValue>>({
    // schema is built at runtime from the column map, so its type is not statically known
    resolver: zodResolver(schema) as never,
    defaultValues: defaults,
  })
  const save = handleSubmit((values) => {
    const opts = { onError: (e: unknown) => toast.error(msg(e)), onSuccess: () => toast.success(record ? 'Saved' : 'Alumnus added') }
    if (record) update.mutate({ id: record._id, patch: values }, opts)
    else create.mutate(values, opts)
    onDone()
  })
  return (
    <form noValidate onSubmit={save} className="flex flex-1 flex-col">
      <SheetHeader><SheetTitle>{record ? `Edit ${titleOf(record, columns)}` : 'Add alumnus'}</SheetTitle><SheetDescription>Fields come from your sheet's column map.</SheetDescription></SheetHeader>
      <div className="flex-1 space-y-4 px-4">
        {fields.map((c) => {
          const err = errors[c.key]?.message as string | undefined
          return (
            <div key={c.key} className="space-y-1.5">
              <Label htmlFor={`f-${c.key}`}>{c.label}{c.required && <span className="text-destructive"> *</span>}</Label>
              <Controller control={control} name={c.key} render={({ field }) => <FieldInput id={`f-${c.key}`} col={c} value={field.value} onChange={field.onChange} invalid={!!err} />} />
              {err && <p className="text-xs text-destructive">{err}</p>}
            </div>
          )
        })}
      </div>
      <SheetFooter className="flex-row justify-end"><Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{record ? 'Save changes' : 'Add'}</Button></SheetFooter>
    </form>
  )
}
