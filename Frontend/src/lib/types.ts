export interface Product {
  id: string
  name: string
  image?: string
  images?: string[]
  productImages?: ProductImage[]
  price: number
  estimatedPriceUsd: number
  condition: 'New' | 'Like New' | 'Very Good' | 'Good' | 'Acceptable' | string
  seller: string
  sellerType: 'Shop' | 'Individual' | string
  source: 'Marketplace A' | 'Marketplace B' | 'Marketplace C' | 'Marketplace D' | 'Marketplace E' | string
  domesticShipping: number
  internationalShippingUsd: number
  serviceFee: number
  description: string
  category?: string | Category
  categoryId?: string
  tags: string[]
  isNew?: boolean
  isBestSeller?: boolean
  rating?: number
  reviewCount?: number
}

export interface ProductImage {
  id: string
  productId: string
  path: string
  url: string
  isPrimary: boolean
  sortOrder: number
  createdAt: string
}

export interface Category {
  id: string
  name: string
  icon: string
  count?: number
  color?: string
}
