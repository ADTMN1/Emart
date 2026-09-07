import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  Loader2,
  PackageX,
  SearchX,
  AlertTriangle,
  ShoppingCart,
  Heart,
  Inbox,
  CircleCheckBig,
} from 'lucide-react'
import { Button } from './Button'

interface LoadingProps extends React.HTMLAttributes<HTMLDivElement> {
  text?: string
  size?: 'sm' | 'md' | 'lg'
}

export const Loading: React.FC<LoadingProps> = ({ text, size = 'md', className, ...props }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground',
        className,
      )}
      {...props}
    >
      <Loader2 className={cn('animate-spin text-primary', sizes[size])} />
      {text && <p className="text-sm font-medium">{text}</p>}
    </div>
  )
}

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => (
  <div
    className={cn('rounded-md bg-muted animate-pulse', className)}
    {...props}
  />
)

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-20 px-4 text-center',
        className,
      )}
    >
      <div className="mb-6 p-5 rounded-2xl bg-muted">
        <div className={cn('text-muted-foreground')}>
          {icon || <Inbox className="h-10 w-10" />}
        </div>
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="md">
          {action.label}
        </Button>
      )}
    </div>
  )
}

export const EmptyCart: React.FC<{ onShop?: () => void }> = ({ onShop }) => (
  <EmptyState
    icon={<ShoppingCart className="h-10 w-10" />}
    title="Your cart is empty"
    description="Looks like you haven't added any items yet. Start exploring and add items to your cart!"
    action={onShop ? { label: 'Browse Marketplace', onClick: onShop } : undefined}
  />
)

export const EmptyFavorites: React.FC = () => (
  <EmptyState
    icon={<Heart className="h-10 w-10" />}
    title="No favorites yet"
    description="Save products you love for later by clicking the heart icon on any product card."
  />
)

export const NoSearchResults: React.FC<{ query?: string; onClear?: () => void }> = ({ query, onClear }) => (
  <EmptyState
    icon={<SearchX className="h-10 w-10" />}
    title={query ? `No results for "${query}"` : 'No results found'}
    description="Try adjusting your search terms or browse our categories instead."
    action={onClear ? { label: 'Clear filters', onClick: onClear } : undefined}
  />
)

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  description = 'We encountered an unexpected error. Please try again.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-20 px-4 text-center',
        className,
      )}
    >
      <div className="mb-6 p-5 rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-10 w-10 text-destructive" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} size="md">
          Try again
        </Button>
      )}
    </div>
  )
}

interface SuccessStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export const SuccessState: React.FC<SuccessStateProps> = ({
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-20 px-4 text-center',
        className,
      )}
    >
      <div className="mb-6 p-5 rounded-2xl bg-success/10">
        <CircleCheckBig className="h-10 w-10 text-success" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} size="md">
          {action.label}
        </Button>
      )}
    </div>
  )
}

export const ProductCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-border bg-card overflow-hidden">
    <Skeleton className="aspect-square rounded-none" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between items-end pt-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  </div>
)

export const EmptyOrders: React.FC<{ onBrowse?: () => void }> = ({ onBrowse }) => (
  <EmptyState
    icon={<PackageX className="h-10 w-10" />}
    title="No orders yet"
    description="Start shopping and your orders will appear here for tracking and management."
    action={onBrowse ? { label: 'Start Shopping', onClick: onBrowse } : undefined}
  />
)
