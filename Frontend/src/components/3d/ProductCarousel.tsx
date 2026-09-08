import { ProductCarouselCSS } from './ProductCarouselCSS'

/**
 * Hero product carousel.
 *
 * The CSS implementation avoids loading React Three/Drei at module
 * initialization, where the dependency error occurred before the previous
 * error boundary could render its fallback.
 */
export const ProductCarousel = ProductCarouselCSS
