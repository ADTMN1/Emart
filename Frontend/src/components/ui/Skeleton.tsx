import * as React from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        className
      )}
    />
  )
}

export const CategorySkeleton: React.FC = () => {
  return (
    <div className="group flex flex-col items-center p-4 lg:p-5 rounded-2xl bg-gray-50 border border-border">
      <Skeleton className="h-12 w-12 lg:h-14 lg:w-14 rounded-2xl mb-3" />
      <Skeleton className="h-4 w-16 mb-1" />
      <Skeleton className="h-3 w-12" />
    </div>
  )
}

export const ProductListSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

export const HeroSkeleton: React.FC = () => {
  return (
    <div className="relative overflow-hidden min-h-[600px] lg:min-h-[700px] bg-gradient-to-br from-primary-100 to-secondary-100 animate-pulse">
      <div className="container-page relative py-16 lg:py-24">
        <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
          <Skeleton className="h-8 w-48 mx-auto rounded-full" />
          <Skeleton className="h-16 w-full max-w-2xl mx-auto" />
          <Skeleton className="h-6 w-full max-w-xl mx-auto" />
          <div className="pt-4">
            <Skeleton className="h-14 w-full max-w-2xl mx-auto rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
