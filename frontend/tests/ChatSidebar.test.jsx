import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import ChatSidebar from '../src/ChatSidebar'
import { ToastProvider } from '../src/toast'

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

const ITEMS = [
  { id: 'c1', title: 'Python basics', updated_at: new Date().toISOString() },
  { id: 'c2', title: 'Bread starter', updated_at: daysAgo(3) },
  { id: 'c3', title: 'Old trip notes', updated_at: daysAgo(40) },
]

function renderSidebar(props = {}) {
  const handlers = {
    onRetry: vi.fn(),
    onLoadMore: vi.fn(),
    onRename: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onNavigate: vi.fn(),
  }
  render(
    <MemoryRouter>
      <ToastProvider>
        <ChatSidebar
          items={ITEMS}
          status="ready"
          hasMore={false}
          loadingMore={false}
          activeId={null}
          {...handlers}
          {...props}
        />
      </ToastProvider>
    </MemoryRouter>
  )
  return handlers
}

function openOptions(title) {
  fireEvent.click(screen.getByRole('button', { name: `Options for ${title}` }))
}

describe('ChatSidebar: the list', () => {
  it('shows each chat as a link to its own address, grouped by date', () => {
    renderSidebar()

    expect(screen.getByRole('link', { name: 'Python basics' })).toHaveAttribute('href', '/chat/c1')
    expect(screen.getByRole('link', { name: 'Bread starter' })).toHaveAttribute('href', '/chat/c2')

    expect(within(screen.getByRole('region', { name: 'Today' })).getByText('Python basics')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Previous 7 days' })).getByText('Bread starter')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Older' })).getByText('Old trip notes')).toBeInTheDocument()
  })

  it('marks the open chat as the current page', () => {
    renderSidebar({ activeId: 'c2' })
    expect(screen.getByRole('link', { name: 'Bread starter' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Python basics' })).not.toHaveAttribute('aria-current')
  })

  it('offers a New chat link to the blank chat', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'New chat' })).toHaveAttribute('href', '/')
  })

  it('tells the app when a chat is chosen (so the phone drawer can close)', () => {
    const { onNavigate } = renderSidebar()
    fireEvent.click(screen.getByRole('link', { name: 'Python basics' }))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('shows loading, empty and error states', () => {
    renderSidebar({ items: [], status: 'loading' })
    expect(screen.getByText('Loading chats...')).toBeInTheDocument()
  })

  it('says so when there are no chats yet', () => {
    renderSidebar({ items: [], status: 'ready' })
    expect(screen.getByText(/no chats yet/i)).toBeInTheDocument()
  })

  it('shows an error with a retry button', () => {
    const { onRetry } = renderSidebar({ items: [], status: 'error' })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your chats.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('loads more chats on request and only when there are more', () => {
    const { onLoadMore } = renderSidebar({ hasMore: true })
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('has no Load more button when everything is loaded', () => {
    renderSidebar({ hasMore: false })
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })
})

describe('ChatSidebar: options menu', () => {
  it('opens and closes the options for a chat', () => {
    renderSidebar()
    const button = screen.getByRole('button', { name: 'Options for Python basics' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
  })

  it('closes the options when clicking elsewhere', () => {
    renderSidebar()
    openOptions('Python basics')
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
  })

  it('keeps only one options menu open at a time', () => {
    renderSidebar()
    openOptions('Python basics')
    openOptions('Bread starter')
    expect(screen.getAllByRole('button', { name: 'Rename' })).toHaveLength(1)
  })
})

describe('ChatSidebar: rename', () => {
  it('renames a chat with the typed title', async () => {
    const { onRename } = renderSidebar()
    openOptions('Python basics')
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByLabelText('Rename chat')
    expect(input).toHaveValue('Python basics')
    fireEvent.change(input, { target: { value: '  Learning Python  ' } })
    fireEvent.submit(input.closest('form'))

    await waitFor(() => expect(onRename).toHaveBeenCalledWith('c1', 'Learning Python'))
    await waitFor(() => expect(screen.queryByLabelText('Rename chat')).not.toBeInTheDocument())
  })

  it('does nothing when the title is blank or unchanged', () => {
    const { onRename } = renderSidebar()
    openOptions('Python basics')
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByLabelText('Rename chat')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.submit(input.closest('form'))

    expect(onRename).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Rename chat')).not.toBeInTheDocument()
  })

  it('cancels with Escape', () => {
    const { onRename } = renderSidebar()
    openOptions('Python basics')
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    fireEvent.keyDown(screen.getByLabelText('Rename chat'), { key: 'Escape' })

    expect(screen.queryByLabelText('Rename chat')).not.toBeInTheDocument()
    expect(onRename).not.toHaveBeenCalled()
  })

  it('shows an error and keeps the box open when renaming fails', async () => {
    renderSidebar({ onRename: vi.fn().mockRejectedValue(new Error('Rename exploded')) })
    openOptions('Python basics')
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    const input = screen.getByLabelText('Rename chat')
    fireEvent.change(input, { target: { value: 'New name' } })
    fireEvent.submit(input.closest('form'))

    expect(await screen.findByText('Rename exploded')).toBeInTheDocument()
    expect(screen.getByLabelText('Rename chat')).toBeInTheDocument()
  })
})

describe('ChatSidebar: delete', () => {
  function startDelete(title) {
    openOptions(title)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    return screen.getByRole('dialog')
  }

  it('asks first and does nothing when cancelled', () => {
    const { onDelete } = renderSidebar()
    const dialog = startDelete('Python basics')
    expect(within(dialog).getByText(/permanently removed/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Python basics/)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('deletes after confirmation and says so', async () => {
    const { onDelete } = renderSidebar()
    const dialog = startDelete('Bread starter')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('c2'))
    expect(await screen.findByText('Chat deleted')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows an error when deleting fails', async () => {
    renderSidebar({ onDelete: vi.fn().mockRejectedValue(new Error('Delete exploded')) })
    const dialog = startDelete('Bread starter')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Delete exploded')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
