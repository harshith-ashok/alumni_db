import { AlumniTable } from '@/features/alumni/AlumniTable'

export function AlumniPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Directory</h1>
      <AlumniTable />
    </div>
  )
}
