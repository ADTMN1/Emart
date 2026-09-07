import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, children, ...props }, ref) => {
    return (
      <div className={cn('relative w-full', wrapperClassName)}>
        <select
          ref={ref}
          className={cn(
            'w-full h-11 rounded-lg border border-input bg-background text-sm text-foreground',
            'pl-4 pr-10 py-2 appearance-none cursor-pointer',
            'transition-all duration-200',
            'focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/15',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    )
  },
)
Select.displayName = 'Select'
