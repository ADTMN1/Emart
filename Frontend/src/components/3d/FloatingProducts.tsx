import * as React from 'react'
import { Camera, Headphones, Gamepad2, Watch, Package } from 'lucide-react'

// CSS-based 3D product showcase (no Three.js required)
export const FloatingProducts: React.FC = () => {
  return (
    <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Product Cards arranged in 3D space effect */}
      <div className="relative h-full flex items-center justify-center p-8">
        <div className="grid grid-cols-3 gap-8 max-w-4xl">
          {/* Camera - Top Left */}
          <div 
            className="group relative"
            style={{
              transform: 'perspective(1000px) rotateY(-15deg) translateZ(20px)',
              animation: 'float 6s ease-in-out infinite',
              animationDelay: '0s'
            }}
          >
            <div className="relative bg-[#F5F8FC] rounded-2xl p-8 shadow-2xl border border-gray-100 transition-all duration-500 hover:shadow-3xl hover:scale-105">
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                NEW
              </div>
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform duration-500">
                <Camera className="w-12 h-12 text-white" />
              </div>
              <div className="mt-4 text-center">
                <div className="text-sm font-bold text-gray-800">Camera</div>
                <div className="text-xs text-gray-500 mt-1">¥45,000</div>
              </div>
            </div>
          </div>

          {/* Headphones - Top Center */}
          <div 
            className="group relative"
            style={{
              transform: 'perspective(1000px) translateZ(50px)',
              animation: 'float 6s ease-in-out infinite',
              animationDelay: '1s'
            }}
          >
            <div className="relative bg-[#F5F8FC] rounded-2xl p-8 shadow-2xl border border-gray-100 transition-all duration-500 hover:shadow-3xl hover:scale-105">
              <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                HOT
              </div>
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-red-700 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform duration-500">
                <Headphones className="w-12 h-12 text-white" />
              </div>
              <div className="mt-4 text-center">
                <div className="text-sm font-bold text-gray-800">Headphones</div>
                <div className="text-xs text-gray-500 mt-1">¥38,880</div>
              </div>
            </div>
          </div>

          {/* Gaming Console - Top Right */}
          <div 
            className="group relative"
            style={{
              transform: 'perspective(1000px) rotateY(15deg) translateZ(20px)',
              animation: 'float 6s ease-in-out infinite',
              animationDelay: '2s'
            }}
          >
            <div className="relative bg-[#F5F8FC] rounded-2xl p-8 shadow-2xl border border-gray-100 transition-all duration-500 hover:shadow-3xl hover:scale-105">
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                SALE
              </div>
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform duration-500">
                <Gamepad2 className="w-12 h-12 text-white" />
              </div>
              <div className="mt-4 text-center">
                <div className="text-sm font-bold text-gray-800">Console</div>
                <div className="text-xs text-gray-500 mt-1">¥52,000</div>
              </div>
            </div>
          </div>

          {/* Watch - Bottom Left */}
          <div 
            className="group relative col-start-1"
            style={{
              transform: 'perspective(1000px) rotateY(-10deg) translateZ(10px)',
              animation: 'float 6s ease-in-out infinite',
              animationDelay: '3s'
            }}
          >
            <div className="relative bg-[#F5F8FC] rounded-2xl p-8 shadow-2xl border border-gray-100 transition-all duration-500 hover:shadow-3xl hover:scale-105">
              <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                ⭐
              </div>
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-600 to-yellow-700 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform duration-500">
                <Watch className="w-12 h-12 text-white" />
              </div>
              <div className="mt-4 text-center">
                <div className="text-sm font-bold text-gray-800">Watch</div>
                <div className="text-xs text-gray-500 mt-1">¥45,000</div>
              </div>
            </div>
          </div>

          {/* Collectible - Bottom Right */}
          <div 
            className="group relative col-start-3"
            style={{
              transform: 'perspective(1000px) rotateY(10deg) translateZ(10px)',
              animation: 'float 6s ease-in-out infinite',
              animationDelay: '4s'
            }}
          >
            <div className="relative bg-[#F5F8FC] rounded-2xl p-8 shadow-2xl border border-gray-100 transition-all duration-500 hover:shadow-3xl hover:scale-105">
              <div className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                RARE
              </div>
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:rotate-12 transition-transform duration-500">
                <Package className="w-12 h-12 text-white" />
              </div>
              <div className="mt-4 text-center">
                <div className="text-sm font-bold text-gray-800">Collectible</div>
                <div className="text-xs text-gray-500 mt-1">¥78,000</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Live from Japan</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>Verified Sellers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <span>Authentic Products</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateZ(var(--tz, 0px));
          }
          50% {
            transform: translateY(-20px) translateZ(var(--tz, 0px));
          }
        }
      `}</style>
    </div>
  )
}
