import React from 'react'
import {
  Truck,
  ShieldCheck,
  Headphones,
  Globe2,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/contexts/LanguageContext'

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
]

export const TopBar: React.FC = () => {
  const { language, setLanguage, t } = useLanguage()
  const [openDropdown, setOpenDropdown] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="hidden md:block bg-primary-900 text-primary-50 border-b border-white/5">
      <div className="container-page">
        <div className="flex h-9 items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-secondary" />
              <span className="font-medium">
                {t('topbar.freeWarehouse')}
              </span>
            </div>
            <div className="h-4 w-px bg-white/15" />
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
              <span className="font-medium">{t('topbar.buyerProtection')}</span>
            </div>
            <div className="h-4 w-px bg-white/15" />
            <div className="flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5 text-secondary" />
              <span className="font-medium">{t('topbar.multilingualSupport')}</span>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setOpenDropdown(!openDropdown)}
                className="flex items-center gap-1.5 hover:text-secondary transition-colors font-medium"
              >
                <Globe2 className="h-3.5 w-3.5" />
                <span suppressHydrationWarning>{languages.find(l => l.code === language)?.name}</span>
                <ChevronDown className={cn('h-3 w-3 transition-transform', openDropdown && 'rotate-180')} />
              </button>
              {openDropdown && (
                <div className="absolute top-full right-0 mt-1 w-48 max-h-64 overflow-y-auto bg-white border border-border rounded-lg shadow-xl py-2 z-50">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code as any)
                        setOpenDropdown(false)
                      }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 text-xs w-full transition-colors',
                        language === lang.code ? 'text-primary bg-primary-50' : 'text-foreground hover:text-primary hover:bg-muted'
                      )}
                    >
                      <span className="text-sm">{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <a href="#help" className="hover:text-secondary transition-colors font-medium">
              {t('topbar.helpCenter')}
            </a>
            <a href="#track" className="hover:text-secondary transition-colors font-medium">
              {t('topbar.trackOrder')}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
