import * as React from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  X,
  ChevronDown,
  MapPin,
  Store,
  Heart,
  LogOut,
  Package,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/contexts/LanguageContext'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

export const Navbar: React.FC = () => {
  const { t } = useLanguage()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null)
  const [cartCount, setCartCount] = React.useState(0)
  const location = useLocation()
  const navigate = useNavigate()

  React.useEffect(() => {
    const loadCartCount = async () => {
      if (!isAuthenticated || !user) {
        setCartCount(0)
        ;(window as any).__emartCartCount = 0
        return
      }

      try {
        const cart = await api.get<{ items?: Array<{ quantity?: number }> } | null>('/cart').catch(() => null)
        const items = Array.isArray(cart?.items) ? cart.items : []
        const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
        setCartCount(total)
        ;(window as any).__emartCartCount = total
      } catch {
        setCartCount(0)
        ;(window as any).__emartCartCount = 0
      }
    }

    loadCartCount()

    const handleCartUpdate = (event?: Event) => {
      const customEvent = event as CustomEvent<{ total?: number }> | undefined
      const incomingTotal = customEvent?.detail?.total
      if (typeof incomingTotal === 'number') {
        setCartCount(incomingTotal)
        ;(window as any).__emartCartCount = incomingTotal
        return
      }
      loadCartCount()
    }

    window.addEventListener('cart:updated', handleCartUpdate)
    return () => {
      window.removeEventListener('cart:updated', handleCartUpdate)
    }
  }, [isAuthenticated, user?.id])

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  React.useEffect(() => {
    setMobileOpen(false)
    setOpenDropdown(null)
  }, [location])

  const handleDropdownToggle = (label: string) => {
    setOpenDropdown(openDropdown === label ? null : label)
  }

  const handleDropdownMouseEnter = (label: string) => {
    setOpenDropdown(label)
  }

  const handleDropdownMouseLeave = () => {
    setOpenDropdown(null)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  const navLinks = [
    { to: '/marketplace', label: t('navbar.marketplace'), icon: Store },
    { to: '/', label: t('navbar.shopGlobal'), icon: MapPin, hasDropdown: true },
    { to: '/categories', label: t('navbar.categories'), icon: ChevronDown, hasDropdown: true },
  ]

  const marketplaces = [
    { name: t('marketplaces.mercari'), to: '/marketplace?source=mercari' },
    { name: t('marketplaces.yahooAuctions'), to: '/marketplace?source=yahoo' },
    { name: t('marketplaces.rakuten'), to: '/marketplace?source=rakuten' },
    { name: t('marketplaces.amazon'), to: '/marketplace?source=amazon' },
    { name: t('marketplaces.ebay'), to: '/marketplace?source=ebay' },
  ]

  const categoryLinks = [
    { name: t('categories.electronics'), to: '/marketplace?cat=electronics' },
    { name: t('categories.fashion'), to: '/marketplace?cat=fashion' },
    { name: t('categories.watches'), to: '/marketplace?cat=watches' },
    { name: t('categories.collectibles'), to: '/marketplace?cat=collectibles' },
    { name: t('categories.figures'), to: '/marketplace?cat=figures' },
    { name: t('categories.beauty'), to: '/marketplace?cat=beauty' },
    { name: t('categories.homeLiving'), to: '/marketplace?cat=home' },
    { name: t('categories.sports'), to: '/marketplace?cat=sports' },
  ]

  // Debug logging
  React.useEffect(() => {
    console.log('[Navbar] Auth state:', { isLoading, isAuthenticated, hasUser: !!user });
  }, [isLoading, isAuthenticated, user]);

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 w-full transition-all duration-300',
          scrolled
            ? 'bg-[#F5F8FC]/95 backdrop-blur-md border-b border-border shadow-sm'
            : 'bg-[#F5F8FC] border-b border-border/50',
        )}
      >
        <div className="container-page">
          <div className="flex h-16 lg:h-20 items-center justify-between gap-4">
            <div className="flex items-center gap-2 lg:gap-8 shrink-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden -ml-1.5 p-2 rounded-md hover:bg-muted text-foreground"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <Link to="/" className="flex items-center gap-2 shrink-0 group">
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary text-white shadow-md group-hover:shadow-lg group-hover:bg-primary-600 transition-all">
                  <span className="font-display font-extrabold text-lg">E</span>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
                    EMART
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase">
                    Global Proxy
                  </span>
                </div>
              </Link>

              <nav className="hidden lg:flex items-center gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon
                  const isOpen = openDropdown === link.label
                  const menuItems = link.label === 'Shop Global' ? marketplaces : link.label === 'Categories' ? categoryLinks : []
                  
                  return (
                    <div
                      key={link.to + link.label}
                      className="relative"
                      onMouseEnter={() => link.hasDropdown && handleDropdownMouseEnter(link.label)}
                      onMouseLeave={handleDropdownMouseLeave}
                    >
                      <button
                        onClick={() => link.hasDropdown ? handleDropdownToggle(link.label) : navigate(link.to)}
                        className={cn(
                          'relative flex items-center gap-1.5 px-3.5 h-10 font-semibold text-sm transition-colors rounded-lg w-full',
                          location.pathname === link.to
                            ? 'text-primary bg-primary-50'
                            : 'text-foreground/80 hover:text-primary hover:bg-muted',
                        )}
                      >
                        {link.label}
                        {link.hasDropdown && (
                          <ChevronDown className={cn('h-3.5 w-3.5 opacity-70 transition-transform', isOpen && 'rotate-180')} />
                        )}
                      </button>
                      
                      {link.hasDropdown && isOpen && (
                        <div className="absolute top-full left-0 mt-1 w-56 bg-[#F5F8FC] border border-border rounded-xl shadow-lg py-2 z-50">
                          {menuItems.map((item) => (
                            <Link
                              key={item.name}
                              to={item.to}
                              className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground/80 hover:text-primary hover:bg-primary-50 transition-colors"
                              onClick={() => setOpenDropdown(null)}
                            >
                              {item.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </div>

            <div className="hidden md:flex flex-1 max-w-xl">
              <form onSubmit={handleSearch} className="w-full">
                <Input
                  variant="search"
                  placeholder={t('navbar.searchPlaceholder')}
                  leftIcon={<Search className="h-5 w-5" />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  wrapperClassName="max-w-xl"
                />
              </form>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                onClick={() => setSearchOpen(true)
                }
                className="md:hidden p-2.5 rounded-lg hover:bg-muted text-foreground"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>

              <button
                className="hidden sm:flex p-2.5 rounded-lg hover:bg-muted text-foreground relative"
                aria-label="Favorites"
              >
                <Heart className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-secondary text-white flex items-center justify-center">
                  12
                </span>
              </button>

              <Link
                to="/cart"
                className="flex p-2.5 rounded-lg hover:bg-muted text-foreground relative group"
                aria-label="Cart"
              >
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full bg-primary text-white flex items-center justify-center ring-2 ring-background">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </Link>

              {isLoading ? (
                // Loading skeleton
                <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-border">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-16 bg-muted animate-pulse rounded"></div>
                    <div className="h-2 w-12 bg-muted animate-pulse rounded"></div>
                  </div>
                </div>
              ) : isAuthenticated && user ? (
                <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-border relative">
                  <button
                    onClick={() => setUserDropdownOpen((o) => !o)}
                    className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted text-foreground transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
                      {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col items-start leading-none text-left">
                      <span className="text-xs font-semibold text-foreground max-w-[100px] truncate">
                        {user.firstName || user.email.split('@')[0]}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase">{user.role}</span>
                    </div>
                    <ChevronDown className={cn("h-3.5 w-3.5 opacity-70 transition-transform", userDropdownOpen && "rotate-180")} />
                  </button>

                  {userDropdownOpen && (
                    <div
                      className="absolute top-full right-0 mt-2 w-56 bg-[#F5F8FC] border border-border rounded-xl shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-1"
                      onMouseLeave={() => setUserDropdownOpen(false)}
                    >
                      <div className="px-4 py-2 border-b border-border mb-1">
                        <p className="text-xs font-semibold text-foreground truncate">{user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'EMART User'}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Link
                        to="/account"
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-foreground hover:bg-primary-50 hover:text-primary transition-colors"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <User className="h-4 w-4" />
                        Account Settings
                      </Link>
                      <Link
                        to="/orders"
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-foreground hover:bg-primary-50 hover:text-primary transition-colors"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <Package className="h-4 w-4" />
                        My Orders
                      </Link>
                      <Link
                        to="/warehouse"
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-foreground hover:bg-primary-50 hover:text-primary transition-colors"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <Store className="h-4 w-4" />
                        Warehouse Packages
                      </Link>
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false)
                          logout()
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-border">
                    <Link
                      to="/login"
                      className="p-2.5 rounded-lg hover:bg-muted text-foreground"
                      aria-label="Account"
                    >
                      <User className="h-5 w-5" />
                    </Link>
                  </div>

                  <div className="hidden sm:flex sm:flex-col items-start leading-none ml-1">
                    <Link
                      to="/login"
                      className="text-xs font-semibold text-foreground hover:text-primary"
                    >
                      {t('navbar.signIn')}
                    </Link>
                    <Link
                      to="/register"
                      className="text-[11px] text-muted-foreground hover:text-primary"
                    >
                      {t('navbar.joinFree')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div
        className={cn(
          'md:hidden fixed inset-0 z-50 bg-[#F5F8FC] flex flex-col transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary text-white">
              <span className="font-display font-extrabold text-lg">E</span>
            </div>
            <span className="font-display text-xl font-extrabold tracking-tight">EMART</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg hover:bg-muted"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSearch} className="p-4 border-b border-border">
          <Input
            variant="search"
            placeholder={t('navbar.searchPlaceholder')}
            leftIcon={<Search className="h-5 w-5" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <nav className="flex-1 overflow-y-auto p-2">
          {navLinks.map((link) => (
            <NavLink
              key={link.to + link.label + '-mobile'}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3.5 font-semibold text-base rounded-xl transition-colors',
                  isActive
                    ? 'text-primary bg-primary-50'
                    : 'text-foreground hover:bg-muted',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <div className="my-2 border-t border-border" />
          <Link
            to="/cart"
            className="flex items-center justify-between px-4 py-3.5 font-semibold text-base rounded-xl text-foreground hover:bg-muted"
          >
            <span>{t('navbar.cart')}</span>
            <span className="h-5 min-w-5 px-1.5 text-xs font-bold rounded-full bg-primary text-white">
              {cartCount}
            </span>
          </Link>
          <Link
            to="/orders"
            className="flex items-center gap-3 px-4 py-3.5 font-semibold text-base rounded-xl text-foreground hover:bg-muted"
          >
            {t('navbar.myOrders')}
          </Link>
          <Link
            to="/warehouse"
            className="flex items-center gap-3 px-4 py-3.5 font-semibold text-base rounded-xl text-foreground hover:bg-muted"
          >
            {t('navbar.warehouse')}
          </Link>
          <Link
            to="/account"
            className="flex items-center gap-3 px-4 py-3.5 font-semibold text-base rounded-xl text-foreground hover:bg-muted"
          >
            {t('navbar.accountSettings')}
          </Link>
        </nav>

        <div className="p-4 border-t border-border">
          {isAuthenticated && user ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center border border-primary/20">
                  {user.firstName ? user.firstName[0].toUpperCase() : user.email[0].toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-foreground">{user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'EMART User'}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setMobileOpen(false)
                  logout()
                }}
                className="w-full text-destructive border-destructive/20 hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="gap-3 grid grid-cols-2">
              <Button variant="outline" asChild size="lg">
                <Link to="/login">{t('navbar.signIn')}</Link>
              </Button>
              <Button variant="primary" asChild size="lg">
                <Link to="/register">{t('navbar.joinFree')}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setSearchOpen(false)} />
          <form onSubmit={handleSearch} className="relative mx-4 mt-4">
            <Input
              variant="search"
              placeholder={t('navbar.searchPlaceholder')}
              leftIcon={<Search className="h-5 w-5" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </form>
        </div>
      )}
    </>
  )
}
