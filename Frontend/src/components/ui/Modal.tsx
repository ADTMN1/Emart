import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  footer?: React.ReactNode
  hideClose?: boolean
  onBodyScroll?: React.UIEventHandler<HTMLDivElement>
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-screen-xl',
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
  hideClose = false,
  onBodyScroll,
}) => {
  React.useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative w-full bg-background rounded-2xl shadow-2xl border border-border animate-slide-up',
          'max-h-[90vh] flex flex-col overflow-hidden',
          sizeClasses[size],
        )}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between p-6 pb-4 border-b border-border/60">
            <div className="flex-1 pr-4">
              {title && (
                <h2 className="text-xl font-bold tracking-tight">{title}</h2>
              )}
              {description && (
                <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {!hideClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="shrink-0 -m-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin" onScroll={onBodyScroll}>
          {children}
        </div>
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-6 pt-4 border-t border-border/60 bg-muted/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
