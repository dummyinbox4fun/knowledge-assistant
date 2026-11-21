import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import App from '../src/App'
import { mockApi, chat, message, askReply } from './helpers'

const DOCUMENTS = [
  { filename: 'a.md', length_chars: 1000, chunk_count: 3, uploaded_at: 'x' },
  { filename: 'b.md', length_chars: 500, chunk_count: 2, uploaded_at: 'y' },
]

// Shows the current address so tests can check where the app navigated.
function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>
  )
}

let chats
let calls

function fakeBackend(extraRoutes = []) {
  calls = mockApi([
    ...extraRoutes,
    ['GET', '/health', { body: { status: 'ok', environment: 'test' } }],
    ['GET', '/ingestion/documents', { body: { documents: DOCUMENTS } }],
    ['GET', /^\/conversations\?/, () => ({ body: { conversations: chats } })],
    [
      'GET',
      '/conversations/c1',
      {
        body: {
          ...chat('c1', 'Python basics'),
          messages: [
            message('m1', 'user', 'What is Python?'),
            message('m2', 'assistant', 'A programming language.'),
          ],
        },
      },
    ],
    ['DELETE', '/conversations/c1', () => {
      chats = chats.filter((c) => c.id !== 'c1')
      return { body: { deleted: 'c1' } }
    }],
  ])
}

const where = () => screen.getByTestId('where').textContent
const rail = () => screen.getByRole('navigation', { name: 'Main' })

beforeEach(() => {
  chats = [chat('c1', 'Python basics'), chat('c2', 'Bread starter')]
  fakeBackend()
})

describe('App', () => {
  it('shows the backend status', async () => {
    renderApp()
    expect(await screen.findByText('backend: ok (test)')).toBeInTheDocument()
  })

  it('shows the greeting and library totals on the welcome cards', async () => {
    renderApp()
    expect(
      screen.getByRole('heading', { name: /what are you looking for in your notes/i })
    ).toBeInTheDocument()

    const card = await screen.findByRole('button', { name: /browse your library/i })
    await waitFor(() => {
      expect(card).toHaveTextContent('2 documents · 5 chunks · 1,500 characters')
    })
  })

  it('switches views from the navigation rail', async () => {
    renderApp()
    const askButton = within(rail()).getByRole('button', { name: 'Ask your notes' })
    const uploadButton = within(rail()).getByRole('button', { name: 'Upload a document' })

    expect(askButton).toHaveAttribute('aria-current', 'page')

    fireEvent.click(uploadButton)

    expect(uploadButton).toHaveAttribute('aria-current', 'page')
    expect(askButton).not.toHaveAttribute('aria-current')
    expect(where()).toBe('/upload')
    await screen.findByText('backend: ok (test)')
  })

  it('opens the upload view from the welcome card', async () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: /^upload a document drop in/i }))

    expect(within(rail()).getByRole('button', { name: 'Upload a document' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    await screen.findByText('backend: ok (test)')
  })
})

describe('App: addresses', () => {
  it('opens a saved chat straight from its address', async () => {
    renderApp('/chat/c1')

    expect(await screen.findByText('A programming language.')).toBeInTheDocument()
    expect(screen.getByText('What is Python?', { selector: 'p' })).toBeInTheDocument()
    expect(within(rail()).getByRole('button', { name: 'Ask your notes' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('opens the document list from /documents', async () => {
    renderApp('/documents')
    expect(within(rail()).getByRole('button', { name: 'Documents' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(await screen.findByText('a.md')).toBeInTheDocument()
  })

  it('sends an unknown address back to a new chat', async () => {
    renderApp('/no-such-page')
    await waitFor(() => expect(where()).toBe('/'))
  })

  it('returns to the chat you were in when you press Ask after visiting another screen', async () => {
    renderApp('/chat/c1')
    await screen.findByText('A programming language.')

    fireEvent.click(within(rail()).getByRole('button', { name: 'Documents' }))
    expect(where()).toBe('/documents')

    fireEvent.click(within(rail()).getByRole('button', { name: 'Ask your notes' }))
    expect(where()).toBe('/chat/c1')
  })

  it('keeps the chat on screen while another screen is open, without reloading it', async () => {
    renderApp('/chat/c1')
    await screen.findByText('A programming language.')

    fireEvent.click(within(rail()).getByRole('button', { name: 'Documents' }))
    expect(screen.getByText('A programming language.')).toBeInTheDocument()

    fireEvent.click(within(rail()).getByRole('button', { name: 'Ask your notes' }))
    expect(screen.getByText('A programming language.')).toBeInTheDocument()

    const loads = calls.filter((c) => c.method === 'GET' && c.path === '/conversations/c1')
    expect(loads).toHaveLength(1)
  })

  it('shows a not-found message for a chat that does not exist', async () => {
    mockApi([
      ['GET', '/health', { body: { status: 'ok', environment: 'test' } }],
      ['GET', '/ingestion/documents', { body: { documents: [] } }],
      ['GET', /^\/conversations\?/, { body: { conversations: [] } }],
      ['GET', '/conversations/ghost', { status: 404, body: { detail: 'Chat not found' } }],
    ])
    renderApp('/chat/ghost')

    expect(await screen.findByText('This chat could not be found.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start a new chat' }))
    expect(where()).toBe('/')
  })
})

describe('App: the chat list', () => {
  it('lists saved chats as links in the sidebar', async () => {
    renderApp()
    const sidebar = screen.getByRole('navigation', { name: 'Chats' })

    expect(await within(sidebar).findByRole('link', { name: 'Python basics' })).toHaveAttribute(
      'href',
      '/chat/c1'
    )
    expect(within(sidebar).getByRole('link', { name: 'Bread starter' })).toBeInTheDocument()
  })

  it('opens a chat when it is clicked in the sidebar, and New chat goes back to blank', async () => {
    renderApp()
    const sidebar = screen.getByRole('navigation', { name: 'Chats' })

    fireEvent.click(await within(sidebar).findByRole('link', { name: 'Python basics' }))
    expect(where()).toBe('/chat/c1')
    expect(await screen.findByText('A programming language.')).toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Python basics' })).toHaveAttribute(
      'aria-current',
      'page'
    )

    fireEvent.click(within(sidebar).getByRole('link', { name: 'New chat' }))
    expect(where()).toBe('/')
    expect(
      await screen.findByRole('heading', { name: /what are you looking for in your notes/i })
    ).toBeInTheDocument()
    expect(screen.queryByText('A programming language.')).not.toBeInTheDocument()
  })

  it('opens a new chat at its own address and adds it to the sidebar', async () => {
    fakeBackend([
      ['POST', '/conversations', ({ body }) => ({ status: 201, body: chat('new1', body.title) })],
      ['POST', '/conversations/new1/ask', ({ body }) => askReply(body.query, 'It is a snake.')],
    ])
    renderApp()
    const sidebar = screen.getByRole('navigation', { name: 'Chats' })
    await within(sidebar).findByRole('link', { name: 'Python basics' })

    const question = screen.getByLabelText('Your question')
    fireEvent.change(question, { target: { value: 'What is a python?' } })
    fireEvent.submit(question.closest('form'))

    expect(await screen.findByText('It is a snake.')).toBeInTheDocument()
    await waitFor(() => expect(where()).toBe('/chat/new1'))

    const links = within(sidebar).getAllByRole('link').map((a) => a.textContent)
    expect(links.indexOf('What is a python?')).toBe(1) // first chat link, right after "New chat"
    // the thread was kept, not reloaded from the server
    expect(calls.some((c) => c.method === 'GET' && c.path === '/conversations/new1')).toBe(false)
  })

  it('deleting the open chat removes it from the list and returns to a new chat', async () => {
    renderApp('/chat/c1')
    await screen.findByText('A programming language.')
    const sidebar = screen.getByRole('navigation', { name: 'Chats' })

    fireEvent.click(await within(sidebar).findByRole('button', { name: 'Options for Python basics' }))
    fireEvent.click(within(sidebar).getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(where()).toBe('/'))
    expect(within(sidebar).queryByRole('link', { name: 'Python basics' })).not.toBeInTheDocument()
    expect(within(sidebar).getByRole('link', { name: 'Bread starter' })).toBeInTheDocument()
  })

  it('opens and closes the chat list drawer on a phone', async () => {
    renderApp()
    const toggle = screen.getByRole('button', { name: 'Chat list' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await screen.findByText('backend: ok (test)')
  })

  it('closes the drawer after choosing a chat', async () => {
    renderApp()
    const toggle = screen.getByRole('button', { name: 'Chat list' })
    fireEvent.click(toggle)

    const sidebar = screen.getByRole('navigation', { name: 'Chats' })
    fireEvent.click(await within(sidebar).findByRole('link', { name: 'Python basics' }))

    await waitFor(() => expect(toggle).toHaveAttribute('aria-expanded', 'false'))
  })

  it('still works when the chat list cannot be loaded', async () => {
    mockApi([
      ['GET', '/health', { body: { status: 'ok', environment: 'test' } }],
      ['GET', '/ingestion/documents', { body: { documents: [] } }],
      ['GET', /^\/conversations\?/, { status: 500, body: { detail: 'down' } }],
    ])
    renderApp()

    const sidebar = screen.getByRole('navigation', { name: 'Chats' })
    expect(await within(sidebar).findByRole('alert')).toHaveTextContent('Could not load your chats.')
    expect(screen.getByLabelText('Your question')).toBeInTheDocument()
  })
})
