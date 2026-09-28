import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingCart,
  Package,
  Wallet,
  BarChart3,
  Trophy,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/States';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { sellerSalesApi } from '@/lib/api';
import type { SellerSalesReport } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

const RANGE_PRESETS = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
] as const;

type RangeKey = (typeof RANGE_PRESETS)[number]['key'];

/** Local calendar date as YYYY-MM-DD (the backend treats the window as inclusive UTC days). */
const toIsoDate = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const rangeFor = (days: number) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
};

/**
 * Accepts either a bare day key ("2026-09-28") or a full ISO timestamp
 * ("2026-09-28T00:00:00.000Z") and returns an em dash instead of
 * "Invalid Date" for anything unparseable — the report never shows a
 * broken date.
 */
const formatDay = (value: string | undefined): string => {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const orderStatusVariant = (status: string) => {
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'destructive' as const;
  if (status === 'DELIVERED') return 'success' as const;
  if (status === 'PENDING') return 'warning' as const;
  return 'info' as const;
};

const paymentStatusVariant = (status: string) => {
  if (status === 'PAID') return 'success' as const;
  if (status === 'FAILED' || status === 'REFUNDED') return 'destructive' as const;
  return 'warning' as const;
};

const titleCase = (value: string): string => value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');

/**
 * A comparison the backend could not make (no prior-period sales) is rendered
 * as "no data" instead of a fabricated 0% change.
 */
const ChangeIndicator: React.FC<{ percent: number | null; label: string }> = ({ percent, label }) => {
  if (percent === null) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        No prior {label}
      </span>
    );
  }

  const up = percent > 0;
  const flat = percent === 0;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[11px] font-semibold',
        flat ? 'text-muted-foreground' : up ? 'text-success' : 'text-destructive',
      )}
    >
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}
      {percent}% vs previous period
    </span>
  );
};

const kpiSkeleton = (
  <div className="rounded-xl border border-border bg-card p-5">
    <Skeleton className="mb-3 h-10 w-10 rounded-lg" />
    <Skeleton className="h-7 w-28" />
    <Skeleton className="mt-2 h-3 w-24" />
  </div>
);

export const SellerSales: React.FC = () => {
  const { toast } = useToast();
  const [rangeKey, setRangeKey] = React.useState<RangeKey>('30d');
  const [report, setReport] = React.useState<SellerSalesReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (key: RangeKey) => {
    const preset = RANGE_PRESETS.find((option) => option.key === key) ?? RANGE_PRESETS[1];
    setLoading(true);
    try {
      const data = await sellerSalesApi.report(rangeFor(preset.days));
      setReport(data);
      setError(null);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Unable to load your sales report.');
      toast({ variant: 'error', title: 'Sales report unavailable', description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    void load(rangeKey);
  }, [load, rangeKey]);

  const summary = report?.summary;
  const peak = React.useMemo(
    () => Math.max(0, ...(report?.series ?? []).map((point) => point.revenue)),
    [report],
  );
  const topRevenue = React.useMemo(
    () => Math.max(0, ...(report?.topProducts ?? []).map((product) => product.revenue)),
    [report],
  );

  const presets = (
    <div className="flex flex-wrap items-center gap-2">
      {RANGE_PRESETS.map((preset) => (
        <Button
          key={preset.key}
          size="sm"
          variant={rangeKey === preset.key ? 'primary' : 'outline'}
          onClick={() => setRangeKey(preset.key)}
          disabled={loading}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <SellerPageHeader title="Sales" description="Revenue and order performance for your store." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <React.Fragment key={i}>{kpiSkeleton}</React.Fragment>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (error || !report || !summary) {
    return (
      <div className="space-y-6">
        <SellerPageHeader title="Sales" description="Revenue and order performance for your store." action={presets} />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
              <BarChart3 className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">Sales report unavailable</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {error || 'The report could not be loaded.'} Try again, or check your orders in the meantime.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => void load(rangeKey)}>Retry</Button>
              <Link to="/seller/orders/confirmed">
                <Button variant="outline">View Orders</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Revenue',
      value: formatCurrency(summary.revenue),
      sub: <ChangeIndicator percent={report.change.revenuePercent} label="revenue" />,
      icon: TrendingUp,
      accent: 'from-primary to-primary-600',
    },
    {
      label: 'Orders',
      value: String(summary.orderCount),
      sub: <ChangeIndicator percent={report.change.orderPercent} label="orders" />,
      icon: ShoppingCart,
      accent: 'from-secondary to-accent',
    },
    {
      label: 'Items Sold',
      value: String(summary.itemsSold),
      sub: <span className="text-[11px] font-medium text-muted-foreground">{formatCurrency(summary.averageOrderValue)} avg. per order</span>,
      icon: Package,
      accent: 'from-success to-emerald-500',
    },
    {
      label: 'Net Earnings',
      value: formatCurrency(summary.netEarnings),
      sub: <span className="text-[11px] font-medium text-muted-foreground">After fees &amp; shipping</span>,
      icon: Wallet,
      accent: 'from-info to-sky-500',
    },
  ];

  const breakdown = [
    { label: 'Gross revenue (your items)', value: summary.revenue, tone: 'text-foreground' },
    { label: 'Service fees', value: -summary.serviceFees, tone: 'text-muted-foreground' },
    { label: 'Domestic shipping', value: -summary.shippingCharges, tone: 'text-muted-foreground' },
    { label: 'Net earnings', value: summary.netEarnings, tone: 'text-success' },
    { label: 'Paid by customers', value: summary.paidRevenue, tone: 'text-foreground' },
    { label: 'Awaiting payment', value: summary.pendingRevenue, tone: 'text-warning-foreground' },
  ];

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Sales"
        description={`Revenue, orders and best sellers for ${formatDay(report.range.startDate)} – ${formatDay(
          report.range.endDate,
        )} (${report.range.days} days).`}
        action={presets}
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-2xl font-extrabold text-foreground">{kpi.value}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                  </div>
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm', kpi.accent)}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                {kpi.sub}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {summary.orderCount === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center px-6 py-14 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <BarChart3 className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="font-display text-lg font-bold text-foreground">No sales in this period</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Once a customer orders one of your listings, its revenue, order count and daily trend appear here
              automatically. Cancelled and refunded orders are never counted as revenue.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/seller/products">
                <Button variant="outline">Manage Products</Button>
              </Link>
              <Link to="/seller/messages">
                <Button variant="ghost">
                  Contact Support
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Revenue trend + money breakdown */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Daily Revenue
                  </h2>
                  <span className="text-xs text-muted-foreground">Peak {formatCurrency(peak)}</span>
                </div>

                <div className="flex h-48 items-end gap-[2px]">
                  {report.series.map((point) => {
                    const height = peak > 0 ? Math.max(2, (point.revenue / peak) * 100) : 2;
                    return (
                      <div
                        key={point.date}
                        className="group relative flex-1"
                        title={`${formatDay(point.date)} · ${formatCurrency(point.revenue)} · ${point.orders} order${
                          point.orders === 1 ? '' : 's'
                        }`}
                      >
                        <div
                          className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                  <span>{formatDay(report.series[0]?.date ?? report.range.startDate)}</span>
                  <span>{formatDay(report.series[report.series.length - 1]?.date ?? report.range.endDate)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
                  <Wallet className="h-4 w-4 text-success" />
                  Where It Adds Up
                </h2>
                <dl className="divide-y divide-border/60">
                  {breakdown.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 py-2">
                      <dt className="text-sm text-muted-foreground">{row.label}</dt>
                      <dd className={cn('text-sm font-semibold', row.tone)}>
                        {row.value < 0 ? '−' : ''}
                        {formatCurrency(Math.abs(row.value))}
                      </dd>
                    </div>
                  ))}
                </dl>

                {summary.excludedOrders > 0 && (
                  <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      {summary.excludedOrders} cancelled or refunded order
                      {summary.excludedOrders === 1 ? '' : 's'} ({formatCurrency(summary.excludedRevenue)}) excluded
                      from these figures.
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Best sellers + recent sales */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                    <Trophy className="h-4 w-4 text-accent" />
                    Best Sellers
                  </h2>
                  <Link to="/seller/products" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    All products
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {report.topProducts.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No products sold in this period.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {report.topProducts.map((product, index) => (
                      <div key={product.productId} className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-5 shrink-0 text-center font-display text-sm font-bold text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {product.image ? (
                              <img src={product.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.unitsSold} sold · {product.orderCount} order{product.orderCount === 1 ? '' : 's'}
                            </p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-foreground">
                            {formatCurrency(product.revenue)}
                          </span>
                        </div>
                        <div className="ml-8 mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${topRevenue > 0 ? (product.revenue / topRevenue) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    Recent Sales
                  </h2>
                  <Link to="/seller/orders/confirmed" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    All orders
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {report.recentOrders.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No orders in this period.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {report.recentOrders.map((order) => (
                      <Link
                        key={order.orderId}
                        to={`/seller/orders/${order.orderId}`}
                        className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">Order {order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            · {order.items} item{order.items === 1 ? '' : 's'} ({order.units} unit
                            {order.units === 1 ? '' : 's'})
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={paymentStatusVariant(order.paymentStatus)} size="sm">
                            {titleCase(order.paymentStatus)}
                          </Badge>
                          <Badge variant={orderStatusVariant(order.status)} size="sm">
                            {titleCase(order.status)}
                          </Badge>
                          <span className="text-sm font-semibold text-foreground">{formatCurrency(order.revenue)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5" />
        Revenue counts only your own listings in each order, after the order's service fee and domestic shipping.
        Payouts to your wallet are listed under Payments.
      </p>
    </div>
  );
};

export default SellerSales;
