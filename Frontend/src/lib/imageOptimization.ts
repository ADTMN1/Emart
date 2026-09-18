/**
 * Image Optimization Utilities for EMART
 * 
 * Leverages Supabase Storage image transformations to deliver optimally-sized images
 * for different contexts (thumbnails, cards, detail views) with WebP support.
 * 
 * Transformation URLs use the /storage/v1/render/image/ endpoint, which the
 * project's Supabase service verifiably serves. The raw /storage/v1/object/public/
 * endpoint ignores width/quality/format parameters and must not be used for the
 * normal product-image pipeline.
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
 * Predefined image sizes for consistent usage across the app.
 *
 * Each preset requests a square box with `resize=contain`: the service scales the
 * source down to fit that box while preserving aspect ratio and never upscales
 * (intrinsic dimensions are respected server-side). Display components apply their
 * own CSS object-cover crop, so the rendered result matches the original layout
 * exactly — no distortion, no incorrect cropping, no upscale of small sources.
 */
export const IMAGE_SIZES: Record<ImageSize, ImageTransformOptions> = {
  // Thumbnail: 200x200 - For tiny previews (gallery thumbs, recommendations)
  thumb: {
    width: 200,
    height: 200,
    quality: 75,
    resize: 'contain',
  },
  // Small: 400x400 - For small previews on mobile / compact cards
  small: {
    width: 400,
    height: 400,
    quality: 75,
    resize: 'contain',
  },
  // Medium: 600x600 - For product cards
  medium: {
    width: 600,
    height: 600,
    quality: 75,
    resize: 'contain',
  },
  // Large: 900x900 - For product detail main image
  large: {
    width: 900,
    height: 900,
    quality: 75,
    resize: 'contain',
  },
  // Full: 1200x1200 - High-resolution master (detail zoom, preload)
  full: {
    width: 1200,
    height: 1200,
    quality: 80,
    resize: 'contain',
  },
}

const OBJECT_PUBLIC = '/storage/v1/object/public/'
const RENDER_PUBLIC = '/storage/v1/render/image/public/'

/**
 * Check if a URL is a Supabase Storage URL that supports transformations.
 * Recognizes both the raw object endpoint and the render endpoint.
 */
export function isSupabaseStorageUrl(url: string): boolean {
  if (!url) return false
  try {
    const urlObj = new URL(url)
    return (
      urlObj.hostname.includes('supabase') &&
      (url.includes(OBJECT_PUBLIC) || url.includes(RENDER_PUBLIC))
    )
  } catch {
    return false
  }
}

/**
 * Check if a URL is already a Supabase render/transformation URL.
 */
export function isSupabaseRenderUrl(url: string): boolean {
  if (!url) return false
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.includes('supabase') && url.includes(RENDER_PUBLIC)
  } catch {
    return false
  }
}

/**
 * Build transformation query params for Supabase Storage.
 * Insertion order is fixed so that identical options always produce the exact
 * same URL string (stable browser/CDN cache keys).
 */
function buildTransformParams(options: ImageTransformOptions, useWebP: boolean): string {
  const params = new URLSearchParams()

  if (options.width) params.set('width', options.width.toString())
  if (options.height) params.set('height', options.height.toString())
  if (options.resize) params.set('resize', options.resize)
  if (options.quality) params.set('quality', options.quality.toString())

  const wantsWebP = options.format ? options.format === 'webp' : useWebP
  if (wantsWebP) params.set('format', 'webp')

  return params.toString()
}

/**
 * Convert a raw object URL to a render URL with the requested transformations.
 * The host/base is derived from the input URL — never hardcoded.
 *
 * An object URL like:
 *   https://<project>.supabase.co/storage/v1/object/public/products/<path>
 * becomes:
 *   https://<project>.supabase.co/storage/v1/render/image/public/products/<path>?width=..&height=..&resize=contain&quality=..&format=webp
 */
function buildRenderUrl(
  url: string,
  options: ImageTransformOptions,
  useWebP: boolean
): string {
  const base = url.split('?')[0].replace(OBJECT_PUBLIC, RENDER_PUBLIC)
  return `${base}?${buildTransformParams(options, useWebP)}`
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
 * // Returns: https://...supabase.co/storage/v1/render/image/public/products/abc.jpg?width=600&height=600&resize=contain&quality=75&format=webp
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

  // If not a Supabase URL, return original (local assets, external URLs,
  // data: placeholders, invalid/empty URLs all pass through untouched).
  if (!isSupabaseStorageUrl(url)) {
    return url
  }

  // If the URL is already a render URL, return it unchanged — never transform
  // an already-transformed image (avoids /render/render/ nests and conflicting
  // query parameters).
  if (isSupabaseRenderUrl(url)) {
    return url
  }

  return buildRenderUrl(url, IMAGE_SIZES[size], useWebP)
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
  if (isSupabaseRenderUrl(url)) return url

  return buildRenderUrl(url, options, true)
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
  if (!url || !isSupabaseStorageUrl(url) || isSupabaseRenderUrl(url)) return ''

  const first = getOptimizedImageUrl(url, sizes[0] || 'medium', true)
  if (first === url) return ''

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
      // Product detail main image: full width on mobile, ~2/5 column on desktop
      return '(max-width: 768px) 92vw, (max-width: 1280px) 45vw, 520px'
    case 'thumbnail':
      // Thumbnails: fixed small size (w-16 on mobile, w-20 on desktop)
      return '(min-width: 1024px) 80px, 64px'
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
 * Get image dimensions from size preset (square fallback for layout reserve)
 */
export function getImageDimensions(size: ImageSize): { width: number; height: number } {
  const config = IMAGE_SIZES[size]
  const width = config.width || 600
  return {
    width,
    height: config.height || width,
  }
}
