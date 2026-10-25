import { useState } from 'react'
import { useAuth } from './auth'

const GRADIENT = 'linear-gradient(135deg, #e9ecff 0%, #f4f0ff 50%, #e6f2ff 100%)'
const INPUT =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200'
const PRIMARY = 'w-full rounded-lg py-2.5'
const LINK =
  'bg-transparent p-0 text-sm font-medium text-indigo-600 hover:bg-transparent hover:underline'

const MIN_PASSWORD = 8

function friendlyError(error) {
  const message = error?.message || ''
  if (/invalid login credentials/i.test(message)) return 'Wrong email or password.'
  if (/email not confirmed/i.test(message))
    return 'Please confirm your email first. Check your inbox for the link.'
  if (/rate limit|too many/i.test(message))
    return 'Too many attempts right now. Please wait a few minutes and try again.'
  return message || 'Something went wrong. Please try again.'
}

const TITLES = {
  signin: ['Welcome back', 'Sign in to your knowledge assistant.'],
  signup: ['Create your account', 'Your documents stay in your own library.'],
  forgot: ['Reset your password', "Enter your email and we'll send you a reset link."],
  update: ['Choose a new password', `Use at least ${MIN_PASSWORD} characters.`],
}

export function Splash() {
  return (
    <div
      className="grid h-dvh place-items-center text-sm text-slate-600"
      style={{ background: GRADIENT }}
      role="status"
    >
      Loading...
    </div>
  )
}

export default function AuthScreen({ initialMode = 'signin' }) {
  const { recovery, signIn, signUp, resetPassword, updatePassword } = useAuth()
  const [mode, setMode] = useState(recovery ? 'update' : initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [title, subtitle] = TITLES[mode]

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
    setConfirm('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')

    if ((mode === 'signup' || mode === 'update') && password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`)
      return
    }
    if ((mode === 'signup' || mode === 'update') && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      let result
      if (mode === 'signin') result = await signIn(email.trim(), password)
      else if (mode === 'signup') result = await signUp(email.trim(), password)
      else if (mode === 'forgot') result = await resetPassword(email.trim())
      else result = await updatePassword(password)

      if (result?.error) {
        setError(friendlyError(result.error))
        return
      }

      if (mode === 'signup' && !result?.data?.session) {
        setInfo('Almost there. Check your inbox and click the confirmation link, then sign in.')
        setPassword('')
        setConfirm('')
      } else if (mode === 'forgot') {
        setInfo('If that email has an account, a reset link is on its way. Check your inbox.')
      }
      // signin / update / signup-with-session: the auth context changes and
      // AuthGate swaps this screen for the app, so nothing else to do here.
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const submitLabel = {
    signin: 'Sign in',
    signup: 'Create account',
    forgot: 'Send reset link',
    update: 'Save new password',
  }[mode]

  return (
    <div
      className="flex min-h-dvh items-center justify-center px-4 py-8"
      style={{ background: GRADIENT }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white bg-white/90 p-6 shadow-[0_12px_40px_rgba(60,60,120,0.12)] sm:p-8">
        <div className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-items-center rounded-[10px] bg-indigo-600 text-base font-bold text-white"
            aria-hidden="true"
          >
            K
          </span>
          <span className="text-[15px] font-semibold">Knowledge Assistant</span>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          {mode !== 'update' && (
            <div>
              <label htmlFor="auth-email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
              />
            </div>
          )}

          {mode !== 'forgot' && (
            <div>
              <label htmlFor="auth-password" className="text-sm font-medium text-slate-700">
                {mode === 'update' ? 'New password' : 'Password'}
              </label>
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
              />
            </div>
          )}

          {(mode === 'signup' || mode === 'update') && (
            <div>
              <label htmlFor="auth-confirm" className="text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={INPUT}
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {info && (
            <p
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              {info}
            </p>
          )}

          <button type="submit" disabled={busy || !!info} className={PRIMARY}>
            {busy ? 'Please wait...' : submitLabel}
          </button>
        </form>

        <div className="mt-5 flex flex-col items-center gap-2 text-sm text-slate-600">
          {mode === 'signin' && (
            <>
              <button type="button" className={LINK} onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
              <span>
                New here?{' '}
                <button type="button" className={LINK} onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </span>
            </>
          )}
          {mode === 'signup' && (
            <span>
              Already have an account?{' '}
              <button type="button" className={LINK} onClick={() => switchMode('signin')}>
                Sign in
              </button>
            </span>
          )}
          {mode === 'forgot' && (
            <button type="button" className={LINK} onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
