import * as React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Package, Plus, Settings, Store as StoreIcon, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { sellerProductApi } from '@/lib/api';

interface SellerProfileState {
  id: string;
  storeName: string;
  storeDescription: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SellerOutlet {
  profile: SellerProfileState;
  refreshProfile: () => Promise<void>;
}

interface DashboardStats {
  total: number;
  available: number;
  unavailable: number;
  loading: boolean;
  error: string | null;
}

/**
 * Seller Dashboard (/seller) — the seller area home. Real data only:
 * store name/status come from the authenticated SellerProfile, product
 * counts come from the caller's own seller products API. Only metrics the
 * backend actually provides are ever shown here.
 */
export default function SellerDashboard() {
  const { profile } = useOutletContext<SellerOutlet>();
  const [stats, setStats] = React.useState<DashboardStats>({
    total: 0,
    available: 0,
    unavailable: 0,
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Page size 1: the API's `total` is the real count — one row is enough.
        const res = await sellerProductApi.list({ page: 1, limit: 1 });
        if (cancelled) return;
        setStats({
          total: res.pagination?.total ?? 0,
          available: 0,
          unavailable: 0,
          loading: false,
          error: null,
        });
      } catch (err: any) {
        if (!cancelled) {
          setStats((s) => ({ ...s, loading: false, error: err?.message || 'Failed to load product count.' }));
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = profile.status === 'APPROVED';
  const suspended = profile.status === 'SUSPENDED';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Seller Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back, {profile.storeName}</p>
      </div>

      {/* Status + product count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Store status</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={
                  active
                    ? 'h-2.5 w-2.5 rounded-full bg-success animate-pulse'
                    : suspended
                      ? 'h-2.5 w-2.5 rounded-full bg-destructive'
                      : 'h-2.5 w-2.5 rounded-full bg-warning'
                }
              />
              <span className="font-bold text-foreground text-lg">
                {active ? 'Active' : suspended ? 'Suspended' : 'Pending review'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {active
                ? 'Your store can list and manage products.'
                : suspended
                  ? 'Product changes are disabled while suspended.'
                  : 'An administrator is reviewing your application.'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Products</p>
            {stats.loading ? (
              <div className="h-7 w-12 rounded bg-muted animate-pulse mt-2" />
            ) : stats.error ? (
              <p className="text-sm text-destructive mt-2">{stats.error}</p>
            ) : (
              <p className="font-bold text-foreground text-lg mt-2">{stats.total}</p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Products listed in your store
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardContent className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Quick actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/seller/products/new">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="h-4 w-4 text-destructive" />
                Add Product
              </Button>
            </Link>
            <Link to="/seller/products">
              <Button variant="outline" className="w-full justify-start">
                <Package className="h-4 w-4 text-destructive" />
                Manage Products
                <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </Button>
            </Link>
            <Link to="/seller/store">
              <Button variant="outline" className="w-full justify-start">
                <Settings className="h-4 w-4 text-destructive" />
                Manage Store
                <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Store card (identity + real description) */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <StoreIcon className="h-5 w-5 text-destructive" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-foreground truncate">{profile.storeName}</h2>
                  <Badge variant={active ? 'success' : suspended ? 'destructive' : 'warning'}>
                    {active ? 'Active' : suspended ? 'Suspended' : 'Pending'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {profile.storeDescription || 'No store description yet.'}
                </p>
              </div>
            </div>
            <Link to="/seller/store" className="shrink-0">
              <Button variant="ghost" size="sm">
                Manage Store
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
