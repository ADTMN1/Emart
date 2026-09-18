import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  getOptimizedImageUrl,
  getImageSrcSet,
  getImageSizesAttr,
  getImageDimensions,
  getPlaceholderImage,
  type ImageSize,
} from '@/lib/imageOptimization'

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Image URL (can be Supabase Storage or regular URL) */
  src: string | undefined | null
  /** Alt text for accessibility */
  alt: string
  /** Size preset for optimization */
  size?: ImageSize
  /** Context for responsive sizing */
  context?: 'card' | 'detail' | 'thumbnail'
  /** Whether to lazy load (default: true) */
  lazy?: boolean
  /** Whether this is a priority/LCP image (disables lazy loading) */
  priority?: boolean
  /** Show loading shimmer effect */
  showShimmer?: boolean
  /** Aspect ratio class (e.g., 'aspect-square') */
  aspectRatio?: string
  /** Custom dimensions (overrides size preset) */
  width?: number
  height?: number
  /** Callback when image loads */
  onLoadComplete?: () => void
  /** Callback when image fails to load */
  onError?: (error: React.SyntheticEvent<HTMLImageElement>) => void
  /** Additional container classes */
  containerClassName?: string
}

/**
 * OptimizedImage Component
 * 
 * Automatically optimizes images for performance:
 * - Uses Supabase Storage transformations for appropriately-sized images
 * - Supports WebP with JPEG fallback
 * - Implements lazy loading for below-the-fold images
 * - Provides loading shimmer effect
 * - Prevents layout shift with explicit dimensions
 * - Generates responsive srcset
 * - Handles image errors gracefully
 * 
 * @example
 * // Product card image
 * <OptimizedImage
 *   src={product.imageUrl}
 *   alt={product.name}
 *   size="medium"
 *   context="card"
 *   lazy
 * />
 * 
 * @example
 * // Hero/LCP image (no lazy loading)
 * <OptimizedImage
 *   src={heroImage}
 *   alt="Hero"
 *   size="large"
 *   priority
 *   showShimmer
 * />
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  size = 'medium',
  context = 'card',
  lazy = true,
  priority = false,
  showShimmer = true,
  aspectRatio = 'aspect-square',
  width,
  height,
  onLoadComplete,
  onError,
  className,
  containerClassName,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false)
  const [hasError, setHasError] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)

  // Determine loading strategy
  const shouldLazyLoad = lazy && !priority
  const loading = shouldLazyLoad ? 'lazy' : 'eager'
  const fetchPriority = priority ? 'high' : 'auto'

  // Get optimized URL and srcset
  const optimizedSrc = React.useMemo(() => {
    return getOptimizedImageUrl(src, size, true) || getPlaceholderImage()
  }, [src, size])

  const srcSet = React.useMemo(() => {
    if (!src || context === 'thumbnail') return undefined
    // Generate srcset for responsive loading (thumbnail context uses a fixed
    // small src so it keeps downloading the 200px variant, not the 400w one).
    return getImageSrcSet(src, ['small', 'medium', 'large'])
  }, [src, context])

  const sizes = React.useMemo(() => {
    return getImageSizesAttr(context)
  }, [context])

  // Get dimensions for layout shift prevention
  const dimensions = React.useMemo(() => {
    if (width && height) {
      return { width, height }
    }
    return getImageDimensions(size)
  }, [size, width, height])

  // Handle image load
  const handleLoad = React.useCallback(() => {
    setIsLoaded(true)
    setHasError(false)
    onLoadComplete?.()
  }, [onLoadComplete])

  // Handle image error
  const handleError = React.useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true)
    setIsLoaded(false)
    onError?.(e)
    
    // Set fallback placeholder
    if (imgRef.current) {
      imgRef.current.src = getPlaceholderImage(dimensions.width, dimensions.height)
    }
  }, [onError, dimensions])

  // Preload priority images
  React.useEffect(() => {
    if (priority && src && !isLoaded) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = optimizedSrc
      if (srcSet) {
        link.setAttribute('imagesrcset', srcSet)
        link.setAttribute('imagesizes', sizes)
      }
      document.head.appendChild(link)

      return () => {
        document.head.removeChild(link)
      }
    }
  }, [priority, src, optimizedSrc, srcSet, isLoaded])

  return (
    <div className={cn('relative overflow-hidden', aspectRatio, containerClassName)}>
      {/* Loading shimmer */}
      {showShimmer && !isLoaded && !hasError && (
        <div className="absolute inset-0 shimmer animate-shimmer" />
      )}

      {/* Actual image */}
      <img
        ref={imgRef}
        src={optimizedSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={dimensions.width}
        height={dimensions.height}
        loading={loading}
        decoding="async"
        {...(priority && { fetchpriority: fetchPriority as any })}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          !isLoaded && 'opacity-0',
          isLoaded && 'opacity-100',
          className
        )}
        {...props}
      />

      {/* Error state overlay */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-sm">
          No Image
        </div>
      )}
    </div>
  )
}

/**
 * Hook to get optimized image URL without rendering a component
 * Useful for background images or custom implementations
 */
export function useOptimizedImage(
  url: string | undefined | null,
  size: ImageSize = 'medium'
): string {
  return React.useMemo(() => {
    return getOptimizedImageUrl(url, size, true) || getPlaceholderImage()
  }, [url, size])
}
