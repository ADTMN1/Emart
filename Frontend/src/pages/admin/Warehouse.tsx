import * as React from 'react';
import { Package, Loader2, AlertCircle, User, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';

interface WarehousePackage {
  id: string;
  packageNumber: string;
  status: string;
  weight?: number;
  receivedAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  order?: {
    id: string;
    orderNumber: string;
  };
}

export const AdminWarehouse: React.FC = () => {
  const [packages, setPackages] = React.useState<WarehousePackage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        const res = await api.get<{ packages: WarehousePackage[] }>('/admin/warehouse-packages');
        setPackages(res.packages || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load packages');
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, []);

  const getStatusVariant = (status: string) => {
    const map: Record<string, any> = {
      RECEIVED: 'info',
      INSPECTED: 'info',
      STORED: 'default',
      READY_TO_SHIP: 'warning',
      CONSOLIDATED: 'primary',
      SHIPPED: 'success',
      DELIVERED: 'success',
    };
    return map[status] || 'default';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Warehouse Packages</h1>
        <p className="text-muted-foreground mt-1">Manage warehouse inventory ({packages.length} packages)</p>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center h-96">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-semibold">Failed to Load Packages</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No Packages</p>
            <p className="text-sm text-muted-foreground mt-2">No packages in warehouse</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm">Package #</th>
                    <th className="text-left p-4 font-semibold text-sm">Customer</th>
                    <th className="text-left p-4 font-semibold text-sm">Order</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                    <th className="text-left p-4 font-semibold text-sm">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{pkg.packageNumber}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {pkg.user.firstName || pkg.user.email}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">
                          {pkg.order ? pkg.order.orderNumber : '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant={getStatusVariant(pkg.status)} size="sm">
                          {pkg.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {new Date(pkg.receivedAt).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
