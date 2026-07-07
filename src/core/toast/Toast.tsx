import { useEffect, useState, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { X } from 'lucide-react'

interface ToastPayload {
  message: string
  level: string
}

interface ToastItem {
  id: number
  message: string
  level: 'info' | 'error' | 'success'
}

let toastId = 0

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (payload: ToastPayload) => {
      const id = ++toastId
      const level: 'info' | 'error' | 'success' =
        payload.level === 'error' || payload.level === 'success' ? payload.level : 'info'
      setToasts((prev) => {
        const next: ToastItem[] = [...prev, { id, message: payload.message, level }]
        return next.length > 3 ? next.slice(-3) : next
      })
      setTimeout(() => removeToast(id), 4000)
    },
    [removeToast]
  )

  useEffect(() => {
    const unlisten = listen<ToastPayload>('toast_show', (event) => {
      addToast(event.payload)
    })
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            glass-card flex items-center gap-3 px-4 py-2.5 min-w-[280px] max-w-[420px]
            animate-slide-up text-sm
            ${toast.level === 'error' ? 'border-red-500/30' : ''}
            ${toast.level === 'success' ? 'border-green-500/30' : ''}
          `}
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
