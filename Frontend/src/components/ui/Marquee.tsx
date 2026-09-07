import * as React from 'react'
import { cn } from '@/lib/utils'

interface MarqueeProps {
  children: React.ReactNode
  className?: string
  speed?: 'slow' | 'normal' | 'fast'
  pauseOnHover?: boolean
}

export const Marquee: React.FC<MarqueeProps> = ({
  children,
  className,
  speed = 'normal',
  pauseOnHover = true,
}) => {
  const speedMap = {
    slow: '50s',
    normal: '30s',
    fast: '20s',
  }

  const duration = speedMap[speed]

  return (
    <div className={cn('group relative flex overflow-hidden', className)}>
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        .marquee-content {
          animation: scroll ${duration} linear infinite;
        }
        .group:hover .marquee-content {
          animation-play-state: ${pauseOnHover ? 'paused' : 'running'};
        }
      `}</style>
      <div className="marquee-content flex shrink-0 min-w-full items-center justify-around">
        {children}
      </div>
      <div className="marquee-content flex shrink-0 min-w-full items-center justify-around" aria-hidden="true">
        {children}
      </div>
    </div>
  )
}
