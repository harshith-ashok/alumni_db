import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ColumnsTab } from '@/features/admin/ColumnsTab'
import { SyncTab } from '@/features/admin/SyncTab'
import { UsersTab } from '@/features/admin/UsersTab'

export function AdminPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">Map sheet columns to fields, control who sees what, and manage access.</p>
      </div>
      <Tabs defaultValue="columns">
        <TabsList>
          <TabsTrigger value="columns">Columns</TabsTrigger>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
          <TabsTrigger value="sync">Sync & cache</TabsTrigger>
        </TabsList>
        <TabsContent value="columns" className="pt-4"><ColumnsTab /></TabsContent>
        <TabsContent value="users" className="pt-4"><UsersTab /></TabsContent>
        <TabsContent value="sync" className="pt-4"><SyncTab /></TabsContent>
      </Tabs>
    </div>
  )
}
