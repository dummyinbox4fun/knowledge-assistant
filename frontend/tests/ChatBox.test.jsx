import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChatBox from '../src/ChatBox'
import { mockApi, deferred, chat, message, askReply } from './helpers'

function ask(text) {
  fireEvent.change(screen.getByLabelText('Your question'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))
}

// A fake backend that creates chat "c1" and answers any question.
function newChatApi(answer = 'Python is a programming language.', sources = []) {
  return mockApi([
    ['POST', '/conversations', ({ body }) => ({ status: 201, body: chat('c1', body.title) })],
    ['POST', '/conversations/c1/ask', ({ body }) => askReply(body.query, answer, { sources })],
    ['DELETE', '/conversations/c1', { body: { deleted: 'c1' } }],
  ])
}

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('ChatBox: asking in a new chat', () => {
  it('shows an error when the question is empty', () => {
    render(<ChatBox />)
    fireEvent.click(screen.getByRole('button', { name: /^ask$/i }))
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a question')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('creates a chat named after the question, then asks in it', async () => {
    const calls = newChatApi()
    render(<ChatBox />)
    ask('What is Python?')

    expect(await screen.findByText('Python is a programming language.')).toBeInTheDocument()
    expect(screen.getByText('What is Python?')).toBeInTheDocument()

    expect(calls[0]).toMatchObject({ method: 'POST', path: '/conversations', body: { title: 'What is Python?' } })
    expect(calls[1]).toMatchObject({
      method: 'POST',
      path: '/conversations/c1/ask',
      body: { query: 'What is Python?', top_k: 5 },
    })
  })

  it('shortens a long first question into the chat title', async () => {
    const calls = newChatApi()
    render(<ChatBox />)
    const long = 'Please explain '.repeat(10).trim()
    ask(long)

    await screen.findByText('Python is a programming language.')
    const title = calls[0].body.title
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title.endsWith('…')).toBe(true)
  })

  it('shows the sources under the answer', async () => {
    newChatApi('An answer', [{ filename: 'notes.md', position: 2, distance: 0.4123 }])
    render(<ChatBox />)
    ask('What is Python?')

    expect(await screen.findByText(/notes.md \(chunk 2, distance 0.412\)/)).toBeInTheDocument()
  })

  it('tells the app the chat was created so it can open it', async () => {
    newChatApi()
    const onConversationSaved = vi.fn()
    render(<ChatBox onConversationSaved={onConversationSaved} />)
    ask('What is Python?')

    await screen.findByText('Python is a programming language.')
    expect(onConversationSaved).toHaveBeenCalledTimes(1)
    const [saved, options] = onConversationSaved.mock.calls[0]
    expect(saved).toMatchObject({ id: 'c1', title: 'What is Python?' })
    expect(options).toEqual({ open: true })
  })

  it('keeps showing the thread when the address changes to the chat it just created', async () => {
    const calls = newChatApi()
    const { rerender } = render(<ChatBox />)
    ask('What is Python?')
    await screen.findByText('Python is a programming language.')

    rerender(<ChatBox conversationId="c1" />)

    expect(screen.getByText('What is Python?')).toBeInTheDocument()
    expect(screen.getByText('Python is a programming language.')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'GET')).toBe(false) // nothing to load
  })

  it('shows the empty state until a question is asked', async () => {
    newChatApi('Hello back')
    render(<ChatBox emptyState={<p>Welcome panel</p>} />)
    expect(screen.getByText('Welcome panel')).toBeInTheDocument()

    ask('Hi')

    expect(await screen.findByText('Hello back')).toBeInTheDocument()
    expect(screen.queryByText('Welcome panel')).not.toBeInTheDocument()
  })
})

describe('ChatBox: when asking fails', () => {
  it('shows the backend error detail', async () => {
    mockApi([
      ['POST', '/conversations', ({ body }) => ({ status: 201, body: chat('c1', body.title) })],
      ['POST', '/conversations/c1/ask', { status: 502, body: { detail: 'Generation failed' } }],
      ['DELETE', '/conversations/c1', { body: {} }],
    ])
    render(<ChatBox />)
    ask('Anything')

    expect(await screen.findByRole('alert')).toHaveTextContent('Generation failed')
  })

  it('gives the question back and leaves nothing behind', async () => {
    const calls = mockApi([
      ['POST', '/conversations', ({ body }) => ({ status: 201, body: chat('c1', body.title) })],
      ['POST', '/conversations/c1/ask', { status: 502, body: { detail: 'Generation failed' } }],
      ['DELETE', '/conversations/c1', { body: {} }],
    ])
    const onConversationSaved = vi.fn()
    render(<ChatBox onConversationSaved={onConversationSaved} />)
    ask('What is Python?')

    await screen.findByRole('alert')
    expect(screen.getByLabelText('Your question')).toHaveValue('What is Python?')
    expect(screen.queryByText('Generating answer')).not.toBeInTheDocument()
    // the question is back in the input only, not also left behind as a message
    expect(screen.queryByText('What is Python?')).not.toBeInTheDocument()
    // the empty chat that was created for it is removed again
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path === '/conversations/c1')).toBe(true)
    )
    expect(onConversationSaved).not.toHaveBeenCalled()
  })

  it('shows a friendly message when the request times out', async () => {
    global.fetch = vi.fn().mockRejectedValue(
      Object.assign(new Error('aborted'), { name: 'AbortError' })
    )
    render(<ChatBox />)
    ask('Anything')

    expect(await screen.findByRole('alert')).toHaveTextContent(/taking too long/i)
  })

  it('does not overwrite something the user typed while waiting', async () => {
    const pending = deferred()
    mockApi([
      ['POST', '/conversations', () => pending.promise.then(() => ({ status: 500, body: { detail: 'boom' } }))],
    ])
    render(<ChatBox />)
    ask('first question')
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'second draft' } })

    pending.resolve()
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Your question')).toHaveValue('second draft')
  })
})

describe('ChatBox: a saved chat', () => {
  const history = [
    message('m1', 'user', 'What is Python?'),
    message('m2', 'assistant', 'A programming language.', {
      sources: [{ filename: 'notes.md', position: 1, distance: 0.5 }],
    }),
  ]

  function savedChatApi() {
    return mockApi([
      ['GET', '/conversations/c1', { body: { ...chat('c1', 'Python'), messages: history } }],
      [
        'POST',
        '/conversations/c1/ask',
        ({ body }) => askReply(body.query, 'It is dynamically typed.', { ids: ['m3', 'm4'] }),
      ],
    ])
  }

  it('loads and shows the earlier messages and their sources', async () => {
    savedChatApi()
    render(<ChatBox conversationId="c1" />)

    expect(screen.getByText('Loading conversation...')).toBeInTheDocument()
    expect(await screen.findByText('A programming language.')).toBeInTheDocument()
    expect(screen.getByText('What is Python?')).toBeInTheDocument()
    expect(screen.getByText(/notes.md \(chunk 1, distance 0.500\)/)).toBeInTheDocument()
  })

  it('adds a follow-up below the earlier messages without creating another chat', async () => {
    const calls = savedChatApi()
    const onConversationSaved = vi.fn()
    render(<ChatBox conversationId="c1" onConversationSaved={onConversationSaved} />)
    await screen.findByText('A programming language.')

    ask('Is it typed?')

    expect(await screen.findByText('It is dynamically typed.')).toBeInTheDocument()
    expect(screen.getByText('What is Python?')).toBeInTheDocument()
    expect(screen.getByText('A programming language.')).toBeInTheDocument()
    expect(screen.getByText('Is it typed?')).toBeInTheDocument()

    expect(calls.some((c) => c.method === 'POST' && c.path === '/conversations')).toBe(false)
    expect(onConversationSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1' }),
      { open: false }
    )
  })

  it('shows a not-found message with a way to start a new chat', async () => {
    mockApi([['GET', '/conversations/gone', { status: 404, body: { detail: 'Chat not found' } }]])
    const onNewChat = vi.fn()
    render(<ChatBox conversationId="gone" onNewChat={onNewChat} />)

    expect(await screen.findByText('This chat could not be found.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start a new chat' }))
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it('treats a malformed chat address as not found', async () => {
    mockApi([['GET', '/conversations/not-a-uuid', { status: 422, body: { detail: [] } }]])
    render(<ChatBox conversationId="not-a-uuid" />)
    expect(await screen.findByText('This chat could not be found.')).toBeInTheDocument()
  })

  it('offers a retry when the chat cannot be loaded', async () => {
    let attempts = 0
    mockApi([
      [
        'GET',
        '/conversations/c1',
        () => (++attempts === 1
          ? { status: 500, body: { detail: 'down' } }
          : { body: { ...chat('c1', 'Python'), messages: history } }),
      ],
    ])
    render(<ChatBox conversationId="c1" />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load this chat.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('A programming language.')).toBeInTheDocument()
  })

  it('shows the other chat when the address changes, and ignores a slow earlier load', async () => {
    const slow = deferred()
    mockApi([
      ['GET', '/conversations/a', () => slow.promise],
      [
        'GET',
        '/conversations/b',
        { body: { ...chat('b', 'B'), messages: [message('b1', 'user', 'question in B')] } },
      ],
    ])
    const { rerender } = render(<ChatBox conversationId="a" />)
    rerender(<ChatBox conversationId="b" />)
    expect(await screen.findByText('question in B')).toBeInTheDocument()

    slow.resolve({ body: { ...chat('a', 'A'), messages: [message('a1', 'user', 'question in A')] } })
    await new Promise((r) => setTimeout(r, 0))

    expect(screen.queryByText('question in A')).not.toBeInTheDocument()
    expect(screen.getByText('question in B')).toBeInTheDocument()
  })

  it('does not show an answer in a different chat than the one that was asked', async () => {
    const answer = deferred()
    mockApi([
      ['GET', '/conversations/c1', { body: { ...chat('c1', 'One'), messages: [] } }],
      ['GET', '/conversations/c2', { body: { ...chat('c2', 'Two'), messages: [message('x1', 'user', 'only in two')] } }],
      ['POST', '/conversations/c1/ask', () => answer.promise],
    ])
    const onConversationSaved = vi.fn()
    const { rerender } = render(
      <ChatBox conversationId="c1" onConversationSaved={onConversationSaved} />
    )
    await waitFor(() => expect(screen.queryByText('Loading conversation...')).not.toBeInTheDocument())
    ask('asked in one')

    rerender(<ChatBox conversationId="c2" onConversationSaved={onConversationSaved} />)
    await screen.findByText('only in two')

    answer.resolve(askReply('asked in one', 'answer for one'))
    await waitFor(() => expect(onConversationSaved).toHaveBeenCalled())

    expect(screen.queryByText('answer for one')).not.toBeInTheDocument()
    expect(screen.queryByText('asked in one')).not.toBeInTheDocument()
    expect(onConversationSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), { open: false })
  })
})

describe('ChatBox: rendering answers', () => {
  function answerWith(markdown) {
    mockApi([
      ['GET', '/conversations/c1', {
        body: { ...chat('c1', 't'), messages: [message('m1', 'assistant', markdown)] },
      }],
    ])
    return render(<ChatBox conversationId="c1" />)
  }

  it('renders Markdown formatting', async () => {
    answerWith('This is **important**.\n\n- one\n- two')
    expect(await screen.findByText('important')).toContainHTML('important')
    expect(screen.getByText('important').tagName).toBe('STRONG')
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['one', 'two'])
  })

  it('opens links in a new tab without leaking the opener', async () => {
    answerWith('See [the docs](https://example.com/page).')
    const link = await screen.findByRole('link', { name: 'the docs' })
    expect(link).toHaveAttribute('href', 'https://example.com/page')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not load images or run raw HTML from an answer', async () => {
    const { container } = answerWith(
      'Look ![tracker](https://evil.example/pixel.png) <img src="https://evil.example/x.png"> <script>alert(1)</script> <b>bold?</b>'
    )
    await screen.findByText(/Look/)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('does not turn a javascript: link into a clickable link', async () => {
    const { container } = answerWith('[click me](javascript:alert(1))')
    await screen.findByText('click me')
    const link = container.querySelector('a')
    expect(link === null || !String(link.getAttribute('href') || '').startsWith('javascript:')).toBe(true)
  })

  it('shows the person\'s own messages as plain text, not Markdown', async () => {
    mockApi([
      ['GET', '/conversations/c1', {
        body: { ...chat('c1', 't'), messages: [message('m1', 'user', 'literal **stars**')] },
      }],
    ])
    render(<ChatBox conversationId="c1" />)
    expect(await screen.findByText('literal **stars**')).toBeInTheDocument()
  })
})

describe('ChatBox: composer', () => {
  it('fills the input when a suggestion chip is clicked', () => {
    render(<ChatBox />)
    fireEvent.click(screen.getByRole('button', { name: 'Key points' }))
    expect(screen.getByLabelText('Your question')).toHaveValue(
      'What are the key points in my notes?'
    )
  })

  it('shows an attach button only when onAttach is provided', () => {
    const onAttach = vi.fn()
    const { rerender } = render(<ChatBox />)
    expect(screen.queryByRole('button', { name: 'Attach a document' })).not.toBeInTheDocument()

    rerender(<ChatBox onAttach={onAttach} />)
    fireEvent.click(screen.getByRole('button', { name: 'Attach a document' }))
    expect(onAttach).toHaveBeenCalledTimes(1)
  })

  it('disables Ask while an answer is being generated', async () => {
    const pending = deferred()
    mockApi([
      ['POST', '/conversations', ({ body }) => ({ status: 201, body: chat('c1', body.title) })],
      ['POST', '/conversations/c1/ask', () => pending.promise],
    ])
    render(<ChatBox />)
    ask('Hello')

    const button = await screen.findByRole('button', { name: 'Thinking...' })
    expect(button).toBeDisabled()
    expect(screen.getByText('Generating answer')).toBeInTheDocument()

    pending.resolve(askReply('Hello', 'Hi there'))
    expect(await screen.findByText('Hi there')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled()
  })
})
