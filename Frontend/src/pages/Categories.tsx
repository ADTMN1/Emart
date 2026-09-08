import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Smartphone,
  Shirt,
  Watch,
  Star,
  Gamepad2,
  Sparkles,
  Home as HomeIcon,
  Dumbbell,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { categories, products } from '@/data/mockData'
import { cn, formatNumber } from '@/lib/utils'

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  smartphone: Smartphone,
  shirt: Shirt,
  watch: Watch,
  star: Star,
  'gamepad-2': Gamepad2,
  sparkles: Sparkles,
  home: HomeIcon,
  dumbbell: Dumbbell,
}

const subcategories: Record<string, { name: string; count: number }[]> = {
  electronics: [
    { name: 'Headphones & Audio', count: 45823 },
    { name: 'Smartphones', count: 38412 },
    { name: 'Cameras & Lenses', count: 28734 },
    { name: 'Laptops & Tablets', count: 24521 },
    { name: 'Video Games', count: 32109 },
    { name: 'Retro Gaming', count: 18934 },
  ],
  fashion: [
    { name: "Women's Clothing", count: 67823 },
    { name: "Men's Clothing", count: 52341 },
    { name: 'Designer Bags', count: 18934 },
    { name: 'Sneakers', count: 34521 },
    { name: 'Traditional Kimono', count: 5623 },
    { name: 'Accessories', count: 23421 },
  ],
  watches: [
    { name: 'Seiko', count: 18923 },
    { name: 'Casio G-Shock', count: 15643 },
    { name: 'Grand Seiko', count: 5234 },
    { name: 'Citizen', count: 8932 },
    { name: 'Vintage Watches', count: 12834 },
    { name: 'Luxury Brands', count: 6252 },
  ],
  collectibles: [
    { name: 'Pokémon Cards', count: 32841 },
    { name: 'Magic: The Gathering', count: 12834 },
    { name: 'Vintage Coins', count: 5234 },
    { name: 'Baseball Cards', count: 8923 },
    { name: 'Rare Vinyl Records', count: 12834 },
    { name: 'Memorabilia', count: 23000 },
  ],
  figures: [
    { name: 'Figma', count: 28472 },
    { name: 'Nendoroid', count: 34210 },
    { name: 'Scale Figures', count: 28934 },
    { name: 'Gunpla Models', count: 32873 },
    { name: 'Studio Ghibli', count: 15623 },
    { name: 'Vintage Toys', count: 16778 },
  ],
  beauty: [
    { name: 'Skincare', count: 45823 },
    { name: 'Makeup', count: 28471 },
    { name: 'Hair Care', count: 18734 },
    { name: 'Fragrance', count: 12834 },
    { name: 'Beauty Tools', count: 9876 },
    { name: 'Mens Grooming', count: 8829 },
  ],
  home: [
    { name: 'Kitchenware', count: 28934 },
    { name: 'Furniture', count: 12834 },
    { name: 'Traditional Crafts', count: 8934 },
    { name: 'Tea Sets', count: 5623 },
    { name: 'Bedding', count: 12847 },
    { name: 'Lighting', count: 10000 },
  ],
  sports: [
    { name: 'Running', count: 18934 },
    { name: 'Baseball', count: 12834 },
    { name: 'Snowboarding', count: 8934 },
    { name: 'Fishing', count: 7234 },
    { name: 'Cycling', count: 8934 },
    { name: 'Yoga & Fitness', count: 16545 },
  ],
}

const Categories: React.FC = () => {
  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1">
            <HomeIcon className="h-3 w-3" />
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">All Categories</span>
        </div>
        <div className="mt-4">
          <h1 className="font-display text-2xl lg:text-4xl font-extrabold tracking-tight">
            Browse All Categories
          </h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Explore every product category available from global marketplaces. From vintage watches to the latest collectibles — find your next treasure.
          </p>
        </div>
      </div>

      <div className="container-page py-10 space-y-12">
        {categories.map((cat, catIdx) => {
          const Icon = iconMap[cat.icon] || Star
          const categoryProducts = products.filter((_, i) => i % 4 === catIdx % 4 || i === catIdx)
          const subs = subcategories[cat.id] || []

          return (
            <section key={cat.id} className="scroll-mt-24" id={cat.id}>
              <div className="relative rounded-3xl border border-border/60 bg-[#F5F8FC] p-8 shadow-lg hover:shadow-2xl transition-all duration-500 mb-6 overflow-hidden group">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -mr-32 -mt-32" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-secondary/8 via-secondary/4 to-transparent rounded-full blur-2xl opacity-50" />
                
                {/* Accent border glow on hover */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ padding: '1px' }} />
                
                <div className="relative flex items-end justify-between gap-6 flex-wrap">
                  <div className="flex items-start gap-5">
                    {/* Enhanced icon container with gradient */}
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 blur-xl group-hover:blur-2xl transition-all duration-500" />
                      <div
                        className={cn(
                          'relative h-16 w-16 lg:h-20 lg:w-20 rounded-2xl flex items-center justify-center shrink-0 shadow-xl ring-4 ring-[#F5F8FC] transition-all duration-300 group-hover:scale-110 group-hover:rotate-3',
                          cat.color,
                        )}
                      >
                        <Icon className="h-8 w-8 lg:h-10 lg:w-10 transition-transform duration-300 group-hover:scale-110" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        <h2 className="font-display text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
                          {cat.name}
                        </h2>
                        <Badge 
                          variant="outline" 
                          size="sm" 
                          className="shadow-md bg-[#F5F8FC] border-primary/30 font-extrabold text-primary px-3 py-1 hover:bg-primary hover:text-white transition-all duration-300"
                        >
                          {formatNumber(cat.count)} items
                        </Badge>
                      </div>
                      
                      {/* Subcategories with enhanced styling */}
                      <div className="flex flex-wrap gap-2">
                        {subs.slice(0, 6).map((s) => (
                          <Link
                            key={s.name}
                            to={`/marketplace?cat=${cat.id}&sub=${encodeURIComponent(s.name)}`}
                            className="group/sub px-3 py-1.5 rounded-lg bg-surface/80 backdrop-blur-sm hover:bg-primary text-xs font-semibold text-foreground/80 hover:text-white transition-all duration-300 border border-border/50 hover:border-primary hover:shadow-lg hover:scale-105 active:scale-95"
                          >
                            <span className="block">{s.name}</span>
                            <span className="text-[10px] text-muted-foreground group-hover/sub:text-white/80 transition-colors">
                              {(s.count / 1000).toFixed(1)}K
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* View all button with enhanced design */}
                  <Link
                    to={`/marketplace?cat=${cat.id}`}
                    className="hidden md:inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-white transition-all duration-300 group/btn px-5 py-2.5 rounded-xl bg-primary-50 hover:bg-primary border-2 border-primary/30 hover:border-primary shadow-md hover:shadow-xl active:scale-95"
                  >
                    <span>View all</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
                {categoryProducts.slice(0, 4).map((p) => (
                  <div key={p.id} className="group">
                    <Link
                      to={`/product/${p.id}`}
                      className="block rounded-xl overflow-hidden border border-border bg-card hover:shadow-card-hover hover:border-primary-300 transition-all"
                    >
                      <div className="aspect-square bg-muted overflow-hidden">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="p-3.5">
                        <h3 className="text-sm font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                          {p.name}
                        </h3>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="font-bold text-foreground">
                            ${p.estimatedPriceUsd}
                          </span>
                          <Badge variant="outline" size="sm">
                            {p.source}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="md"
                className="md:hidden mt-4 w-full"
                asChild
              >
                <Link to={`/marketplace?cat=${cat.id}`}>
                  View all {cat.name}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export default Categories
