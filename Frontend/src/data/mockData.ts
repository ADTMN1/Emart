export interface Product {
  id: string
  name: string
  image: string
  images: string[]
  price: number
  estimatedPriceUsd: number
  condition: 'New' | 'Like New' | 'Very Good' | 'Good' | 'Acceptable'
  seller: string
  sellerType: 'Shop' | 'Individual'
  source: 'Marketplace A' | 'Marketplace B' | 'Marketplace C' | 'Marketplace D' | 'Marketplace E'
  domesticShipping: number
  internationalShippingUsd: number
  serviceFee: number
  description: string
  category: string
  tags: string[]
  isNew?: boolean
  isBestSeller?: boolean
  rating?: number
  reviewCount?: number
}

export interface Category {
  id: string
  name: string
  icon: string
  count: number
  color: string
}

export const categories: Category[] = [
  { id: 'electronics', name: 'Electronics', icon: 'smartphone', count: 248593, color: 'bg-blue-50 text-blue-600' },
  { id: 'fashion', name: 'Fashion', icon: 'shirt', count: 189432, color: 'bg-rose-50 text-rose-600' },
  { id: 'watches', name: 'Watches', icon: 'watch', count: 67821, color: 'bg-amber-50 text-amber-600' },
  { id: 'collectibles', name: 'Collectibles', icon: 'star', count: 95672, color: 'bg-purple-50 text-purple-600' },
  { id: 'figures', name: 'Anime & Figures', icon: 'gamepad-2', count: 156890, color: 'bg-pink-50 text-pink-600' },
  { id: 'beauty', name: 'Beauty & Cosmetics', icon: 'sparkles', count: 124567, color: 'bg-fuchsia-50 text-fuchsia-600' },
  { id: 'home', name: 'Home & Living', icon: 'home', count: 89234, color: 'bg-emerald-50 text-emerald-600' },
  { id: 'sports', name: 'Sports & Outdoors', icon: 'dumbbell', count: 73421, color: 'bg-teal-50 text-teal-600' },
]

const img = (seed: string, w = 600, h = 600) =>
  `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encodeURIComponent(seed)}&image_size=square_hd`

export const products: Product[] = [
  {
    id: 'p1',
    name: 'Vintage Seiko Automatic Chronograph Watch - Silver Dial',
    image: img('vintage seiko automatic chronograph watch silver dial product photo white background professional lighting', 600, 600),
    images: [
      img('vintage seiko automatic chronograph watch silver dial product photo white background professional lighting', 800, 800),
      img('seiko chronograph watch side view macro product photography', 800, 800),
      img('seiko watch bracelet clasp close up detail shot', 800, 800),
    ],
    price: 45000,
    estimatedPriceUsd: 310,
    condition: 'Very Good',
    seller: 'Watch Collector',
    sellerType: 'Individual',
    source: 'Marketplace A',
    domesticShipping: 520,
    internationalShippingUsd: 18,
    serviceFee: 3150,
    description: 'A beautiful vintage Seiko chronograph with automatic movement. Featuring a stunning silver sunburst dial with applied indices, this timepiece is in excellent working condition. Recently serviced and comes with original box.',
    category: 'watches',
    tags: ['Vintage', 'Seiko', 'Automatic', 'Chronograph'],
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 127,
  },
  {
    id: 'p2',
    name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones - Black',
    image: img('sony wh 1000xm5 wireless noise cancelling headphones black studio product photo', 600, 600),
    images: [
      img('sony wh 1000xm5 wireless noise cancelling headphones black studio product photo', 800, 800),
      img('sony headphones side profile view high quality product shot', 800, 800),
      img('sony headphones case and accessories flat lay', 800, 800),
    ],
    price: 38880,
    estimatedPriceUsd: 268,
    condition: 'New',
    seller: 'Electronics Official Store',
    sellerType: 'Shop',
    source: 'Marketplace C',
    domesticShipping: 0,
    internationalShippingUsd: 22,
    serviceFee: 2722,
    description: 'Industry-leading noise cancellation with the new Integrated Processor V1 and QN1 HD processor. 8 mic system for unprecedented call quality. Up to 30 hours of battery life with quick charging.',
    category: 'electronics',
    tags: ['Sony', 'Headphones', 'Wireless', 'Noise Cancelling'],
    isNew: true,
    rating: 4.8,
    reviewCount: 2891,
  },
  {
    id: 'p3',
    name: 'Studio Ghibli My Neighbor Totoro - Large Plush Doll Authentic',
    image: img('studio ghibli my neighbor totoro large plush doll authentic product photo white background', 600, 600),
    images: [
      img('studio ghibli my neighbor totoro large plush doll authentic product photo white background', 800, 800),
      img('totoro plush with leaf umbrella studio ghibli official merchandise', 800, 800),
    ],
    price: 8900,
    estimatedPriceUsd: 62,
    condition: 'New',
    seller: 'Anime Official Store',
    sellerType: 'Shop',
    source: 'Marketplace D',
    domesticShipping: 300,
    internationalShippingUsd: 15,
    serviceFee: 623,
    description: 'Authentic Studio Ghibli large Totoro plush doll. Made with high quality soft materials. Official licensed product with hologram tag. Approximately 60cm tall.',
    category: 'figures',
    tags: ['Studio Ghibli', 'Totoro', 'Plush', 'Authentic'],
    isBestSeller: true,
    rating: 5.0,
    reviewCount: 682,
  },
  {
    id: 'p4',
    name: 'Shiseido Elixir Superieur Lifting Moisture Cream 45g',
    image: img('shiseido elixir superieur lifting moisture cream 45g luxury skincare product photography white background', 600, 600),
    images: [
      img('shiseido elixir superieur lifting moisture cream 45g luxury skincare product photography white background', 800, 800),
      img('shiseido skincare cream texture swatch close up', 800, 800),
    ],
    price: 6600,
    estimatedPriceUsd: 46,
    condition: 'New',
    seller: 'Beauty Official Store',
    sellerType: 'Shop',
    source: 'Marketplace E',
    domesticShipping: 220,
    internationalShippingUsd: 12,
    serviceFee: 462,
    description: 'Shiseido Elixir Superieur anti-aging moisture cream with concentrated collagen and hyaluronic acid. For radiant, firmer skin with long-lasting hydration.',
    category: 'beauty',
    tags: ['Shiseido', 'Skincare', 'Anti-Aging', 'Beauty'],
    rating: 4.7,
    reviewCount: 1543,
  },
  {
    id: 'p5',
    name: 'Uniqlo U Lemaire Oversized Wool Blend Coat - Camel',
    image: img('uniqlo u lemaire oversized wool blend coat camel color fashion product photo hanger', 600, 600),
    images: [
      img('uniqlo u lemaire oversized wool blend coat camel color fashion product photo hanger', 800, 800),
      img('camel wool coat on model full shot street style', 800, 800),
    ],
    price: 12900,
    estimatedPriceUsd: 89,
    condition: 'Like New',
    seller: 'Fashion Store',
    sellerType: 'Shop',
    source: 'Marketplace A',
    domesticShipping: 800,
    internationalShippingUsd: 32,
    serviceFee: 903,
    description: 'Uniqlo U Lemaire collaboration wool blend oversized coat. Premium wool blend fabric with beautiful drape. Timeless camel color, size M. Worn once, like new condition.',
    category: 'fashion',
    tags: ['Uniqlo', 'Lemaire', 'Wool Coat', 'Designer'],
    rating: 4.6,
    reviewCount: 89,
  },
  {
    id: 'p6',
    name: 'MUJI Wooden Bedside Table - Oak Wood Minimalist Design',
    image: img('muji wooden bedside table oak wood minimalist design product photo lifestyle', 600, 600),
    images: [
      img('muji wooden bedside table oak wood minimalist design product photo lifestyle', 800, 800),
    ],
    price: 7990,
    estimatedPriceUsd: 55,
    condition: 'Very Good',
    seller: 'Home Goods',
    sellerType: 'Shop',
    source: 'Marketplace B',
    domesticShipping: 1200,
    internationalShippingUsd: 45,
    serviceFee: 559,
    description: 'Beautiful MUJI solid oak bedside table. Minimalist design with one drawer. Natural oak finish. Assembled size: W45 × D40 × H55cm.',
    category: 'home',
    tags: ['MUJI', 'Oak Wood', 'Furniture', 'Minimalist'],
    rating: 4.5,
    reviewCount: 267,
  },
  {
    id: 'p7',
    name: 'ASICS GEL-KAYANO 30 Running Shoes - White Blue',
    image: img('asics gel kayano 30 running shoes white blue colorway product photo side view', 600, 600),
    images: [
      img('asics gel kayano 30 running shoes white blue colorway product photo side view', 800, 800),
    ],
    price: 19800,
    estimatedPriceUsd: 137,
    condition: 'New',
    seller: 'Sports Lab Official',
    sellerType: 'Shop',
    source: 'Marketplace C',
    domesticShipping: 500,
    internationalShippingUsd: 28,
    serviceFee: 1386,
    description: '30th anniversary edition of ASICS flagship stability running shoe. Featuring FF Blast Plus Eco cushioning and Dynamic Duomax support system.',
    category: 'sports',
    tags: ['ASICS', 'Running', 'Sports Shoes', 'Kayano'],
    isNew: true,
    rating: 4.8,
    reviewCount: 478,
  },
  {
    id: 'p8',
    name: 'Pokemon Center Limited Edition Charizard VMAX Card - Sealed',
    image: img('pokemon charizard vmax trading card holo sealed pokemon center limited edition product photo', 600, 600),
    images: [
      img('pokemon charizard vmax trading card holo sealed pokemon center limited edition product photo', 800, 800),
    ],
    price: 78000,
    estimatedPriceUsd: 538,
    condition: 'Like New',
    seller: 'Card Master',
    sellerType: 'Individual',
    source: 'Marketplace A',
    domesticShipping: 210,
    internationalShippingUsd: 14,
    serviceFee: 5460,
    description: 'Rare limited edition Charizard VMAX full art holo card. Factory sealed in original sleeve and top loader. Gem Mint condition. Perfect for collectors.',
    category: 'collectibles',
    tags: ['Pokemon', 'Charizard', 'Trading Cards', 'Rare'],
    isBestSeller: true,
    rating: 4.9,
    reviewCount: 56,
  },
]

export const howItWorksSteps = [
  {
    id: 1,
    title: 'Search & Discover',
    description: 'Browse millions of products from global marketplaces. Search by keyword, category, or paste a product URL directly.',
    icon: 'search',
  },
  {
    id: 2,
    title: 'Place Your Order',
    description: 'Add items to your cart and see the full estimated cost including fees and shipping upfront. No hidden charges.',
    icon: 'shopping-cart',
  },
  {
    id: 3,
    title: 'We Purchase for You',
    description: 'Our expert team purchases the items on your behalf and verifies condition upon receipt.',
    icon: 'package-check',
  },
  {
    id: 4,
    title: 'Consolidate & Ship',
    description: 'Store multiple items in our warehouse for free, then consolidate into one shipment for big savings on international shipping.',
    icon: 'plane',
  },
  {
    id: 5,
    title: 'Delivered to Your Door',
    description: 'Track your package every step of the way until it arrives safely at your doorstep worldwide.',
    icon: 'map-pin-check',
  },
]

export const trustFeatures = [
  {
    title: 'Free 45-Day Storage',
    description: 'Keep your items in our warehouse for up to 45 days at no cost while you shop more.',
    icon: 'warehouse',
  },
  {
    title: 'Buyer Protection',
    description: 'Every purchase is covered by our guarantee. If something is wrong, we make it right.',
    icon: 'shield-check',
  },
  {
    title: 'Item Verification',
    description: 'We photograph and inspect every item when it arrives at our warehouse.',
    icon: 'camera',
  },
  {
    title: 'Transparent Pricing',
    description: 'See all fees upfront. No hidden costs, no surprises at checkout.',
    icon: 'receipt',
  },
  {
    title: 'Multiple Payment Methods',
    description: 'Pay with credit card, PayPal, Apple Pay, Google Pay, bank transfer, and more.',
    icon: 'credit-card',
  },
  {
    title: '24/7 Support',
    description: 'Our multilingual customer support team is always ready to help you.',
    icon: 'headphones',
  },
]

export const shippingCarriers = [
  { name: 'EMS', days: '5-8 days', priceFrom: 15 },
  { name: 'DHL', days: '3-5 days', priceFrom: 22 },
  { name: 'FedEx', days: '4-7 days', priceFrom: 20 },
  { name: 'SAL', days: '10-14 days', priceFrom: 10 },
  { name: 'Sea Mail', days: '25-40 days', priceFrom: 8 },
]

export const testimonials = [
  {
    name: 'Sarah M.',
    location: 'New York, USA',
    avatar: 'S',
    rating: 5,
    text: 'EMART made buying vintage watches so easy! The condition report was accurate and my package arrived perfectly packaged in just 6 days.',
  },
  {
    name: 'James L.',
    location: 'London, UK',
    avatar: 'J',
    rating: 5,
    text: 'This is my 5th order with EMART. Their warehouse consolidation saved me so much on shipping. The transparency on pricing is unmatched.',
  },
  {
    name: 'Aiko T.',
    location: 'Berlin, Germany',
    avatar: 'A',
    rating: 5,
    text: 'I bought rare collectible cards and they arrived gem mint. The item verification photos they send gave me complete peace of mind. Highly recommend!',
  },
]
