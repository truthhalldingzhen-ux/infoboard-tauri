import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'

interface ToastData {
  message: string
  color?: string
  bg?: string
  duration?: number
}

interface ToastItem {
  id: number
  message: string
  color?: string
  bg?: string
}

let toastId = 0

export default function GlobalToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (data: ToastData) => {
      const id = ++toastId
      setToasts((prev) => {
        const next = [...prev, { id, message: data.message, color: data.color, bg: data.bg }]
        return next.length > 3 ? next.slice(-3) : next
      })
      setTimeout(() => removeToast(id), data.duration || 4000)
    },
    [removeToast]
  )

  useEffect(() => {
    const handler = (e: Event) => {
      addToast((e as CustomEvent).detail as ToastData)
    }
    window.addEventListener('toast-show', handler)
    return () => window.removeEventListener('toast-show', handler)
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass-card flex items-center gap-3 px-4 py-2.5 min-w-[280px] max-w-[420px] animate-slide-up text-sm"
          style={{ borderColor: toast.color || 'var(--border-glass)' }}
        >
          <span className="flex-1 text-text-primary">{toast.message}</span>
          <button
            className="p-0.5 rounded hover:bg-bg-surface-hover transition-colors"
            onClick={() => removeToast(toast.id)}
          >
            <X size={14} className="text-text-muted" />
          </button>
        </div>
      ))}
    </div>
  )
}
