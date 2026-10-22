import * as React from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSellerStatus, sellerStatusIsCached } from '@/lib/api';
import {
  AlertCircle,
  BarChart3,
  Boxes,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  ExternalLink,
  FolderCog,
  FolderKanban,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutList,
  LogOut,
  Menu,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  Settings,
  Settings2,
  ShieldCheck,
  Store,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ContentLoader } from '@/components/ui/ContentLoader';
import { cn } from '@/lib/utils';
import { SellerNotificationBell } from './SellerNotificationBell';

interface SellerAppState {
  id: string;
  storeName: string;
  storeDescription: string;
  email?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  rejectionReason?: string | null;
  submittedAt?: string;
  reviewedAt?: string | null;
}

interface SellerProfileState {
  id: string;
  userId: string;
  storeName: string;
  storeDescription: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
}

/** Context provided to every /seller child page by the center layout. */
export interface SellerCenterOutlet {
  profile: SellerProfileState;
  sellerApp: SellerAppState | null;
  sellerError: string | null;
  refreshProfile: (opts?: { silent?: boolean; force?: boolean }) => Promise<void>;
  /**
   * Unread notification count for the signed-in seller. Owned by the layout and
   * driven by the header bell's polling, so pages such as the overview can show
   * the badge value without issuing their own `unread-count` request.
   */
  unreadNotifications: number;
}

type NavLeaf = { kind: 'leaf'; label: string; to: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };
type NavGroup = {
  kind: 'group';
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prefixes: string[];
  children: NavLeaf[];
};
type NavNode = NavGroup | NavLeaf;

const NAV: NavNode[] = [
  { kind: 'leaf', label: 'Overview', to: '/seller', icon: LayoutDashboard, end: true },
  {
    kind: 'group',
    key: 'products',
    label: 'Products',
    icon: FolderKanban,
    prefixes: ['/seller/products'],
    children: [
      { kind: 'leaf', label: 'All Products', to: '/seller/products', icon: LayoutList, end: true },
      { kind: 'leaf', label: 'Add Product', to: '/seller/products/new', icon: PlusCircle },
      { kind: 'leaf', label: 'Inventory', to: '/seller/products/inventory', icon: Boxes },
    ],
  },
  { kind: 'leaf', label: 'Order Requests', to: '/seller/orders/requests', icon: ClipboardList },
  { kind: 'leaf', label: 'Confirmed Orders', to: '/seller/orders/confirmed', icon: CheckSquare },
  { kind: 'leaf', label: 'Messages', to: '/seller/messages', icon: MessageSquare },
  {
    kind: 'group',
    key: 'shop',
    label: 'Shop',
    icon: FolderCog,
    prefixes: ['/seller/shop'],
    children: [
      { kind: 'leaf', label: 'Shop Profile', to: '/seller/shop', icon: Store, end: true },
      { kind: 'leaf', label: 'Logo', to: '/seller/shop/logo', icon: ImageIcon },
      { kind: 'leaf', label: 'Banner', to: '/seller/shop/banner', icon: ImageIcon },
      { kind: 'leaf', label: 'Shop Settings', to: '/seller/shop/settings', icon: Settings2 },
    ],
  },
  { kind: 'leaf', label: 'Sales', to: '/seller/sales', icon: BarChart3 },
  { kind: 'leaf', label: 'Payments', to: '/seller/payments', icon: CreditCard },
  { kind: 'leaf', label: 'Settings', to: '/seller/settings', icon: Settings },
];

const PAGE_LABELS: Array<{ match: (path: string) => boolean; label: string }> = [
  { match: (p) => p === '/seller', label: 'Overview' },
  { match: (p) => p === '/seller/products', label: 'All Products' },
  { match: (p) => p === '/seller/products/new', label: 'Add Product' },
  { match: (p) => /^\/seller\/products\/[^/]+\/edit$/.test(p), label: 'Edit Product' },
  { match: (p) => p === '/seller/products/inventory', label: 'Inventory' },
  { match: (p) => p === '/seller/orders/requests', label: 'Order Requests' },
  { match: (p) => p === '/seller/orders/confirmed', label: 'Confirmed Orders' },
  { match: (p) => p === '/seller/messages', label: 'Messages' },
  { match: (p) => p.startsWith('/seller/messages/'), label: 'Conversation' },
  { match: (p) => p === '/seller/shop' || p === '/seller/store', label: 'Shop Profile' },
  { match: (p) => p === '/seller/shop/logo', label: 'Shop Logo' },
  { match: (p) => p === '/seller/shop/banner', label: 'Shop Banner' },
  { match: (p) => p === '/seller/shop/settings', label: 'Shop Settings' },
  { match: (p) => p === '/seller/sales', label: 'Sales' },
  { match: (p) => p === '/seller/payments', label: 'Payments' },
  { match: (p) => p === '/seller/settings', label: 'Settings' },
];

const pageLabel = (path: string): string => PAGE_LABELS.find((entry) => entry.match(path))?.label ?? 'Seller Center';

const activePrefixesOf = (node: NavNode, path: string): boolean => {
  if (node.kind === 'group') return node.prefixes.some((p) => path === p || path.startsWith(p));
  return path === node.to || (!node.end && path.startsWith(node.to));
};

const defaultOpenGroups = (path: string): string[] =>
  NAV.filter((n): n is NavGroup => n.kind === 'group').filter((g) => activePrefixesOf(g, path)).map((g) => g.key);

/**
 * Dedicated Seller Center shell for /seller/* — a full application shell with
 * its own sidebar + header, separate from the public marketplace (top-level
 * route OUTSIDE the customer Layout, exactly like /admin). Authorization stays
 * backend-side (the API rejects non-approved sellers); this layout decides
 * which state to show:
 *
 *   * not authenticated            → redirect to /login (return path preserved)
 *   * profile fetch failed/unknown → temporary error + Retry
 *   * application APPROVED, no profile → data inconsistency → Retry
 *   * application PENDING          → "under review"
 *   * application REJECTED         → "not approved" + reason
 *   * confirmed no profile AND no application → "seller account required"
 *   * APPROVED profile             → the full Seller Center shell
 *
 * "No seller account" is NEVER derived from a failed request — only from a
 * confirmed 200 response with no SellerProfile and no application.
 */
export const SellerCenterLayout: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [sellerApp, setSellerApp] = React.useState<SellerAppState | null>(null);
  const [sellerProfile, setSellerProfile] = React.useState<SellerProfileState | null>(null);
  // Start without the full-page spinner when a fresh seller-status result is
  // already cached — e.g. login just fetched it before navigating here.
  const [sellerLoading, setSellerLoading] = React.useState<boolean>(() => !sellerStatusIsCached());
  const [sellerError, setSellerError] = React.useState<string | null>(null);

  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<string[]>(() => defaultOpenGroups(location.pathname));
  const [accountOpen, setAccountOpen] = React.useState(false);
  // Single source of truth for the seller unread count: the header bell writes
  // it here, and child pages read it instead of fetching their own copy.
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const accountRef = React.useRef<HTMLDivElement>(null);

  const refreshSeller = React.useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    try {
      // Skip the full-page spinner when a fresh result is already cached —
      // the shared getSellerStatus() resolves immediately in that case.
      const wasCached = sellerStatusIsCached();
      if (!opts?.silent && !wasCached) setSellerLoading(true);

      // Shared, deduped, briefly-cached lookup: if login/AuthCallback already
      // fetched seller status a moment ago, this reuses that result instead of
      // issuing another pair of /seller/profile + /seller/application calls.
      const { profile: profileResult, application: appResult } = await getSellerStatus({ force: opts?.force });

      if (appResult.status === 'fulfilled') setSellerApp(appResult.value ?? null);
      if (profileResult.status === 'fulfilled') {
        setSellerProfile(profileResult.value ?? null);
        setSellerError(null);
      } else {
        const reason = profileResult.reason;
        setSellerError(reason instanceof Error ? reason.message : 'Unable to load seller status.');
      }
    } finally {
      if (!opts?.silent) setSellerLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refreshSeller();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the store status in sync when the user returns to the tab (e.g. a
  // decision made in another tab) without tearing down the current page.
  React.useEffect(() => {
    const onFocus = () => refreshSeller({ silent: true, force: true });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSeller]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const openMobileNav = () => {
    setSidebarCollapsed(false);
    setSidebarOpen(true);
  };

  const toggleGroup = (key: string, collapsed: boolean) => {
    if (collapsed) {
      setSidebarCollapsed(false);
      setOpenGroups((prev) => (prev.includes(key) ? prev : [...prev, key]));
      return;
    }
    setOpenGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const profile = sellerProfile;
  const pending = isLoading || sellerLoading;

  if (pending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading your store…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!profile) {
    if (sellerError || sellerApp?.status === 'APPROVED') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
          <div className="max-w-xl w-full rounded-xl border border-border bg-card p-8 lg:p-10 text-center shadow-card">
            <AlertCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="font-display text-xl font-bold text-foreground">Unable to load seller account</h1>
            <p className="mt-2 text-muted-foreground">
              Your seller account could not be loaded right now. Please try again.
            </p>
            <Button className="mt-6" onClick={() => refreshSeller({ force: true })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    if (sellerApp?.status === 'PENDING') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
          <div className="max-w-xl w-full rounded-xl border border-border bg-card p-8 lg:p-10 text-center shadow-card">
            <Clock className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="font-display text-xl font-bold text-foreground">Application under review</h1>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              We are reviewing <span className="font-semibold text-foreground">{sellerApp.storeName}</span>.
              Once an admin has reviewed your application, we’ll send you an email with the decision and
              next steps.
            </p>
            <p className="mt-2 text-muted-foreground text-sm leading-relaxed">
              If your application is approved, you can access your{' '}
              <span className="font-semibold text-foreground">Seller Center</span> from the approval email.
            </p>
          </div>
        </div>
      );
    }

    if (sellerApp?.status === 'REJECTED') {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
          <div className="max-w-xl w-full rounded-xl border border-border bg-card p-8 lg:p-10 text-center shadow-card">
            <XCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h1 className="font-display text-xl font-bold text-foreground">Application not approved</h1>
            <p className="mt-2 text-muted-foreground">
              Reason: <span className="text-foreground">{sellerApp.rejectionReason || 'Not specified.'}</span>
            </p>
            <Button className="mt-6" onClick={() => navigate('/account/seller')}>
              View Application
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <div className="max-w-xl w-full rounded-xl border border-border bg-card p-8 lg:p-10 text-center shadow-card">
          <Store className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold text-foreground">Seller account required</h1>
          <p className="mt-2 text-muted-foreground">
            You don't have a seller account yet. Apply from your account page to open a store.
          </p>
          <Button className="mt-6" onClick={() => navigate('/account/seller')}>
            Become a Seller
          </Button>
        </div>
      </div>
    );
  }

  const suspended = profile.status === 'SUSPENDED';
  const userInitials = user ? (user.firstName ? user.firstName[0] : user.email[0]).toUpperCase() : 'U';
  const userDisplayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

  const outline: SellerCenterOutlet = {
    profile,
    sellerApp,
    sellerError,
    refreshProfile: refreshSeller,
    unreadNotifications,
  };

  const renderLeaf = (leaf: NavLeaf) => {
    const Icon = leaf.icon;
    return (
      <NavLink
        key={leaf.to}
        to={leaf.to}
        end={leaf.end}
        title={sidebarCollapsed ? leaf.label : undefined}
        aria-label={sidebarCollapsed ? leaf.label : undefined}
        onClick={() => setSidebarOpen(false)}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            sidebarCollapsed && 'justify-center px-2',
            isActive
              ? 'bg-destructive/10 font-semibold text-destructive'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!sidebarCollapsed && <span className="truncate">{leaf.label}</span>}
      </NavLink>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const Icon = group.icon;
    const open = openGroups.includes(group.key);
    const active = activePrefixesOf(group, location.pathname);
    return (
      <div key={group.key}>
        <button
          onClick={() => toggleGroup(group.key, sidebarCollapsed)}
          title={sidebarCollapsed ? group.label : undefined}
          aria-label={sidebarCollapsed ? group.label : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            sidebarCollapsed && 'justify-center px-2',
            active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left">{group.label}</span>
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </>
          )}
        </button>
        {!sidebarCollapsed && open && <div className="mt-1 space-y-1 pl-4">{group.children.map(renderLeaf)}</div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar — fixed drawer on mobile (always full-width labels), static
          and collapsible on desktop, mirroring the Admin Dashboard shell. */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 grid w-72 grid-rows-[auto_auto_1fr_auto] bg-card transition-all duration-300 border-r border-border',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-72',
        )}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link to="/seller" className="flex min-w-0 items-center gap-2" onClick={() => setSidebarOpen(false)} title="Marcari23 Seller Center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-white">EM</span>
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="font-display text-lg font-bold leading-none">Marcari23</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Seller Center</p>
              </div>
            )}
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 hover:bg-muted lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shop identity */}
        <div className={cn('border-b border-border px-4 py-4', sidebarCollapsed && 'lg:flex lg:justify-center lg:px-0')}>
          <div className={cn('flex items-center gap-3', sidebarCollapsed && 'lg:flex-col lg:gap-1.5')}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
              <Store className="h-5 w-5 text-destructive" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{profile.storeName || 'Your Store'}</p>
                <div className="mt-0.5">
                  <Badge variant={suspended ? 'destructive' : 'success'} size="xs">
                    {suspended ? 'Suspended' : 'Active'}
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1 overflow-y-auto p-3">{NAV.map((node) => (node.kind === 'group' ? renderGroup(node) : renderLeaf(node)))}</nav>

        {/* Footer */}
        <div className="space-y-2 border-t border-border p-3">
          <Button
            variant="outline"
            size="sm"
            className={cn('w-full', sidebarCollapsed && 'lg:justify-center lg:px-2')}
            title="Back to Marketplace"
            onClick={() => navigate('/')}
          >
            <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Back to Marketplace</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full text-destructive hover:bg-destructive/10 hover:text-destructive', sidebarCollapsed && 'lg:justify-center lg:px-2')}
            title="Logout"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className={cn('min-h-screen transition-all duration-300', sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72')}>
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/80 backdrop-blur">
          <div className="flex h-full items-center justify-between gap-4 px-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              {/* Mobile drawer toggle */}
              <button onClick={openMobileNav} className="rounded-lg p-2 hover:bg-muted lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
              {/* Desktop sidebar collapse toggle */}
              <button
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="hidden rounded-lg p-2 hover:bg-muted lg:block"
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Menu className="h-5 w-5" />
              </button>
              {/* Breadcrumbs — keep identity in the sidebar, context in the header. */}
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
                <Link
                  to="/seller"
                  className="hidden shrink-0 font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
                >
                  Seller Center
                </Link>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
                <span className="truncate font-semibold text-foreground">{pageLabel(location.pathname)}</span>
              </nav>
            </div>

            <div className="flex items-center gap-2 lg:gap-3">
              <SellerNotificationBell
                unread={unreadNotifications}
                onUnreadChange={setUnreadNotifications}
              />
              <Link
                to="/seller/messages"
                aria-label="Messages"
                className="relative rounded-lg p-2 text-foreground transition-colors hover:bg-muted"
              >
                <MessageSquare className="h-5 w-5" />
              </Link>

              {/* Account menu */}
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-muted"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {userInitials}
                  </div>
                  <span className="hidden max-w-[10rem] truncate text-sm font-medium text-foreground lg:block">
                    {userDisplayName}
                  </span>
                  <ChevronDown className={cn('hidden h-4 w-4 text-muted-foreground lg:block', accountOpen && 'rotate-180')} />
                </button>

                {accountOpen && (
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                    <div className="border-b border-border px-4 py-3">
                      <p className="truncate text-sm font-semibold text-foreground">{userDisplayName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/account');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted"
                      >
                        <User className="h-4 w-4" />
                        My Account
                      </button>
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          navigate('/');
                        }}
                        className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Marketplace
                      </button>
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          handleLogout();
                        }}
                        className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {suspended && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your seller account is suspended. Browsing is available, but product changes are disabled until an
                administrator reactivates your store.
              </span>
            </div>
          )}

          <React.Suspense fallback={<ContentLoader />}>
            <Outlet context={outline} />
          </React.Suspense>
        </main>
      </div>
    </div>
  );
};

export default SellerCenterLayout;