import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toastStyles: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-white text-emerald-900',
  error: 'border-rose-200 bg-white text-rose-900',
  info: 'border-brand-200 bg-white text-slate-900',
}

const toastIcons = {
  success: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
  error: <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />,
  info: <Info className="h-5 w-5 shrink-0 text-brand-600" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Date.now() + Math.floor(Math.random() * 1000)
      setToasts((current) => [...current, { id, type, message }])
      window.setTimeout(() => removeToast(id), 4500)
    },
    [removeToast],
  )

  const success = useCallback(
    (message: string) => showToast(message, 'success'),
    [showToast],
  )

  const error = useCallback(
    (message: string) => showToast(message, 'error'),
    [showToast],
  )

  const value = useMemo(
    () => ({ showToast, success, error }),
    [showToast, success, error],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[1000] flex flex-col items-end gap-2 sm:left-auto sm:right-6 sm:w-96">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg animate-slide-up ${toastStyles[toast.type]}`}
          >
            {toastIcons[toast.type]}
            <p className="flex-1 leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
