import { GraduationCap, LogOut } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAuth, useSession } from '@/lib/auth/useAuth'
import { useVersionSync } from '@/lib/data/hooks'
import { cn } from '@/lib/utils'

const link = ({ isActive }: { isActive: boolean }) =>
  cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')

export function AppShell() {
  const { signOut } = useAuth()
  const s = useSession()
  useVersionSync()
  const initials = s.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <div className="flex items-center gap-2 font-semibold"><GraduationCap className="size-5" /> Alumni</div>
          <nav className="flex gap-1">
            <NavLink to="/" end className={link}>Directory</NavLink>
            {s.isAdmin && <NavLink to="/admin" className={link}>Admin</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Badge variant="secondary" className="capitalize">{s.role}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account" />}>
                <Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col"><span>{s.name}</span><span className="text-xs font-normal text-muted-foreground">{s.email}</span></DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}><LogOut /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6"><Outlet /></main>
    </div>
  )
}
