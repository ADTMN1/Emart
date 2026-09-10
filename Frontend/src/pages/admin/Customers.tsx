import * as React from 'react';
import { Users, Loader2, AlertCircle, Calendar, ShoppingCart, Trash2, Ban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';

interface Customer {
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

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [suspendedCustomers, setSuspendedCustomers] = React.useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = React.useState(false);
  const [customerToAction, setCustomerToAction] = React.useState<Customer | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const res = await api.get<{ users: Customer[] }>('/admin/users');
        setCustomers(res.users || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load customers');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  const getCustomerName = (customer: Customer) => {
    if (customer.firstName || customer.lastName) {
      return `${customer.firstName || ''} ${customer.lastName || ''}`.trim();
    }
    return 'Customer';
  };

  const handleRemoveCustomer = async (customerId: string, email: string) => {
    setCustomerToAction(customers.find(c => c.id === customerId) || null);
    setDeleteModalOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!customerToAction) return;

    try {
      setActionLoading(true);
      await api.delete(`/admin/users/${customerToAction.id}`);
      setCustomers(customers.filter(c => c.id !== customerToAction.id));
      setDeleteModalOpen(false);
      
      toast({
        variant: 'success',
        title: 'Customer Removed',
        description: `${customerToAction.email} has been removed successfully`,
      });
      
      setCustomerToAction(null);
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Delete Failed',
        description: err.message || 'Failed to remove customer',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendCustomer = async (customerId: string) => {
    setCustomerToAction(customers.find(c => c.id === customerId) || null);
    setSuspendModalOpen(true);
  };

  const handleConfirmSuspend = async () => {
    if (!customerToAction) return;

    try {
      setActionLoading(true);
      const isSuspended = suspendedCustomers.has(customerToAction.id);
      await api.put(`/admin/users/${customerToAction.id}`, { suspended: !isSuspended });
      
      if (isSuspended) {
        const newSuspended = new Set(suspendedCustomers);
        newSuspended.delete(customerToAction.id);
        setSuspendedCustomers(newSuspended);
      } else {
        setSuspendedCustomers(new Set([...suspendedCustomers, customerToAction.id]));
      }
      
      setSuspendModalOpen(false);
      
      toast({
        variant: 'success',
        title: 'Customer Updated',
        description: `Customer has been ${isSuspended ? 'activated' : 'suspended'} successfully`,
      });
      
      setCustomerToAction(null);
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Update Failed',
        description: err.message || 'Failed to update customer status',
      });
    } finally {
      setActionLoading(false);
    }
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
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Customers</h1>
        <p className="text-muted-foreground mt-1">Manage customer accounts ({customers.length} customers)</p>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center h-96">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-lg font-semibold">Failed to Load Customers</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-semibold">No Customers</p>
            <p className="text-sm text-muted-foreground mt-2">No customer accounts yet</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left p-4 font-semibold text-sm">Customer</th>
                    <th className="text-left p-4 font-semibold text-sm">Email</th>
                    <th className="text-left p-4 font-semibold text-sm">Role</th>
                    <th className="text-left p-4 font-semibold text-sm">Orders</th>
                    <th className="text-left p-4 font-semibold text-sm">Joined</th>
                    <th className="text-left p-4 font-semibold text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{getCustomerName(customer)}</p>
                            <p className="text-xs text-muted-foreground">ID: {customer.id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{customer.email}</span>
                      </td>
                      <td className="p-4">
                        <Badge variant={customer.role === 'ADMIN' ? 'primary' : 'default'} size="sm">
                          {customer.role}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">{customer._count.orders}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {new Date(customer.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={suspendedCustomers.has(customer.id) ? 'secondary' : 'outline'}
                            onClick={() => handleSuspendCustomer(customer.id)}
                            disabled={actionLoading}
                            className="gap-1.5"
                            title={suspendedCustomers.has(customer.id) ? 'Unsuspend customer' : 'Suspend customer'}
                          >
                            {actionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline text-xs">{suspendedCustomers.has(customer.id) ? 'Active' : 'Suspend'}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRemoveCustomer(customer.id, customer.email)}
                            disabled={actionLoading}
                            className="gap-1.5"
                            title="Remove customer"
                          >
                            {actionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline text-xs">Remove</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModalOpen}
          onClose={() => !actionLoading && setDeleteModalOpen(false)}
          title="Remove Customer"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove <strong>{customerToAction?.email}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteModalOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmRemove} isLoading={actionLoading}>
                Remove
              </Button>
            </div>
          </div>
        </Modal>

        {/* Suspend Confirmation Modal */}
        <Modal
          isOpen={suspendModalOpen}
          onClose={() => !actionLoading && setSuspendModalOpen(false)}
          title={suspendedCustomers.has(customerToAction?.id || '') ? 'Activate Customer' : 'Suspend Customer'}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to {suspendedCustomers.has(customerToAction?.id || '') ? 'activate' : 'suspend'} this customer? They will {suspendedCustomers.has(customerToAction?.id || '') ? 'be able to' : 'not be able to'} access their account.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSuspendModalOpen(false)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={handleConfirmSuspend} isLoading={actionLoading}>
                {suspendedCustomers.has(customerToAction?.id || '') ? 'Activate' : 'Suspend'}
              </Button>
            </div>
          </div>
        </Modal>
        </>
      )}
    </div>
  );
};
