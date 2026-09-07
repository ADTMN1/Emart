import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react'

type ToastVariant = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

const variants: Record<ToastVariant, { icon: React.FC<{ className?: string }>; classes: string }> = {
  success: {
    icon: CheckCircle2,
    classes: 'bg-success text-success-foreground',
  },
  error: {
    icon: AlertCircle,
    classes: 'bg-destructive text-destructive-foreground',
  },
  info: {
    icon: Info,
    classes: 'bg-info text-info-foreground',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-warning text-warning-foreground',
  },
}

const ToastContext = React.createContext<{
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
} | null>(null)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = React.useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
    if (toast.duration !== 0) {
      setTimeout(() => removeToast(id), toast.duration || 4000)
    }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const variant = variants[toast.variant || 'info']
  const Icon = variant.icon
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl shadow-xl border animate-slide-up pointer-events-auto',
        'bg-card border-border',
      )}
    >
      <div className="flex items-start gap-3 p-4 pr-10">
        <div className={cn(
          'p-1.5 rounded-lg shrink-0',
          toast.variant === 'success' && 'bg-success/15 text-success',
          toast.variant === 'error' && 'bg-destructive/15 text-destructive',
          toast.variant === 'warning' && 'bg-warning/15 text-warning',
          (!toast.variant || toast.variant === 'info') && 'bg-info/15 text-info',
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{toast.description}</p>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export const useToast = () => {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return {
    toast: ctx.addToast,
    dismiss: ctx.removeToast,
  }
}
