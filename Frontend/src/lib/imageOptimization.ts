/**
 * Image Optimization Utilities for EMART
 * 
 * Leverages Supabase Storage image transformations to deliver optimally-sized images
 * for different contexts (thumbnails, cards, detail views) with WebP support.
 * 
 * Supabase Transform API: https://supabase.com/docs/guides/storage/image-transformations
 */

export interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'origin'
  resize?: 'cover' | 'contain' | 'fill'
}

export type ImageSize = 'thumb' | 'small' | 'medium' | 'large' | 'full'

/**
 * Predefined image sizes for consistent usage across the app
 */
export const IMAGE_SIZES: Record<ImageSize, ImageTransformOptions> = {
  // Thumbnail: 150x150 - For tiny previews, admin lists
  thumb: {
    width: 150,
    height: 150,
    quality: 75,
    resize: 'cover',
  },
  // Small: 400x400 - For product cards on mobile
  small: {
    width: 400,
    height: 400,
    quality: 80,
    resize: 'cover',
  },
  // Medium: 600x600 - For product cards on desktop
  medium: {
    width: 600,
    height: 600,
    quality: 85,
    resize: 'cover',
  },
  // Large: 1000x1000 - For product detail main image
  large: {
    width: 1000,
    height: 1000,
    quality: 90,
    resize: 'cover',
  },
  // Full: 1200x1200 - Original master image, no transformation
  full: {
    width: 1200,
    height: 1200,
    quality: 95,
    resize: 'cover',
  },
}

/**
 * Check if a URL is a Supabase Storage URL that supports transformations
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false
  try {
    const urlObj = new URL(url)
    // Supabase storage URLs contain 'supabase' and '/storage/v1/object/public/'
    return urlObj.hostname.includes('supabase') && url.includes('/storage/v1/object/public/')
  } catch {
    return false
  }
}

/**
 * Build transformation query params for Supabase Storage
 */
function buildTransformParams(options: ImageTransformOptions): string {
  const params = new URLSearchParams()

  if (options.width) params.set('width', options.width.toString())
  if (options.height) params.set('height', options.height.toString())
  if (options.quality) params.set('quality', options.quality.toString())
  if (options.format) params.set('format', options.format)
  if (options.resize) params.set('resize', options.resize)

  return params.toString()
}

/**
 * Transform a Supabase Storage URL to request an optimized version
 * 
 * @param url - Original Supabase Storage URL
 * @param size - Predefined size preset
 * @param useWebP - Whether to request WebP format (defaults to true if supported)
 * @returns Transformed URL with query parameters
 * 
 * @example
 * getOptimizedImageUrl(url, 'medium', true)
 * // Returns: https://...supabase.co/storage/v1/object/public/products/abc.jpg?width=600&height=600&quality=85&format=webp
 */
export function getOptimizedImageUrl(
  url: string | undefined | null,
  size: ImageSize = 'medium',
  useWebP: boolean = true
): string {
  // Return placeholder if no URL
  if (!url) {
    return getPlaceholderImage()
  }

  // If not a Supabase URL, return original
  if (!isSupabaseStorageUrl(url)) {
    return url
  }

  // Get size configuration
  const sizeConfig = IMAGE_SIZES[size]
  
  // Build transform options
  const transformOptions: ImageTransformOptions = {
    ...sizeConfig,
    // Use WebP if supported by browser and requested
    format: useWebP && supportsWebP() ? 'webp' : 'origin',
  }

  // Build query string
  const transformParams = buildTransformParams(transformOptions)
  
  // Append or update query params
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${transformParams}`
}

/**
 * Get optimized URL with custom dimensions
 */
export function getOptimizedImageUrlCustom(
  url: string | undefined | null,
  options: ImageTransformOptions
): string {
  if (!url) return getPlaceholderImage()
  if (!isSupabaseStorageUrl(url)) return url

  const transformOptions: ImageTransformOptions = {
    ...options,
    format: options.format || (supportsWebP() ? 'webp' : 'origin'),
  }

  const transformParams = buildTransformParams(transformOptions)
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${transformParams}`
}

/**
 * Generate srcset for responsive images
 * 
 * @param url - Original image URL
 * @param sizes - Array of sizes to generate
 * @returns srcset string for use in <img> element
 * 
 * @example
 * <img
 *   src={getOptimizedImageUrl(url, 'medium')}
 *   srcSet={getImageSrcSet(url, ['small', 'medium', 'large'])}
 *   sizes="(max-width: 640px) 400px, (max-width: 1024px) 600px, 1000px"
 * />
 */
export function getImageSrcSet(
  url: string | undefined | null,
  sizes: ImageSize[] = ['small', 'medium', 'large']
): string {
  if (!url || !isSupabaseStorageUrl(url)) return ''

  return sizes
    .map(size => {
      const config = IMAGE_SIZES[size]
      const optimizedUrl = getOptimizedImageUrl(url, size, true)
      return `${optimizedUrl} ${config.width}w`
    })
    .join(', ')
}

/**
 * Get appropriate sizes attribute for responsive images
 */
export function getImageSizesAttr(context: 'card' | 'detail' | 'thumbnail'): string {
  switch (context) {
    case 'card':
      // Product cards: 2-4 columns depending on screen size
      return '(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 300px'
    case 'detail':
      // Product detail: full width on mobile, half on desktop
      return '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 600px'
    case 'thumbnail':
      // Thumbnails: fixed small size
      return '150px'
    default:
      return '100vw'
  }
}

/**
 * Check WebP support
 * Cached result to avoid repeated checks
 */
let webpSupported: boolean | null = null

export function supportsWebP(): boolean {
  if (webpSupported !== null) return webpSupported

  // Server-side rendering check
  if (typeof window === 'undefined') {
    webpSupported = false
    return false
  }

  // Check if browser supports WebP
  const canvas = document.createElement('canvas')
  if (canvas.getContext && canvas.getContext('2d')) {
    // Check if toDataURL returns a WebP string
    webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  } else {
    webpSupported = false
  }

  return webpSupported
}

/**
 * Placeholder image for missing/broken images
 */
export function getPlaceholderImage(width: number = 600, height: number = 600): string {
  return `data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22${width}%22%20height%3D%22${height}%22%20viewBox%3D%220%200%20${width}%20${height}%22%3E%3Crect%20fill%3D%22%23f3f4f6%22%20width%3D%22${width}%22%20height%3D%22${height}%22%2F%3E%3Ctext%20fill%3D%22%239ca3af%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E`
}

/**
 * Preload critical images for LCP optimization
 * 
 * @param url - Image URL to preload
 * @param size - Size preset to preload
 * 
 * @example
 * // In page component
 * useEffect(() => {
 *   preloadImage(heroImageUrl, 'large')
 * }, [heroImageUrl])
 */
export function preloadImage(url: string, size: ImageSize = 'large'): void {
  if (typeof window === 'undefined' || !url) return

  const optimizedUrl = getOptimizedImageUrl(url, size, true)
  
  // Create link element for preload
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = optimizedUrl
  
  // Add to head
  document.head.appendChild(link)
}

/**
 * Get image dimensions from size preset
 */
export function getImageDimensions(size: ImageSize): { width: number; height: number } {
  const config = IMAGE_SIZES[size]
  return {
    width: config.width || 600,
    height: config.height || 600,
  }
}
