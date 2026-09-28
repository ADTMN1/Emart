import * as React from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Package, PackageX, Search, Info, ExternalLink, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState, Loading, Skeleton } from '@/components/ui/States';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { sellerProductApi } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';

interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  isAvailable: boolean;
  isNew: boolean;
  condition: string;
  category: { id: string; name: string } | null;
  createdAt: string;
}

type StockFilter = 'all' | 'in-stock' | 'low' | 'out';

const stockLevel = (item: InventoryItem): StockFilter => {
  if (!item.isAvailable || item.stock <= 0) return 'out';
  if (item.stock <= 5) return 'low';
  return 'in-stock';
};

export const SellerInventory: React.FC = () => {
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<StockFilter>('all');

  React.useEffect(() => {
    let active = true;
    sellerProductApi
      .list({ page: 1, limit: 100 })
      .then((res) => {
        if (!active) return;
        setItems(
          res.products.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: p.price,
            stock: p.stock,
            isAvailable: p.isAvailable,
            isNew: p.isNew,
            condition: p.condition,
            category: p.category,
            createdAt: p.createdAt,
          })),
        );
        setTotal(res.pagination.total);
      })
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = items.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || item.name.toLowerCase().includes(query) || (item.sku?.toLowerCase().includes(query) ?? false);
    const matchesFilter = filter === 'all' || stockLevel(item) === filter;
    return matchesSearch && matchesFilter;
  });

  const counts = {
    all: total,
    'in-stock': items.filter((i) => stockLevel(i) === 'in-stock').length,
    low: items.filter((i) => stockLevel(i) === 'low').length,
    out: items.filter((i) => stockLevel(i) === 'out').length,
  };

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Inventory"
        description="Track stock levels across your listings. Stock is updated from the product editor."
        action={
          <Link to="/seller/products/new">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-600">
              <Package className="h-4 w-4" />
              Add Product
            </span>
          </Link>
        }
      />

      {/* Stock summary — always real numbers derived from the product list. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            { key: 'all' as const, label: 'Total Products', icon: Package, accent: 'from-primary to-primary-600' },
            { key: 'in-stock' as const, label: 'In Stock', icon: Boxes, accent: 'from-success to-emerald-500' },
            { key: 'low' as const, label: 'Low Stock (≤5)', icon: AlertTriangle, accent: 'from-warning to-amber-500' },
            { key: 'out' as const, label: 'Out of Stock', icon: PackageX, accent: 'from-destructive to-rose-500' },
          ]
        ).map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key}>
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="font-display text-2xl font-extrabold text-foreground lg:text-3xl">{counts[c.key]}</p>
                  <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </p>
                </div>
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm',
                    c.accent,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-sm">
          <Input
            variant="search"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="sm:w-56">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as StockFilter)}>
            <option value="all">All stock levels</option>
            <option value="in-stock">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
        </div>
      </div>

      {/* Inventory table */}
      {loading ? (
        <Card>
          <CardContent className="p-5">
            <Skeleton className="mb-4 h-6 w-48" />
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-10 w-10" />}
          title={search || filter !== 'all' ? 'No matching products' : 'No products yet'}
          description={
            search || filter !== 'all'
              ? 'Try adjusting your search or stock filter.'
              : 'Add your first product and it will appear here for stock management.'
          }
          action={
            search || filter !== 'all'
              ? {
                  label: 'Clear filters',
                  onClick: () => {
                    setSearch('');
                    setFilter('all');
                  },
                }
              : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="hidden grid-cols-12 gap-3 border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <div className="col-span-5">Product</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-3 text-right">Stock</div>
            </div>
            <div className="divide-y divide-border/60">
              {filtered.slice(0, 100).map((item) => (
                <Link
                  key={item.id}
                  to={`/seller/products/${item.id}/edit`}
                  className="grid grid-cols-2 items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 md:grid-cols-12"
                >
                  <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.sku ? `SKU ${item.sku}` : (item.category?.name || 'Uncategorized')}</p>
                    </div>
                  </div>
                  <p className="hidden truncate text-sm text-muted-foreground md:col-span-2 md:block">
                    {item.category?.name || '—'}
                  </p>
                  <p className="hidden text-sm font-semibold text-foreground md:col-span-2 md:block">
                    {formatCurrency(item.price)}
                  </p>
                  <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-3">
                    <Badge variant={stockLevel(item) === 'in-stock' ? 'success' : stockLevel(item) === 'low' ? 'warning' : 'destructive'} size="sm">
                      {stockLevel(item) === 'out' ? 'Out of stock' : `${item.stock} in stock`}
                    </Badge>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Showing the first {Math.min(filtered.length, 100)} of {total} products. To adjust quantity or availability,
          open a product from the list above.
        </span>
      </div>
    </div>
  );
};

export default SellerInventory;