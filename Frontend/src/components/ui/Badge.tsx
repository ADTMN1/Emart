import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'info' | 'accent' | 'outline'
type Size = 'xs' | 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  size?: Size
  dot?: boolean
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-primary/10 text-primary-700 border-primary/20',
  primary: 'bg-primary text-primary-foreground border-primary',
  secondary: 'bg-secondary/10 text-secondary-700 border-secondary/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning-foreground border-warning/20',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-info/10 text-info border-info/20',
  accent: 'bg-accent/20 text-accent-foreground border-accent/30',
  outline: 'bg-background text-foreground border-border',
}

const sizeClasses: Record<Size, string> = {
  xs: 'h-4 px-1.5 text-[9px] rounded gap-0.5',
  sm: 'h-5 px-1.5 text-[10px] rounded-md gap-1',
  md: 'h-6 px-2.5 text-xs rounded-md gap-1.5',
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  dot,
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold border',
        'leading-none whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {dot && (
        <span className={cn(
          'h-1.5 w-1.5 rounded-full',
          (variant === 'success' || variant === 'primary' || variant === 'default') && 'bg-current',
          variant === 'warning' && 'bg-warning',
          variant === 'destructive' && 'bg-destructive',
          variant === 'info' && 'bg-info',
          variant === 'secondary' && 'bg-secondary',
          variant === 'accent' && 'bg-accent',
          variant === 'outline' && 'bg-foreground',
        )} />
      )}
      {children}
    </span>
  )
}
