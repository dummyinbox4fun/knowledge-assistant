import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

// Default value is a no-op, so components using useToast() still work
// (silently) when rendered without a provider, e.g. in unit tests.
const ToastContext = createContext({ notify: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (message, type = 'success') => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, type }])
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <p>{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="bg-transparent px-1 py-0 text-base leading-none text-slate-500 hover:bg-transparent hover:text-slate-900"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}