import * as React from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link' | 'accent'
type Size = 'sm' | 'md' | 'lg' | 'xl' | 'icon'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  asChild?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-600 focus-visible:ring-primary/50 shadow-sm disabled:bg-primary-300',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary-600 focus-visible:ring-secondary/50 shadow-sm disabled:bg-secondary-300',
  accent:
    'bg-accent text-accent-foreground hover:bg-amber-400 focus-visible:ring-accent/50 shadow-sm disabled:bg-amber-200',
  outline:
    'border border-border bg-background text-foreground hover:bg-muted hover:border-primary-300 focus-visible:ring-primary/30',
  ghost:
    'bg-transparent text-foreground hover:bg-muted focus-visible:ring-primary/30',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-red-600 focus-visible:ring-destructive/50 shadow-sm disabled:bg-red-300',
  link:
    'bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4.5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
  xl: 'h-14 px-8 text-base gap-2.5',
  icon: 'h-10 w-10 p-0',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={cn(
          'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'active:scale-[0.98]',
          'disabled:pointer-events-none disabled:opacity-60',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    )
  },
)

Button.displayName = 'Button'
