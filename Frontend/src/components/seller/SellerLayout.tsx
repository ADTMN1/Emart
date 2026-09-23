import * as React from 'react';
import { Link, NavLink, Outlet, Navigate, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { type AccountOutletContext } from '@/components/account/AccountLayout';
import { AlertCircle, Clock, ExternalLink, LayoutDashboard, MessageSquare, Package, RefreshCw, Store, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/**
 * Compact seller wrapper rendered INSIDE the persistent Account/Store shell.
 * It deliberately has no sidebar of its own — the Account sidebar stays. This
 * (1) gates /seller pages on the authoritative seller status — a verified
 * APPROVED SellerProfile renders the dashboard, while PENDING / REJECTED /
 * confirmed-no-account / retry states render informational cards and
 * (2) shows a compact horizontal sub-navigation in the main content area.
 * Authorization remains backend-side (the API rejects non-approved sellers).
 *
 * The seller profile + loading state + refresh function are read from the
 * AccountLayout outlet context so no separate /seller/profile request is
 * made by this component.
 */

interface SellerLayoutChildProps {
  profile: AccountOutletContext['sellerProfile'];
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
  const location = useLocation();
  const { sellerApp, sellerProfile, sellerLoading, sellerError, refreshSeller } = useOutletContext<AccountOutletContext>();
  const profile = sellerProfile;

  if (import.meta.env.DEV) {
    const branch =
      isLoading || sellerLoading ? 'loading' :
      !user ? 'redirect-login' :
      !profile ? (sellerError || sellerApp?.status === 'APPROVED' ? 'error' : sellerApp?.status === 'PENDING' ? 'pending' : sellerApp?.status === 'REJECTED' ? 'rejected' : 'seller-account-required') : 'dashboard';
    console.info('[seller-debug] SellerLayout', {
      user: user ? { id: user.id, email: user.email, role: user.role } : null,
      sellerApp: sellerApp ? { id: sellerApp.id, status: sellerApp.status } : null,
      sellerProfile: profile ? { id: profile.id, status: profile.status, storeName: profile.storeName } : null,
      sellerLoading,
      sellerError,
      branch,
    });
  }

  if (isLoading || sellerLoading) {
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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!profile) {
    // Distinguish the states instead of collapsing everything into
    // "seller account required". All statuses come from the live backend
    // responses; a SellerProfile only exists after approval, so a pending or
    // rejected applicant lands here with a null profile but a real
    // application status.
    //
    //   * profile fetch failed / status unknown        → temporary error + Retry
    //   * application APPROVED but no profile          → data inconsistency → Retry
    //   * application PENDING                          → "under review"
    //   * application REJECTED                         → "not approved" + reason
    //   * confirmed no profile AND no application      → "seller account required"
    //
    // "No seller account" is NEVER derived from a failed/unknown request —
    // only from a confirmed 200 response with no SellerProfile and no
    // application for this user.
    if (sellerError || sellerApp?.status === 'APPROVED') {
      return (
        <div className="py-6">
          <div className="max-w-xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-8 lg:p-10 text-center shadow-card">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h1 className="font-display text-xl font-bold text-foreground">Unable to load seller account</h1>
              <p className="text-muted-foreground mt-2">
                Your seller account could not be loaded right now. Please try again.
              </p>
              <Button className="mt-6" onClick={() => refreshSeller()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (sellerApp?.status === 'PENDING') {
      return (
        <div className="py-6">
          <div className="max-w-xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-8 lg:p-10 text-center shadow-card">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h1 className="font-display text-xl font-bold text-foreground">Application under review</h1>
              <p className="text-muted-foreground mt-2">
                We are reviewing <span className="font-semibold">{sellerApp.storeName}</span>.
                You will see the decision here once an admin has reviewed it.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (sellerApp?.status === 'REJECTED') {
      return (
        <div className="py-6">
          <div className="max-w-xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-8 lg:p-10 text-center shadow-card">
              <XCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h1 className="font-display text-xl font-bold text-foreground">Application not approved</h1>
              <p className="text-muted-foreground mt-2">
                Reason: <span className="text-foreground">{sellerApp.rejectionReason || 'Not specified.'}</span>
              </p>
              <Button className="mt-6" onClick={() => navigate('/account/seller')}>
                View Application
              </Button>
            </div>
          </div>
        </div>
      );
    }

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

      <Outlet context={{ profile, refreshProfile: refreshSeller } satisfies SellerLayoutChildProps} />
    </div>
  );
};

export default SellerLayout;