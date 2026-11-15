import { useAuth } from './auth'
import AuthScreen, { Splash } from './AuthScreen'

// Shows the app only to signed-in users. When login is not configured
// (no Supabase env vars) it renders the app straight away.
export default function AuthGate({ children }) {
  const { enabled, loading, user, recovery } = useAuth()

  if (!enabled) return children
  if (loading) return <Splash />
  if (user && recovery) return <AuthScreen key="update" initialMode="update" />
  if (!user) return <AuthScreen key="signin" />
  return children
}
