import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase as defaultClient } from './supabaseClient'
import { setAccessToken } from './apiConfig'

const noop = async () => ({ error: null })

const AuthContext = createContext({
  enabled: false,
  loading: false,
  user: null,
  recovery: false,
  signIn: noop,
  signInWithGoogle: noop,
  signUp: noop,
  resetPassword: noop,
  updatePassword: noop,
  signOut: noop,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ client = defaultClient, children }) {
  const enabled = Boolean(client)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!client) return undefined

    // Update the token used for API calls at the moment the session changes,
    // before any component re-renders and fires a request.
    const apply = (next) => {
      setAccessToken(next?.access_token ?? null)
      setSession(next ?? null)
    }

    let active = true
    client.auth.getSession().then(({ data }) => {
      if (!active) return
      apply(data?.session)
      setLoading(false)
    })

    const { data } = client.auth.onAuthStateChange((event, next) => {
      apply(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const signIn = useCallback(
    (email, password) => client.auth.signInWithPassword({ email, password }),
    [client]
  )

  const signInWithGoogle = useCallback(
    () =>
      client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      }),
    [client]
  )

  const signUp = useCallback(
    (email, password) =>
      client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      }),
    [client]
  )

  const resetPassword = useCallback(
    (email) => client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }),
    [client]
  )

  const updatePassword = useCallback(
    async (password) => {
      const result = await client.auth.updateUser({ password })
      if (!result.error) setRecovery(false)
      return result
    },
    [client]
  )

  const signOut = useCallback(() => client.auth.signOut(), [client])

  const value = useMemo(
    () =>
      enabled
        ? {
            enabled,
            loading,
            user: session?.user ?? null,
            recovery,
            signIn,
            signInWithGoogle,
            signUp,
            resetPassword,
            updatePassword,
            signOut,
          }
        : {
            enabled: false,
            loading: false,
            user: null,
            recovery: false,
            signIn: noop,
            signInWithGoogle: noop,
            signUp: noop,
            resetPassword: noop,
            updatePassword: noop,
            signOut: noop,
          },
    [enabled, loading, session, recovery, signIn, signInWithGoogle, signUp, resetPassword, updatePassword, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
