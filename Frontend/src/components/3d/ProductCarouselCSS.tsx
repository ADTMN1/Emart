import * as React from 'react'
import { cn } from '@/lib/utils'

interface Product {
  id: string
  name: string
  image: string
  price: string
  category: string | { id: string; name: string }
}

interface ProductCarouselCSSProps {
  products?: Product[]
}

export const ProductCarouselCSS: React.FC<ProductCarouselCSSProps> = ({ products = [] }) => {
  const [rotation, setRotation] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [startX, setStartX] = React.useState(0)
  const [currentRotation, setCurrentRotation] = React.useState(0)
  const [autoRotate, setAutoRotate] = React.useState(true)
  const autoRotateRef = React.useRef<number>()

  React.useEffect(() => {
    if (autoRotate && !isDragging && products.length > 0) {
      autoRotateRef.current = window.setInterval(() => {
        setRotation((prev) => prev + 0.5)
      }, 30)
    } else {
      if (autoRotateRef.current) {
        window.clearInterval(autoRotateRef.current)
      }
    }

    return () => {
      if (autoRotateRef.current) {
        window.clearInterval(autoRotateRef.current)
      }
    }
  }, [autoRotate, isDragging, products.length])

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setAutoRotate(false)
    setStartX(e.clientX)
    setCurrentRotation(rotation)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    const diff = e.clientX - startX
    const rotationChange = diff * 0.3
    setRotation(currentRotation + rotationChange)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    setAutoRotate(false)
    setStartX(e.touches[0].clientX)
    setCurrentRotation(rotation)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const diff = e.touches[0].clientX - startX
    const rotationChange = diff * 0.3
    setRotation(currentRotation + rotationChange)
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  const displayProducts = products.length > 0 ? products : []
  const angleStep = displayProducts.length > 0 ? 360 / displayProducts.length : 60
  const radius = 250

  if (displayProducts.length === 0) {
    return null
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <style>{`
        .perspective-container {
          perspective: 1200px;
          perspective-origin: center center;
        }
        
        .carousel-3d {
          transform-style: preserve-3d;
          transition: transform ${isDragging ? '0s' : '0.6s'} cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .carousel-item {
          transform-style: preserve-3d;
          backface-visibility: hidden;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .carousel-item:hover {
          transform: scale(1.15) translateZ(40px) !important;
        }
        
        .product-card-3d {
          transform-style: preserve-3d;
          transition: all 0.3s ease;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        }
        
        .product-card-3d:hover {
          box-shadow: 0 20px 60px rgba(79, 70, 229, 0.3);
        }

        .product-card-3d::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          background: linear-gradient(135deg, rgba(79, 70, 229, 0.3), rgba(251, 191, 36, 0.3));
          opacity: 0;
          transition: opacity 0.3s ease;
          z-index: -1;
        }

        .product-card-3d:hover::before {
          opacity: 1;
        }

        @media (max-width: 1024px) {
          .perspective-container {
            perspective: 900px;
          }
        }

        @media (max-width: 768px) {
          .perspective-container {
            perspective: 700px;
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .carousel-item {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>

      <div className="perspective-container w-full h-full flex items-center justify-center">
        <div
          className="carousel-3d relative w-full h-[450px] md:h-[500px] cursor-grab active:cursor-grabbing touch-none"
          style={{
            transform: `rotateY(${rotation}deg)`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {displayProducts.map((product, index) => {
            const angle = angleStep * index
            const x = Math.sin((angle * Math.PI) / 180) * radius
            const z = Math.cos((angle * Math.PI) / 180) * radius

            return (
              <div
                key={product.id}
                className="carousel-item absolute top-1/2 left-1/2"
                style={{
                  transform: `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${-angle}deg)`,
                  animationDelay: `${index * 0.5}s`,
                }}
              >
                <div className="product-card-3d bg-[#F5F8FC] rounded-xl overflow-hidden w-[160px] md:w-[180px] border border-gray-100 hover:border-primary-300 relative">
                  <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      draggable="false"
                    />
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#F5F8FC]/90 backdrop-blur-sm text-[10px] font-bold text-primary-700 shadow-sm">
                        {typeof product.category === 'string' ? product.category : product.category?.name || ''}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-[#F5F8FC]">
                    <h3 className="font-bold text-xs text-gray-900 mb-1 line-clamp-1">
                      {product.name}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-primary-600">
                        {product.price}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 md:px-4 py-1.5 md:py-2 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] md:text-xs font-medium shadow-lg">
        {autoRotate ? 'Drag to control • Auto-rotating' : 'Drag to rotate'}
      </div>

      <button
        onClick={() => setAutoRotate(!autoRotate)}
        className="absolute top-4 right-4 px-2.5 md:px-3 py-1 md:py-1.5 rounded-lg bg-[#F5F8FC]/90 hover:bg-[#F5F8FC] backdrop-blur-sm text-[10px] md:text-xs font-bold text-gray-700 shadow-lg transition-colors"
      >
        {autoRotate ? 'Pause' : 'Play'}
      </button>

      {displayProducts.length > 1 && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {displayProducts.map((_, index) => {
            const targetRotation = -(angleStep * index)
            const normalizedRotation = ((rotation % 360) + 360) % 360
            const normalizedTarget = ((targetRotation % 360) + 360) % 360
            const diff = Math.abs(normalizedRotation - normalizedTarget)
            const isActive = diff < angleStep / 2 || diff > 360 - angleStep / 2

            return (
              <button
                key={index}
                onClick={() => {
                  setRotation(targetRotation)
                  setAutoRotate(false)
                }}
                className={cn(
                  'transition-all duration-300 rounded-full',
                  isActive
                    ? 'bg-white w-6 h-2'
                    : 'bg-white/40 hover:bg-white/60 w-2 h-2',
                )}
                aria-label={`Go to product ${index + 1}`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
