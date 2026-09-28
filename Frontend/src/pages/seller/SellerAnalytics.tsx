import * as React from 'react';
import { Link } from 'react-router-dom';
import { Package, Boxes, Tags, MessageSquare, TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/States';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { sellerProductApi, messageApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AnalyticsProduct {
  id: string;
  name: string;
  category: { id: string; name: string } | null;
  stock: number;
  isAvailable: boolean;
}

export const SellerAnalytics: React.FC = () => {
  const [products, setProducts] = React.useState<AnalyticsProduct[]>([]);
  const [totalProducts, setTotalProducts] = React.useState<number | null>(null);
  const [totalConversations, setTotalConversations] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    Promise.allSettled([
      sellerProductApi.list({ page: 1, limit: 100 }),
      messageApi.sellerConversations({ page: 1, limit: 1 }),
    ]).then(([productRes, convRes]) => {
      if (!active) return;
      if (productRes.status === 'fulfilled') {
        setProducts(
          productRes.value.products.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            stock: p.stock,
            isAvailable: p.isAvailable,
          })),
        );
        setTotalProducts(productRes.value.pagination.total);
      }
      if (convRes.status === 'fulfilled') setTotalConversations(convRes.value.pagination.total);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const activeListings = products.filter((p) => p.isAvailable);
  const totalUnits = activeListings.reduce((sum, p) => sum + p.stock, 0);

  const categoryCounts = new Map<string, number>();
  products.forEach((p) => {
    const name = p.category?.name || 'Uncategorized';
    categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  });
  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCategoryCount = topCategories[0]?.[1] ?? 1;

  const metrics = [
    { label: 'Active Listings', value: totalProducts == null ? '—' : String(totalProducts), icon: Package, tone: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Units in Stock', value: String(Math.max(0, totalUnits)), icon: Boxes, tone: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Categories Used', value: String(categoryCounts.size), icon: Tags, tone: 'text-success', bg: 'bg-success/10' },
    { label: 'Conversations', value: totalConversations == null ? '—' : String(totalConversations), icon: MessageSquare, tone: 'text-secondary', bg: 'bg-secondary/10' },
  ];

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Analytics"
        description="Store performance metrics derived from your current listing and message data. Revenue and best sellers are in the sales report."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.label}>
              <CardContent className="p-5">
                <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-lg', m.bg)}>
                  <Icon className={cn('h-5 w-5', m.tone)} />
                </div>
                <p className="font-display text-2xl font-extrabold text-foreground">{m.value}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{m.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Tags className="h-4 w-4 text-destructive" />
              Top Categories
            </h2>
            {topCategories.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No categorized products yet.</p>
            ) : (
              <div className="space-y-3">
                {topCategories.map(([name, count]) => (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{name}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-destructive"
                        style={{ width: `${Math.max(4, (count / maxCategoryCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col justify-between p-5">
            <div>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Revenue &amp; Best Sellers
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Revenue, order trends and best sellers live in the sales report, computed from the order lines of your
                own listings.
              </p>
            </div>
            <Link to="/seller/sales" className="mt-4">
              <Button variant="outline" size="sm">
                Open Sales Report
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SellerAnalytics;