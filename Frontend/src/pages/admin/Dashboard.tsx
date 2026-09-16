import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Users,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  revenueChange: number;
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  createdAt: string;
  _count: {
    orders: number;
  };
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  total: number;
  status: string;
  createdAt: string;
}

interface RecentProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  createdAt: string;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [totalUsers, setTotalUsers] = React.useState<number>(0);
  const [recentOrders, setRecentOrders] = React.useState<RecentOrder[]>([]);
  const [recentProducts, setRecentProducts] = React.useState<RecentProduct[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [statsRes, usersRes, ordersRes, productsRes] = await Promise.all([
          api.get<{ success: boolean; data: DashboardStats }>('/admin/stats'),
          api.get<{ users: User[] }>('/admin/users'),
          api.get<{ data: RecentOrder[] }>('/orders?limit=5'),
          api.get<{ data: RecentProduct[] }>('/products?limit=5&sortBy=createdAt&order=desc'),
        ]);

        // Extract data from responses
        if (statsRes.success && statsRes.data) {
          setStats(statsRes.data);
        }
        
        if (usersRes.users && Array.isArray(usersRes.users)) {
          console.log('Users found:', usersRes.users.length);
          setTotalUsers(usersRes.users.length);
        }
        
        if (ordersRes.data && Array.isArray(ordersRes.data)) {
          setRecentOrders(ordersRes.data);
        }
        
        if (productsRes.data && Array.isArray(productsRes.data)) {
          setRecentProducts(productsRes.data);
        }
      } catch (err: any) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold text-foreground">Failed to Load Dashboard</p>
        <p className="text-sm text-muted-foreground mt-2">{error}</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Customer',
      value: totalUsers,
      subtitle: 'Registered customers',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      link: '/admin/customers',
    },
    {
      title: 'Total Products',
      value: stats?.totalProducts || 0,
      subtitle: `${stats?.activeProducts || 0} active`,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      link: '/admin/products',
    },
    {
      title: 'Total Orders',
      value: stats?.totalOrders || 0,
      subtitle: `${stats?.pendingOrders || 0} pending`,
      icon: ShoppingCart,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      link: '/admin/orders',
    },
    {
      title: 'Revenue',
      value: formatCurrency(stats?.totalRevenue || 0, 'USD'),
      subtitle: stats?.revenueChange
        ? `${stats.revenueChange > 0 ? '+' : ''}${stats.revenueChange.toFixed(1)}% vs last month`
        : 'No change',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      trend: stats?.revenueChange,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your EMART operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold mt-2">{stat.value}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                      {stat.trend !== undefined && (
                        <span className="flex items-center text-xs font-semibold">
                          {stat.trend > 0 ? (
                            <ArrowUpRight className="h-3 w-3 text-green-600" />
                          ) : stat.trend < 0 ? (
                            <ArrowDownRight className="h-3 w-3 text-red-600" />
                          ) : null}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-xl`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
                {stat.link && (
                  <Link
                    to={stat.link}
                    className="text-xs font-semibold text-primary hover:underline mt-4 inline-block"
                  >
                    View all →
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Orders & Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Recent Orders</h2>
              <Link
                to="/admin/orders"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
              ) : (
                recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/admin/orders/${order.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {order.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.user.firstName || order.user.email}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-sm">
                        {formatCurrency(order.total, 'USD')}
                      </p>
                      <Badge
                        variant={
                          order.status === 'PENDING'
                            ? 'warning'
                            : order.status === 'DELIVERED'
                            ? 'success'
                            : 'default'
                        }
                        size="sm"
                        className="mt-1"
                      >
                        {order.status}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Products */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Recent Products</h2>
              <Link
                to="/admin/products"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all →
              </Link>
            </div>
            <div className="space-y-3">
              {recentProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No products yet</p>
              ) : (
                recentProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/admin/products/${product.id}/edit`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Stock: {product.stock}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-sm">
                        {formatCurrency(product.price, 'USD')}
                      </p>
                      <Badge
                        variant={product.isAvailable ? 'success' : 'default'}
                        size="sm"
                        className="mt-1"
                      >
                        {product.isAvailable ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert */}
      {recentProducts.some((p) => p.stock <= 5) && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-amber-900">Low Stock Alert</h3>
                <p className="text-sm text-amber-800 mt-1">
                  {recentProducts.filter((p) => p.stock <= 5).length} product(s) have low stock
                  levels. Consider restocking soon.
                </p>
              </div>
              <Link to="/admin/products?filter=lowStock">
                <Badge variant="warning">View</Badge>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
