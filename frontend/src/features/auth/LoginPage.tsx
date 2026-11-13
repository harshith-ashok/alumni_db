import { GoogleLogin } from '@react-oauth/google'
import { GraduationCap } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { mockIdentity } from '@/lib/data/mock'
import { useAuth } from '@/lib/auth/useAuth'

export function LoginPage() {
  const { state, mode, signInMock, signInGoogle } = useAuth()
  if (state.status === 'ready') return <Navigate to="/" replace />
  const error = state.status === 'signedOut' ? state.error : undefined
  return (
    <div className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <GraduationCap className="mx-auto size-8" />
          <CardTitle className="text-xl">Alumni Directory</CardTitle>
          <CardDescription>{mode === 'google' ? 'Sign in with your Google account' : 'Demo mode — pick a role to explore'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {mode === 'google' ? (
            <div className="flex justify-center">
              <GoogleLogin onSuccess={(r) => r.credential && void signInGoogle(r.credential)} onError={() => undefined} />
            </div>
          ) : (
            mockIdentity.demoUsers().map((u) => (
              <Button key={u.email} variant="outline" className="h-auto w-full justify-between py-2" onClick={() => void signInMock(u.email)}>
                <span className="text-left"><span className="block">{u.name}</span><span className="block text-xs font-normal text-muted-foreground">{u.email}</span></span>
                <span className="text-xs font-medium capitalize">{u.role}</span>
              </Button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
