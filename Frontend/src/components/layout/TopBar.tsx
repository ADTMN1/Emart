import React from 'react'
import {
  Truck,
  ShieldCheck,
  Headphones,
  Globe2,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const TopBar: React.FC = () => {
  return (
    <div className="hidden md:block bg-primary-900 text-primary-50 border-b border-white/5">
      <div className="container-page">
        <div className="flex h-9 items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-secondary" />
              <span className="font-medium">
                Free 45-day warehouse storage
              </span>
            </div>
            <div className="h-4 w-px bg-white/15" />
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
              <span className="font-medium">100% Buyer Protection</span>
            </div>
            <div className="h-4 w-px bg-white/15" />
            <div className="flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 text-secondary" />
              <span className="font-medium">24/7 Multilingual Support</span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <button className="flex items-center gap-1.5 hover:text-secondary transition-colors font-medium">
              <Globe2 className="h-3.5 w-3.5" />
              <span>English / USD</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            <a href="#help" className="hover:text-secondary transition-colors font-medium">
              Help Center
            </a>
            <a href="#track" className="hover:text-secondary transition-colors font-medium">
              Track Order
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
