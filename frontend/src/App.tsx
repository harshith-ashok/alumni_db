import { GoogleOAuthProvider } from '@react-oauth/google'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { RequireAuth, RequireRole } from '@/components/RouteGuards'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LoginPage } from '@/features/auth/LoginPage'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { persistOptions, queryClient } from '@/lib/data/queries'
import { AdminPage } from '@/pages/AdminPage'
import { AlumniPage } from '@/pages/AlumniPage'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

export default function App() {
  return (
    <GoogleOAuthProvider clientId={clientId}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <AuthProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<div className="grid min-h-svh place-items-center text-muted-foreground">Page not found</div>} />
                <Route element={<RequireAuth />}>
                  <Route element={<AppShell />}>
                    <Route index element={<AlumniPage />} />
                    <Route element={<RequireRole roles={['admin']} />}>
                      <Route path="admin" element={<AdminPage />} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
            <Toaster richColors />
          </TooltipProvider>
        </AuthProvider>
      </PersistQueryClientProvider>
    </GoogleOAuthProvider>
  )
}
