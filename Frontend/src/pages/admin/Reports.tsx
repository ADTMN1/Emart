import * as React from 'react';
import {
  BarChart3,
  RefreshCw,
  DollarSign,
  ShoppingCart,
  Receipt,
  Boxes,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

/**
 * Admin Sales Reports (Phase 4).
 *
 * All numbers come from the server-side report endpoints
 * (/admin/reports/sales/*) which aggregate real order data. Nothing is
 * computed or fabricated in the browser; while loading, cards show
 * skeletons instead of placeholder values.
 */

interface Overview {
  period: string;
  from: string;
  to: string;
  totalOrders: number;
  revenue: number;
  averageOrderValue: number;
  unitsSold: number;
  paidOrders: number;
  pendingPaymentOrders: number;
  failedPaymentOrders: number;
  refundedOrders: number;
}

interface TrendDay {
  date: string;
  revenue: number;
  orders: number;
  units: number;
}
interface Trend {
  period: string;
  from: string;
  to: string;
  days: TrendDay[];
}

interface StatusBreakdown {
  period: string;
  breakdown: Array<{ status: string; count: number }>;
}
interface PaymentBreakdown {
  period: string;
  breakdown: Array<{ paymentStatus: string; count: number }>;
}

interface TopProducts {
  period: string;
  pagination: { page: number; limit: number; total: number };
  products: Array<{
    productId: string;
    productName: string;
    sku: string | null;
    categoryName: string;
    unitsSold: number;
    revenue: number;
    orderCount: number;
  }>;
}

interface TopCategories {
  period: string;
  pagination: { page: number; limit: number; total: number };
  categories: Array<{
    categoryId: string | null;
    categoryName: string;
    unitsSold: number;
    revenue: number;
    orderCount: number;
  }>;
}

const periodOptions = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'custom', label: 'Custom range' },
];

const statusVariant = (status: string): 'warning' | 'info' | 'primary' | 'accent' | 'success' | 'destructive' | 'default' => {
  const map: Record<string, any> = {
    PENDING: 'warning',
    PAYMENT_RECEIVED: 'info',
    PURCHASING: 'info',
    PURCHASED: 'primary',
    IN_WAREHOUSE: 'primary',
    CONSOLIDATED: 'accent',
    SHIPPED: 'accent',
    IN_TRANSIT: 'accent',
    DELIVERED: 'success',
    CANCELLED: 'destructive',
    REFUNDED: 'default',
    PAID: 'success',
    FAILED: 'destructive',
  };
  return map[status] || 'default';
};

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-block h-4 animate-pulse rounded bg-muted ${className}`} />
);

/** Compact dependency-free SVG chart (revenue / orders / units over time). */
const TrendChart: React.FC<{ days: TrendDay[]; metric: 'revenue' | 'orders' | 'units' }> = ({ days, metric }) => {
  const [hover, setHover] = React.useState<number | null>(null);
  const width = 760;
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const values = days.map((d) => d[metric]);
  const max = Math.max(...values, 1);
  const stepX = days.length > 1 ? innerW / (days.length - 1) : 0;
  const points = days.map((d, i) => {
    const x = pad.left + (days.length > 1 ? i * stepX : innerW / 2);
    const y = pad.top + innerH - (d[metric] / max) * innerH;
    return { x, y, ...d };
  });
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${pad.left},${pad.top + innerH} ${line} ${pad.left + (days.length > 1 ? innerW : 0)},${pad.top + innerH}`;

  const fmt = (v: number) => (metric === 'revenue' ? formatCurrency(v, 'USD') : String(Math.round(v)));

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          if (days.length < 2) return;
          const idx = Math.round(((relX - pad.left) / innerW) * (days.length - 1));
          setHover(Math.min(days.length - 1, Math.max(0, idx)));
        }}
      >
        {gridLines.map((g) => {
          const y = pad.top + innerH - g * innerH;
          return (
            <g key={g}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
              <text x={pad.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground" fontSize="10">
                {fmt(max * g)}
              </text>
            </g>
          );
        })}
        {days.length > 1 && <polygon points={area} className="fill-primary/10" />}
        <polyline points={line} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hover === i ? 5 : 3}
            className={hover === i ? 'fill-primary' : 'fill-primary/70'}
          />
        ))}
        {points.map((p, i) =>
          days.length <= 10 || i % Math.ceil(days.length / 10) === 0 ? (
            <text key={`x${i}`} x={p.x} y={height - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
              {p.date.slice(5)}
            </text>
          ) : null
        )}
      </svg>
      {hover !== null && points[hover] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md"
          style={{
            left: `${(points[hover].x / width) * 100}%`,
            top: 0,
          }}
        >
          <p className="font-semibold">{points[hover].date}</p>
          <p className="text-muted-foreground mt-0.5">
            Revenue: <span className="font-medium text-foreground">{formatCurrency(points[hover].revenue, 'USD')}</span>
          </p>
          <p className="text-muted-foreground">
            Orders: <span className="font-medium text-foreground">{points[hover].orders}</span>
          </p>
          <p className="text-muted-foreground">
            Units: <span className="font-medium text-foreground">{points[hover].units}</span>
          </p>
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  children: React.ReactNode;
  sub?: React.ReactNode;
}> = ({ title, icon: Icon, loading, children, sub }) => (
  <Card>
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-2">
            {loading ? <Skeleton className="h-8 w-24" /> : children}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
        </div>
        <div className="bg-primary/10 p-3 rounded-xl">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const AdminReports: React.FC = () => {
  const [period, setPeriod] = React.useState('last30');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [metric, setMetric] = React.useState<'revenue' | 'orders' | 'units'>('revenue');

  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [trend, setTrend] = React.useState<Trend | null>(null);
  const [statusBreakdown, setStatusBreakdown] = React.useState<StatusBreakdown | null>(null);
  const [paymentBreakdown, setPaymentBreakdown] = React.useState<PaymentBreakdown | null>(null);
  const [products, setProducts] = React.useState<TopProducts | null>(null);
  const [categories, setCategories] = React.useState<TopCategories | null>(null);
  const [productPage, setProductPage] = React.useState(1);
  const [categoryPage, setCategoryPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [tablesLoading, setTablesLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const rangeQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set('period', period);
    if (period === 'custom') {
      if (from) params.set('from', from);
      if (to) params.set('to', to);
    }
    return params.toString();
  }, [period, from, to]);

  // Aggregates + breakdowns — one load per range/refresh change.
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const q = `?${rangeQuery}`;
        const [ov, tr, st, pay] = await Promise.all([
          api.get<Overview>(`/admin/reports/sales/overview${q}`),
          api.get<Trend>(`/admin/reports/sales/trend${q}`),
          api.get<StatusBreakdown>(`/admin/reports/sales/orders${q}`),
          api.get<PaymentBreakdown>(`/admin/reports/sales/payments${q}`),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setTrend(tr);
        setStatusBreakdown(st);
        setPaymentBreakdown(pay);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load sales reports.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [rangeQuery, refreshKey]);

  // Paginated tables — separate effect so paging doesn't refetch aggregates.
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setTablesLoading(true);
        const q = `?${rangeQuery}&page=${productPage}&limit=10`;
        const qCat = `?${rangeQuery}&page=${categoryPage}&limit=10`;
        const [pr, cat] = await Promise.all([
          api.get<TopProducts>(`/admin/reports/sales/products${q}`),
          api.get<TopCategories>(`/admin/reports/sales/categories${qCat}`),
        ]);
        if (cancelled) return;
        setProducts(pr);
        setCategories(cat);
      } catch (err: any) {
        if (!cancelled) setError((prev) => prev || err.message || 'Failed to load report tables.');
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [rangeQuery, productPage, categoryPage, refreshKey]);

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    setProductPage(1);
    setCategoryPage(1);
  };

  const applyCustomRange = () => {
    // Only re-query when both dates are present; validation errors surface
    // from the API otherwise.
    if (period === 'custom' && from && to) {
      setProductPage(1);
      setCategoryPage(1);
      setRefreshKey((k) => k + 1);
    }
  };

  const maxBreakdownCount = (rows: Array<{ count: number }>) => Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7" />
            Sales Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            {overview ? `${overview.period} · UTC date boundaries` : 'Real sales performance from live order data'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onChange={(e) => handlePeriodChange(e.target.value)} className="w-44">
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {period === 'custom' && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              <Button size="md" onClick={applyCustomRange} disabled={!from || !to}>
                Apply
              </Button>
            </>
          )}
          <Button variant="outline" size="md" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
              <Button variant="outline" size="sm" onClick={() => setRefreshKey((k) => k + 1)}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard title="Revenue" icon={DollarSign} loading={loading}>
          {formatCurrency(overview?.revenue ?? 0, 'USD')}
        </KpiCard>
        <KpiCard title="Orders" icon={ShoppingCart} loading={loading}>
          {overview?.totalOrders ?? 0}
        </KpiCard>
        <KpiCard title="Avg. Order Value" icon={Receipt} loading={loading}>
          {formatCurrency(overview?.averageOrderValue ?? 0, 'USD')}
        </KpiCard>
        <KpiCard title="Units Sold" icon={Boxes} loading={loading}>
          {overview?.unitsSold ?? 0}
        </KpiCard>
        <KpiCard
          title="Paid Orders"
          icon={CheckCircle2}
          loading={loading}
          sub={
            overview && overview.totalOrders > 0
              ? `${Math.round((overview.paidOrders / overview.totalOrders) * 100)}% of included orders`
              : undefined
          }
        >
          {overview?.paidOrders ?? 0}
        </KpiCard>
      </div>

      {/* Trend chart */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-lg">Sales Trend</h2>
            <div className="flex gap-2">
              {(['revenue', 'orders', 'units'] as const).map((m) => (
                <Button key={m} size="sm" variant={metric === m ? 'primary' : 'outline'} onClick={() => setMetric(m)}>
                  {m === 'revenue' ? 'Revenue' : m === 'orders' ? 'Orders' : 'Units'}
                </Button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="h-60 flex items-center justify-center">
              <Skeleton className="h-full w-full rounded-lg" />
            </div>
          ) : trend && trend.days.some((d) => d[metric] > 0) ? (
            <TrendChart days={trend.days} metric={metric} />
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium">No sales in this period</p>
              <p className="text-xs text-muted-foreground mt-1">
                Orders appear here once customers place them within the selected range.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold text-lg mb-4">Order Status Breakdown</h2>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-2/3" />
              </div>
            ) : statusBreakdown && statusBreakdown.breakdown.length > 0 ? (
              <div className="space-y-2.5">
                {statusBreakdown.breakdown.map((row) => (
                  <div key={row.status} className="flex items-center gap-3">
                    <Badge variant={statusVariant(row.status)} size="sm" className="w-40 justify-center shrink-0">
                      {row.status.replace(/_/g, ' ')}
                    </Badge>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${(row.count / maxBreakdownCount(statusBreakdown.breakdown)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-10 text-right">{row.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No orders in this period.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold text-lg mb-4">Payment Status Breakdown</h2>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-8 w-1/2" />
              </div>
            ) : paymentBreakdown && paymentBreakdown.breakdown.length > 0 ? (
              <div className="space-y-2.5">
                {paymentBreakdown.breakdown.map((row) => (
                  <div key={row.paymentStatus} className="flex items-center gap-3">
                    <Badge variant={statusVariant(row.paymentStatus)} size="sm" className="w-40 justify-center shrink-0">
                      {row.paymentStatus}
                    </Badge>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${(row.count / maxBreakdownCount(paymentBreakdown.breakdown)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-10 text-right">{row.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No orders in this period.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold text-lg mb-4">Top Products</h2>
          {tablesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : products && products.products.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                      <th className="pb-2 pr-4 font-semibold">Product</th>
                      <th className="pb-2 pr-4 font-semibold">Category</th>
                      <th className="pb-2 pr-4 font-semibold text-right">Units</th>
                      <th className="pb-2 pr-4 font-semibold text-right">Revenue</th>
                      <th className="pb-2 font-semibold text-right">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.products.map((p) => (
                      <tr key={p.productId} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4">
                          <p className="font-medium">{p.productName}</p>
                          {p.sku && <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{p.categoryName}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{p.unitsSold}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{formatCurrency(p.revenue, 'USD')}</td>
                        <td className="py-2.5 text-right">{p.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={products.pagination.page}
                limit={products.pagination.limit}
                total={products.pagination.total}
                onPage={setProductPage}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No product sales in this period.</p>
          )}
        </CardContent>
      </Card>

      {/* Category performance */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold text-lg mb-4">Category Performance</h2>
          {tablesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : categories && categories.categories.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                      <th className="pb-2 pr-4 font-semibold">Category</th>
                      <th className="pb-2 pr-4 font-semibold text-right">Units</th>
                      <th className="pb-2 pr-4 font-semibold text-right">Revenue</th>
                      <th className="pb-2 font-semibold text-right">Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.categories.map((c) => (
                      <tr key={c.categoryId ?? 'uncategorized'} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium">{c.categoryName}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{c.unitsSold}</td>
                        <td className="py-2.5 pr-4 text-right font-semibold">{formatCurrency(c.revenue, 'USD')}</td>
                        <td className="py-2.5 text-right">{c.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                page={categories.pagination.page}
                limit={categories.pagination.limit}
                total={categories.pagination.total}
                onPage={setCategoryPage}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No category sales in this period.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const TablePager: React.FC<{
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}> = ({ page, limit, total, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <p className="text-muted-foreground">
        {total} {total === 1 ? 'row' : 'rows'}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-muted-foreground">
          Page {page} of {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default AdminReports;
