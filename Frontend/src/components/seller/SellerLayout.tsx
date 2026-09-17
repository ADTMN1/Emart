import * as React from 'react';
import { Link, NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ExternalLink, LayoutDashboard, Package, Store, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/**
 * Compact seller wrapper rendered INSIDE the persistent Account/Store shell.
 * It deliberately has no sidebar of its own — the Account sidebar stays. This
 * only (1) gates /seller pages on a real SellerProfile and (2) shows a compact
 * horizontal sub-navigation in the main content area. Authorization remains
 * backend-side (the API rejects non-approved sellers with 403).
 */

interface SellerProfileState {
  id: string;
  storeName: string;
  storeDescription: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SellerLayoutChildProps {
  profile: SellerProfileState;
  refreshProfile: () => Promise<void>;
}

const sellerNav = [
  { name: 'Dashboard', path: '/seller', icon: LayoutDashboard, end: true },
  { name: 'Products', path: '/seller/products', icon: Package, end: false },
  { name: 'Messages', path: '/seller/messages', icon: MessageSquare, end: false },
  { name: 'Store', path: '/seller/store', icon: Store, end: false },
] as const;

export const SellerLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = React.useState<SellerProfileState | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);

  const fetchProfile = React.useCallback(async () => {
    try {
      const res = await api.get<SellerProfileState | null>('/seller/profile');
      setProfile(res ?? null);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (isLoading || profileLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-destructive border-t-transparent mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading your store...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return (
      <div className="py-6">
        <div className="max-w-xl mx-auto">
          <div className="rounded-xl border border-border bg-card p-8 lg:p-10 text-center shadow-card">
            <Store className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-display text-xl font-bold text-foreground">Seller account required</h1>
            <p className="text-muted-foreground mt-2">
              You don't have a seller account yet. Apply from your account page to open a store.
            </p>
            <Button className="mt-6" onClick={() => navigate('/account/seller')}>
              Become a Seller
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const suspended = profile.status === 'SUSPENDED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Store</p>
          <p className="font-semibold text-foreground truncate">{profile.storeName}</p>
        </div>
        <Link to="/">
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-1.5" />
            View Storefront
          </Button>
        </Link>
      </div>

      {/* Compact seller sub-navigation inside the main content (keeps the
          persistent Account sidebar; this is NOT a page-level sidebar). */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin border-b border-border">
        {sellerNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'shrink-0 flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'text-destructive border-destructive'
                    : 'text-muted-foreground border-transparent hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          );
        })}
      </div>

      {suspended && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Your seller account is suspended. Browsing is available, but product changes are
          disabled until an administrator reactivates your store.
        </div>
      )}

      <Outlet context={{ profile, refreshProfile: fetchProfile } satisfies SellerLayoutChildProps} />
    </div>
  );
};

export default SellerLayout;