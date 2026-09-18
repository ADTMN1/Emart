import * as React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  Gift,
  Headphones,
  Home as HomeIcon,
  LogOut,
  MapPin,
  Package,
  Store,
  Truck,
  User,
  Wallet as WalletIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface SellerApplicationState {
  id: string
  storeName: string
  storeDescription: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  rejectionReason?: string | null
  submittedAt?: string
  reviewedAt?: string | null
}

export interface AccountOutletContext {
  sellerApp: SellerApplicationState | null
  sellerProfile: SellerApplicationState | null
  sellerLoading: boolean
  refreshSeller: () => Promise<void>
}

interface NavItem {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  match: (path: string) => boolean
}

const navItems: NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: User,
    path: '/account',
    match: (p) => p === '/account' || p.startsWith('/account/overview'),
  },
  { key: 'orders', label: 'My Orders', icon: Package, path: '/orders', match: (p) => p.startsWith('/orders') },
  {
    key: 'wallet',
    label: 'My Wallet',
    icon: WalletIcon,
    path: '/account/wallet',
    match: (p) => p.startsWith('/account/wallet'),
  },
  { key: 'shipping', label: 'Shipments', icon: Truck, path: '/shipping', match: (p) => p.startsWith('/shipping') },
  {
    key: 'addresses',
    label: 'Addresses',
    icon: MapPin,
    path: '/account/addresses',
    match: (p) => p.startsWith('/account/addresses'),
  },
  {
    key: 'payments',
    label: 'Payment Methods',
    icon: CreditCard,
    path: '/account/payments',
    match: (p) => p.startsWith('/account/payments'),
  },
  {
    key: 'notifications',
    label: 'Notifications',
    icon: Bell,
    path: '/account/notifications',
    match: (p) => p.startsWith('/account/notifications'),
  },
  {
    key: 'seller',
    label: 'Become a Seller',
    icon: Store,
    path: '/account/seller',
    match: (p) => p.startsWith('/account/seller'),
  },
  {
    key: 'usdcPolicy',
    label: 'USDC Policy',
    icon: FileText,
    path: '/account/usdc-policy',
    match: (p) => p.startsWith('/account/usdc-policy'),
  },
  { key: 'support', label: 'Support & FAQ', icon: Headphones, path: '/account/support', match: (p) => p.startsWith('/account/support') },
]

/**
 * Persistent Account/Store shell. One sidebar shared by every Account page,
 * My Orders, Warehouse, Shipments, Wallet, and the /seller Store area — the
 * page only swaps the main content column. The seller slot keeps the red
 * accent and derives its label ("Become a Seller" / "Seller Application" /
 * "Store") from the real backend application status.
 */
export const AccountLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const path = location.pathname

  // Seller application state is shared by the sidebar label and the Account
  // "seller" tab, so it lives here and is passed down via Outlet context.
  // It is fetched ONLY on seller-area routes (/account/seller and /seller/*);
  // unrelated account pages (profile, orders, shipping, wallet, notifications)
  // no longer trigger seller resources they don't need.
  const [sellerApp, setSellerApp] = React.useState<SellerApplicationState | null>(null)
  const [sellerProfile, setSellerProfile] = React.useState<SellerApplicationState | null>(null)
  const [sellerLoading, setSellerLoading] = React.useState(true)

  const isSellerArea = path.startsWith('/account/seller') || path.startsWith('/seller')

  const refreshSeller = React.useCallback(async () => {
    try {
      setSellerLoading(true)
      const [app, profile] = await Promise.all([
        api.get<SellerApplicationState | null>('/seller/application'),
        api.get<SellerApplicationState | null>('/seller/profile').catch(() => null),
      ])
      setSellerApp(app ?? null)
      setSellerProfile(profile ?? null)
    } catch {
      setSellerApp(null)
      setSellerProfile(null)
    } finally {
      setSellerLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (!isSellerArea) {
      setSellerLoading(false)
      return
    }
    refreshSeller()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSellerArea])

  // Keep the seller navigation label in sync with real backend status on
  // seller routes — e.g. approval happening in another tab updates
  // "Become a Seller" → "Store" on the next window focus, without re-login.
  // Non-seller account routes do not re-fetch seller data on focus.
  React.useEffect(() => {
    if (!isSellerArea) return
    const onFocus = () => {
      refreshSeller()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshSeller, isSellerArea])

  const sellerActive = sellerApp?.status === 'APPROVED' || sellerApp?.status === 'SUSPENDED'

  const crumbs = React.useMemo(() => {
    const acc: Array<{ label: string; to?: string }> = [{ label: 'My Account' }]
    if (path === '/account') return acc
    if (path.startsWith('/account/overview')) acc.push({ label: 'Overview' })
    else if (path.startsWith('/account/wallet')) acc.push({ label: 'My Wallet' })
    else if (path.startsWith('/account/addresses')) acc.push({ label: 'Addresses' })
    else if (path.startsWith('/account/payments')) acc.push({ label: 'Payment Methods' })
    else if (path.startsWith('/account/notifications')) acc.push({ label: 'Notifications' })
    else if (path.startsWith('/account/usdc-policy')) acc.push({ label: 'USDC Policy' })
    else if (path.startsWith('/account/seller')) acc.push({ label: sellerActive ? 'Store' : 'Seller' })
    else if (path.startsWith('/account/support')) acc.push({ label: 'Support & FAQ' })
    else if (path.startsWith('/orders')) {
      acc.push({ label: 'My Orders', to: '/orders' })
      if (path !== '/orders') acc.push({ label: 'Order Details' })
    } else if (path.startsWith('/shipping')) acc.push({ label: 'Shipping & Tracking' })
    else if (path.startsWith('/seller')) {
      if (sellerActive) acc.push({ label: 'Store', to: '/seller' })
      const seg = path.split('/')[2]
      acc.push({ label: seg === 'products' ? 'Products' : seg === 'store' ? 'Store Settings' : 'Seller Dashboard' })
    }
    return acc
  }, [path, sellerActive])

  const context = React.useMemo<AccountOutletContext>(
    () => ({ sellerApp, sellerProfile, sellerLoading, refreshSeller }),
    [sellerApp, sellerProfile, sellerLoading, refreshSeller],
  )

  const userDisplayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Customer'
    : 'Valued Customer'
  const userInitials = user
    ? (user.firstName ? user.firstName[0] : user.email[0]).toUpperCase()
    : 'U'

  return (
    <div className="bg-background">
      <div className="container-page py-6 border-b border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary flex items-center gap-1">
            <HomeIcon className="h-3 w-3" />Home
          </Link>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="h-3 w-3" />
              {c.to ? (
                <Link to={c.to} className="hover:text-primary">
                  {c.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="container-page py-6 lg:py-8 grid lg:grid-cols-5 gap-6 lg:gap-8">
        {/* Sidebar — persistent across every Account/Store page. */}
        <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-24 self-start">
          <Card>
            <CardContent className="p-5 flex items-center gap-3 border-b border-border/60">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary-600 text-white font-bold flex items-center justify-center text-lg">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold truncate">{userDisplayName}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email || 'Guest'}</div>
                <div className="mt-1 flex items-center gap-1">
                  <Badge variant="accent" size="xs" className="gap-1">
                    <Gift className="h-2.5 w-2.5" />
                    {user?.role || 'Customer'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <nav className="p-2">
                {navItems.map((n) => {
                  const Icon = n.icon
                  const isSellerItem = n.key === 'seller'
                  // Approved/suspended: "Store" is the red-accented deep link
                  // into the seller area; otherwise it stays an Account tab.
                  const label = isSellerItem
                    ? sellerActive
                      ? 'Store'
                      : sellerApp?.status === 'PENDING'
                        ? 'Seller Application'
                        : 'Become a Seller'
                    : n.label
                  const href = isSellerItem ? (sellerActive ? '/seller' : '/account/seller') : n.path
                  const sellerMatchesStore = isSellerItem && sellerActive && path.startsWith('/seller')
                  const active = isSellerItem ? sellerMatchesStore || path.startsWith('/account/seller') : n.match(path)
                  const Inner = (
                    <>
                      <Icon className="h-4.5 w-4.5" />
                      <span className="font-medium text-sm">{label}</span>
                      {active && (
                        <ChevronRight
                          className={cn('h-3.5 w-3.5 ml-auto', isSellerItem ? 'text-destructive' : 'text-primary')}
                        />
                      )}
                    </>
                  )
                  const cls = cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors',
                    isSellerItem
                      ? active
                        ? 'bg-destructive/10 text-destructive font-semibold'
                        : 'text-destructive hover:bg-destructive/10 hover:text-destructive'
                      : active
                        ? 'bg-primary-50 text-primary font-semibold'
                        : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                  )
                  return (
                    <Link key={n.key} to={href} className={cls}>
                      {Inner}
                    </Link>
                  )
                })}
              </nav>
              <div className="p-2 border-t border-border/60">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="h-4.5 w-4.5" />
                  <span className="font-medium text-sm">Sign Out</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Page content — only this column changes between routes. */}
        <div className="lg:col-span-4 min-w-0">
          <Outlet context={context} />
        </div>
      </div>
    </div>
  )
}

export default AccountLayout