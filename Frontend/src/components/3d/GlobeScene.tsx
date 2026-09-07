import * as React from 'react'
import { Package } from 'lucide-react'

// CSS-based animated globe scene (no Three.js dependency)
export const GlobeScene: React.FC = () => {
  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 opacity-20" />
      
      {/* Globe */}
      <div className="relative">
        {/* Main globe circle */}
        <div className="w-64 h-64 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 shadow-2xl relative overflow-hidden animate-pulse">
          {/* Rotating gradient overlay for 3D effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/20 animate-spin-slow" style={{ animationDuration: '20s' }} />
          
          {/* Continents (simplified shapes) */}
          <div className="absolute top-1/4 left-1/4 w-16 h-12 bg-green-600/40 rounded-full blur-sm" />
          <div className="absolute top-1/3 right-1/4 w-12 h-8 bg-green-600/40 rounded-lg blur-sm" />
          <div className="absolute bottom-1/3 left-1/3 w-14 h-10 bg-green-600/40 rounded-full blur-sm" />
          
          {/* Latitude/longitude lines */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/10 transform scale-90" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/10 transform scale-90" />
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 w-64 h-64 rounded-full bg-blue-400/20 blur-xl animate-pulse" />
        
        {/* Orbiting markers */}
        <div className="absolute inset-0 w-64 h-64 animate-spin-slow" style={{ animationDuration: '15s' }}>
          {/* Origin marker (Japan) */}
          <div className="absolute top-[30%] right-[20%] w-3 h-3 bg-red-500 rounded-full shadow-lg shadow-red-500/50 animate-ping" />
          <div className="absolute top-[30%] right-[20%] w-3 h-3 bg-red-500 rounded-full" />
        </div>
        
        <div className="absolute inset-0 w-64 h-64 animate-spin-slow" style={{ animationDuration: '18s' }}>
          {/* Destination marker */}
          <div className="absolute bottom-[35%] left-[25%] w-3 h-3 bg-green-500 rounded-full shadow-lg shadow-green-500/50 animate-ping" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-[35%] left-[25%] w-3 h-3 bg-green-500 rounded-full" />
        </div>
        
        {/* Flying package */}
        <div className="absolute inset-0 w-64 h-64 animate-spin-slow" style={{ animationDuration: '10s' }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="bg-orange-500 text-white p-2 rounded-lg shadow-xl shadow-orange-500/30 animate-bounce">
              <Package className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats overlay */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span>Origin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Destination</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-orange-500 rounded-full" />
          <span>In Transit</span>
        </div>
      </div>
    </div>
  )
}
