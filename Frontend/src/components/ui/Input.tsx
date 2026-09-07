import * as React from 'react'
import { cn } from '@/lib/utils'
import { Search, Link } from 'lucide-react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  variant?: 'default' | 'search' | 'url'
  wrapperClassName?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftIcon, rightIcon, variant = 'default', wrapperClassName, id, ...props }, ref) => {
    const inputId = id || React.useId()
    return (
      <div className={cn('relative w-full', wrapperClassName)}>
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={cn(
            'w-full rounded-lg border border-input bg-background text-sm',
            'text-foreground placeholder:text-muted-foreground/70',
            'transition-all duration-200',
            'focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/15',
            'disabled:cursor-not-allowed disabled:opacity-50',
            leftIcon ? 'pl-11' : 'pl-4',
            rightIcon ? 'pr-11' : 'pr-4',
            variant === 'search' && 'h-14 rounded-xl text-base',
            variant === 'url' && 'h-14 rounded-xl text-base pl-12',
            variant !== 'default' && variant !== 'search' && variant !== 'url' ? 'h-11' : !leftIcon && !rightIcon ? 'h-11' : '',
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            {rightIcon}
          </div>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export const SearchInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'variant' | 'leftIcon'>>(
  (props, ref) => (
    <Input ref={ref} variant="search" leftIcon={<Search className="h-5 w-5" />} {...props} />
  ),
)
SearchInput.displayName = 'SearchInput'

export const UrlInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'variant' | 'leftIcon'>>(
  (props, ref) => (
    <Input ref={ref} variant="url" leftIcon={<Link className="h-5 w-5" />} {...props} />
  ),
)
UrlInput.displayName = 'UrlInput'
