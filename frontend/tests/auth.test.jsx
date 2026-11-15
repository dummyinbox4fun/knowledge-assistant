import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthProvider } from '../src/auth'
import AuthGate from '../src/AuthGate'
import App from '../src/App'
import { authHeaders, setAccessToken } from '../src/apiConfig'

function makeClient({ session = null } = {}) {
  let listener = () => {}
  return {
    emit: (event, next) => listener(event, next),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session } }),
      onAuthStateChange: vi.fn((fn) => {
        listener = fn
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }
}

const SESSION = {
  access_token: 'token-abc',
  user: { id: 'u1', email: 'me@example.com' },
}

function renderGate(client, child = <p>the app</p>) {
  return render(
    <AuthProvider client={client}>
      <AuthGate>{child}</AuthGate>
    </AuthProvider>
  )
}

function fill(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

beforeEach(() => {
  setAccessToken(null)
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: async () => ({ status: 'ok', environment: 'test', documents: [] }) })
  )
})

describe('AuthGate', () => {
  it('shows the app straight away when login is not configured', () => {
    render(
      <AuthProvider client={null}>
        <AuthGate>
          <p>the app</p>
        </AuthGate>
      </AuthProvider>
    )
    expect(screen.getByText('the app')).toBeInTheDocument()
  })

  it('shows the sign-in screen when signed out', async () => {
    renderGate(makeClient())
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.queryByText('the app')).not.toBeInTheDocument()
  })

  it('shows the app and sets the API token when signed in', async () => {
    renderGate(makeClient({ session: SESSION }))
    expect(await screen.findByText('the app')).toBeInTheDocument()
    expect(authHeaders().Authorization).toBe('Bearer token-abc')
  })

  it('goes back to the sign-in screen after sign-out and clears the token', async () => {
    const client = makeClient({ session: SESSION })
    renderGate(client)
    await screen.findByText('the app')

    act(() => client.emit('SIGNED_OUT', null))

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(authHeaders().Authorization).toBeUndefined()
  })

  it('picks up a refreshed token', async () => {
    const client = makeClient({ session: SESSION })
    renderGate(client)
    await screen.findByText('the app')

    act(() => client.emit('TOKEN_REFRESHED', { ...SESSION, access_token: 'token-new' }))

    expect(authHeaders().Authorization).toBe('Bearer token-new')
  })
})

describe('sign in', () => {
  it('signs in with the typed email and password', async () => {
    const client = makeClient()
    renderGate(client)
    await screen.findByRole('heading', { name: 'Welcome back' })

    fill('Email', ' me@example.com ')
    fill('Password', 'correct-horse')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() =>
      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'me@example.com',
        password: 'correct-horse',
      })
    )
  })

  it('shows a friendly message for wrong credentials', async () => {
    const client = makeClient()
    client.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    })
    renderGate(client)
    await screen.findByRole('heading', { name: 'Welcome back' })

    fill('Email', 'me@example.com')
    fill('Password', 'nope')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
  })

  it('tells the user to confirm their email first', async () => {
    const client = makeClient()
    client.auth.signInWithPassword.mockResolvedValue({
      error: { message: 'Email not confirmed' },
    })
    renderGate(client)
    await screen.findByRole('heading', { name: 'Welcome back' })

    fill('Email', 'me@example.com')
    fill('Password', 'whatever1')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/confirm your email/i)
  })

  it('shows an error instead of crashing when the network fails', async () => {
    const client = makeClient()
    client.auth.signInWithPassword.mockRejectedValue(new Error('network'))
    renderGate(client)
    await screen.findByRole('heading', { name: 'Welcome back' })

    fill('Email', 'me@example.com')
    fill('Password', 'whatever1')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach/i)
  })
})

describe('register', () => {
  async function openSignUp(client) {
    renderGate(client)
    await screen.findByRole('heading', { name: 'Welcome back' })
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  }

  it('rejects a short password without calling the server', async () => {
    const client = makeClient()
    await openSignUp(client)

    fill('Email', 'me@example.com')
    fill('Password', 'short')
    fill('Confirm password', 'short')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8/i)
    expect(client.auth.signUp).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords without calling the server', async () => {
    const client = makeClient()
    await openSignUp(client)

    fill('Email', 'me@example.com')
    fill('Password', 'long-enough-1')
    fill('Confirm password', 'long-enough-2')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i)
    expect(client.auth.signUp).not.toHaveBeenCalled()
  })

  it('creates the account and asks the user to confirm their email', async () => {
    const client = makeClient()
    await openSignUp(client)

    fill('Email', 'me@example.com')
    fill('Password', 'long-enough-1')
    fill('Confirm password', 'long-enough-1')
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/check your inbox/i)
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'me@example.com',
      password: 'long-enough-1',
      options: { emailRedirectTo: window.location.origin },
    })
  })
})

describe('Google sign-in', () => {
  it('starts the Google flow and returns to this site afterwards', async () => {
    const client = makeClient()
    renderGate(client)
    await screen.findByRole('heading', { name: 'Welcome back' })

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() =>
      expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
    )
  })

  it('is also offered on the register screen', async () => {
    renderGate(makeClient())
    await screen.findByRole('heading', { name: 'Welcome back' })
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
  })

  it('is not shown on the password reset screen', async () => {
    renderGate(makeClient())
    await screen.findByRole('heading', { name: 'Welcome back' })
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument()
  })

  it('shows an error if Google sign-in cannot start', async () => {
    const client = makeClient()
    client.auth.signInWithOAuth.mockResolvedValue({
      error: { message: 'Unsupported provider: provider is not enabled' },
    })
    renderGate(client)
    await screen.findByRole('heading', { name: 'Welcome back' })

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/not enabled/i)
  })
})

describe('password reset', () => {
  it('requests a reset link for the typed email', async () => {
    const client = makeClient()
    renderGate(client)
    await screen.findByRole('heading', { name: 'Welcome back' })

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    fill('Email', 'me@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('status')).toHaveTextContent(/reset link is on its way/i)
    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', {
      redirectTo: window.location.origin,
    })
  })

  it('lets the user set a new password after following the email link', async () => {
    const client = makeClient({ session: SESSION })
    renderGate(client)
    await screen.findByText('the app')

    act(() => client.emit('PASSWORD_RECOVERY', SESSION))

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
    fill('New password', 'brand-new-pass')
    fill('Confirm password', 'brand-new-pass')
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))

    await waitFor(() =>
      expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'brand-new-pass' })
    )
    expect(await screen.findByText('the app')).toBeInTheDocument()
  })
})

describe('sign out', () => {
  it('shows the email and signs out from the app header', async () => {
    const client = makeClient({ session: SESSION })
    render(
      <AuthProvider client={client}>
        <AuthGate>
          <App />
        </AuthGate>
      </AuthProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    expect(client.auth.signOut).toHaveBeenCalled()
    await screen.findByText('backend: ok (test)')
  })
})

describe('authHeaders', () => {
  it('sends no Authorization header when nobody is signed in', () => {
    expect(authHeaders().Authorization).toBeUndefined()
  })
})
