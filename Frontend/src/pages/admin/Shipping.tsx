import * as React from 'react';
import { Truck, Loader2, AlertCircle, User, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Shipment {
  id: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  shippingCost: number;
  shippedAt?: string;
  estimatedDelivery?: string;
  order: {
    id: string;
    orderNumber: string;
    user: {
      email: string;
      firstName?: string;
      lastName?: string;
    };
  };
}

export const AdminShipping: React.FC = () => {
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchShipments = async () => {
      try {
        setLoading(true);
        const res = await api.get<{ shipments: Shipment[] }>('/admin/shipments');
        setShipments(res.shipments || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load shipments');
      } finally {
        setLoading(false);
      }
    };
    fetchShipments();
  }, []);

  const getStatusVariant = (status: string) => {
    const map: Record<string, any> = {
      PENDING: 'warning',
      PROCESSING: 'info',
      SHIPPED: 'primary',
      IN_TRANSIT: 'primary',
      OUT_FOR_DELIVERY: 'primary',
      DELIVERED: 'success',
      FAILED: 'default',
      RETURNED: 'default',
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
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Shipments</h1>
        <p className="text-muted-foreground mt-1">Track and manage shipments ({shipments.length} shipments)</p>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center h-96">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-semibold">Failed to Load Shipments</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      ) : shipments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No Shipments</p>
            <p className="text-sm text-muted-foreground mt-2">No active shipments</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm">Tracking #</th>
                    <th className="text-left p-4 font-semibold text-sm">Order</th>
                    <th className="text-left p-4 font-semibold text-sm">Customer</th>
                    <th className="text-left p-4 font-semibold text-sm">Carrier</th>
                    <th className="text-left p-4 font-semibold text-sm">Status</th>
                    <th className="text-left p-4 font-semibold text-sm">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-4">
                        <span className="font-medium text-sm">{shipment.trackingNumber}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{shipment.order.orderNumber}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {shipment.order.user.firstName || shipment.order.user.email}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" size="sm">{shipment.carrier}</Badge>
                      </td>
                      <td className="p-4">
                        <Badge variant={getStatusVariant(shipment.status)} size="sm">
                          {shipment.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-sm">
                          {formatCurrency(shipment.shippingCost, 'USD')}
                        </span>
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
