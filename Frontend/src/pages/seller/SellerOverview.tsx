import * as React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Package,
  MessageSquare,
  Wallet,
  Bell,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  Activity,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/States';
import { api, sellerProductApi, messageApi } from '@/lib/api';
import { formatRelativeTime } from '@/components/admin/AdminNotificationBell';
import { cn, formatCurrency } from '@/lib/utils';
import type { SellerCenterOutlet } from '@/components/seller/SellerLayout';

interface OverviewProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  category: { id: string; name: string } | null;
}

interface RecentConversation {
  id: string;
  orderNumber: string;
  updatedAt: string;
  unreadCount: number;
  lastMessage: { id: string; body: string } | null;
}

const kpiSkeleton = (
  <div className="rounded-xl border border-border bg-card p-5">
    <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
    <Skeleton className="h-6 w-24" />
    <Skeleton className="mt-2 h-3 w-32" />
  </div>
);

const panelSkeleton = (
  <Card>
    <CardContent className="p-5">
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </CardContent>
  </Card>
);

export const SellerOverview: React.FC = () => {
  const { profile, unreadNotifications } = useOutletContext<SellerCenterOutlet>();

  const [products, setProducts] = React.useState<OverviewProduct[]>([]);
  const [totalProducts, setTotalProducts] = React.useState<number | null>(null);
  const [conversations, setConversations] = React.useState<RecentConversation[]>([]);
  const [unreadMessages, setUnreadMessages] = React.useState<number>(0);
  const [walletBalance, setWalletBalance] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [productRes, conversationRes, walletRes] = await Promise.allSettled([
          sellerProductApi.list({ page: 1, limit: 100 }),
          messageApi.sellerConversations({ page: 1, limit: 100 }),
          api.get<{ balance: number }>('/wallet').then((res) => res?.balance ?? null).catch(() => null),
        ]);

        if (!active) return;

        if (productRes.status === 'fulfilled') {
          setProducts(
            productRes.value.products.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              stock: p.stock,
              isAvailable: p.isAvailable,
              category: p.category,
            })),
          );
          setTotalProducts(productRes.value.pagination.total);
        }

        if (conversationRes.status === 'fulfilled') {
          const latest = conversationRes.value.conversations
            .filter((c) => c.lastMessage)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 5);
          setConversations(latest.map((c) => ({ ...c, lastMessage: c.lastMessage })));
          setUnreadMessages(conversationRes.value.conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0));
        }

        if (walletRes.status === 'fulfilled') setWalletBalance(walletRes.value);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <React.Fragment key={i}>{kpiSkeleton}</React.Fragment>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {panelSkeleton}
          {panelSkeleton}
        </div>
        {panelSkeleton}
      </div>
    );
  }

  const healthyStock = products.filter((p) => p.isAvailable && p.stock > 5);
  const lowStock = products.filter((p) => p.isAvailable && p.stock > 0 && p.stock <= 5);
  const outOfStock = products.filter((p) => !p.isAvailable || p.stock <= 0);
  const activeListings = products.filter((p) => p.isAvailable);
  const inStockRatio = activeListings.length > 0 ? Math.round((healthyStock.length / activeListings.length) * 100) : 0;
  const totalAll = Math.max(1, products.length);
  const barIn = (healthyStock.length / totalAll) * 100;
  const barLow = (lowStock.length / totalAll) * 100;
  const barOut = (outOfStock.length / totalAll) * 100;
  const inventoryToWatch = [...activeListings].sort((a, b) => a.stock - b.stock).slice(0, 5);

  const kpis = [
    {
      label: 'Active Listings',
      value: totalProducts == null ? '—' : String(totalProducts),
      icon: Package,
      accent: 'from-primary to-primary-600',
      to: '/seller/products',
    },
    {
      label: 'Unread Messages',
      value: unreadMessages == null ? '—' : String(unreadMessages),
      icon: MessageSquare,
      accent: 'from-destructive to-rose-500',
      to: '/seller/messages',
    },
    {
      label: 'Wallet Balance',
      value: walletBalance == null ? '—' : formatCurrency(walletBalance),
      icon: Wallet,
      accent: 'from-success to-emerald-500',
      to: '/seller/payments',
    },
    {
      label: 'Notifications',
      value: unreadNotifications == null ? '—' : String(unreadNotifications),
      icon: Bell,
      accent: 'from-accent to-amber-500',
      to: '/seller/messages',
    },
  ];

  const health = [
    { label: 'In Stock', value: healthyStock.length, tone: 'bg-success' },
    { label: 'Low Stock (≤5)', value: lowStock.length, tone: 'bg-warning' },
    { label: 'Out of Stock', value: outOfStock.length, tone: 'bg-destructive' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero banner — the store's identity block lives here, not repeated in
          the sidebar/header. */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-600 to-secondary p-6 text-white shadow-card lg:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/5 blur-xl" />

        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/75">Seller Center</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold lg:text-3xl">
              Welcome back, {profile.storeName || 'Seller'}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/80">
              Your store is live. Here's what's happening today — listings, messages and payments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/seller/products/new">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm transition-transform hover:scale-[1.03]">
                <PlusCircle className="h-4 w-4" />
                Add Product
              </span>
            </Link>
            <Link to="/">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20">
                <ExternalLink className="h-4 w-4" />
                Back to Marketplace
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.label} to={kpi.to} className="group">
              <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-card-hover">
                <CardContent className="flex items-start justify-between p-5">
                  <div className="min-w-0">
                    <p className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">{kpi.value}</p>
                    <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {kpi.label}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                      kpi.accent,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Store health + recent conversations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                  <Activity className="h-4 w-4 text-destructive" />
                </span>
                <h2 className="font-display text-lg font-bold text-foreground">Store Health</h2>
              </div>
              <Link to="/seller/products/inventory" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Inventory
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* In-stock ratio bar */}
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  {activeListings.length} of {totalProducts ?? 0} listings currently active
                </span>
                <span className="font-semibold text-foreground">{inStockRatio}% in stock</span>
              </div>
              <div className="flex h-2.5 gap-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${barIn}%` }} />
                {barLow > 0 && <div className="h-full rounded-full bg-warning transition-all" style={{ width: `${barLow}%` }} />}
                {barOut > 0 && <div className="h-full rounded-full bg-destructive transition-all" style={{ width: `${barOut}%` }} />}
              </div>
            </div>

            {lowStock.length > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {lowStock.length} {lowStock.length === 1 ? 'product is' : 'products are'} running low on stock.
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {health.map((h) => (
                <div key={h.label} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', h.tone)} />
                    <p className="font-display text-lg font-extrabold text-foreground">{h.value}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{h.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </span>
                <h2 className="font-display text-lg font-bold text-foreground">Recent Conversations</h2>
              </div>
              <Link to="/seller/messages" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {conversations.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No conversations yet. When a customer messages you, it will appear here.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {conversations.map((c) => (
                  <Link key={c.id} to={`/seller/messages/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">Order {c.orderNumber}</p>
                          {c.unreadCount > 0 && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{c.lastMessage?.body}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{formatRelativeTime(c.updatedAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory to watch */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                <Layers className="h-4 w-4 text-destructive" />
              </span>
              <h2 className="font-display text-lg font-bold text-foreground">Inventory to Watch</h2>
            </div>
            <Link to="/seller/products/inventory" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Full inventory
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {inventoryToWatch.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No products yet. Add your first product to start selling.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {inventoryToWatch.map((p) => (
                <Link key={p.id} to={`/seller/products/${p.id}/edit`} className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.category?.name || 'Uncategorized'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold text-muted-foreground">{formatCurrency(p.price)}</span>
                    <Badge variant={p.stock <= 0 ? 'destructive' : p.stock <= 5 ? 'warning' : 'success'} size="sm">
                      {p.stock <= 0 ? 'Out of stock' : `${p.stock} in stock`}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        All figures above are live from your store data.
      </p>
    </div>
  );
};

export default SellerOverview;