import * as React from 'react';
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Info, Plus, Trash2, CreditCard, Banknote, Bitcoin, Settings as SettingsIcon, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface WalletTransaction {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency?: string;
  description?: string | null;
  title?: string | null;
  createdAt: string;
}

interface PaymentMethod {
  id: string;
  type: string;
  details: Record<string, any>;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const typeLabel = (type: string): string => type.charAt(0) + type.slice(1).toLowerCase();
const statusVariant = (status: string): 'success' | 'warning' | 'destructive' | 'secondary' | 'outline' =>
  status === 'COMPLETED' || status === 'SUCCESS'
    ? 'success'
    : status === 'PENDING' || status === 'PROCESSING'
      ? 'warning'
      : status === 'FAILED' || status === 'CANCELLED'
        ? 'destructive'
        : 'outline';

const paymentMethodTypeLabels: Record<string, string> = {
  CARD: 'Credit/Debit Card',
  BANK_TRANSFER: 'Bank Transfer',
  CRYPTO: 'Cryptocurrency',
  PAYPAL: 'PayPal',
  WISE: 'Wise',
  PAYONEER: 'Payoneer',
};

const paymentMethodTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  CARD: CreditCard,
  BANK_TRANSFER: Banknote,
  CRYPTO: Bitcoin,
  PAYPAL: SettingsIcon,
  WISE: SettingsIcon,
  PAYONEER: SettingsIcon,
};

const paymentMethodTypeFields: Record<string, { label: string; placeholder: string; type?: string }[]> = {
  CARD: [
    { label: 'Cardholder Name', placeholder: 'John Doe' },
    { label: 'Card Number (last 4)', placeholder: '1234' },
    { label: 'Expiry Date', placeholder: 'MM/YY', type: 'text' },
  ],
  BANK_TRANSFER: [
    { label: 'Account Holder Name', placeholder: 'John Doe' },
    { label: 'IBAN', placeholder: 'DE89370400440532013000' },
    { label: 'SWIFT/BIC', placeholder: 'COBADEFFXXX' },
    { label: 'Bank Name', placeholder: 'Commerzbank' },
  ],
  CRYPTO: [
    { label: 'Currency', placeholder: 'USDT, BTC, ETH, etc.' },
    { label: 'Network', placeholder: 'ERC20, TRC20, BEP20, etc.' },
    { label: 'Wallet Address', placeholder: '0x...' },
  ],
  PAYPAL: [
    { label: 'PayPal Email', placeholder: 'john@example.com', type: 'email' },
  ],
  WISE: [
    { label: 'Account Email', placeholder: 'john@example.com', type: 'email' },
  ],
  PAYONEER: [
    { label: 'Account Email', placeholder: 'john@example.com', type: 'email' },
  ],
};

export const SellerPayments: React.FC = () => {
  const { toast } = useToast();
  const [balance, setBalance] = React.useState<{ balance: number; currency: string } | null>(null);
  const [transactions, setTransactions] = React.useState<WalletTransaction[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingMethod, setEditingMethod] = React.useState<PaymentMethod | null>(null);
  const [formData, setFormData] = React.useState({
    type: 'CARD',
    details: {} as Record<string, any>,
    isDefault: false,
  });

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [walletRes, txRes, pmRes] = await Promise.allSettled([
        api.get<{ balance: number; currency: string }>('/wallet'),
        api.get<{ transactions?: WalletTransaction[] }>('/wallet/transactions'),
        api.get<{ methods: PaymentMethod[] }>('/seller/payment-methods'),
      ]);

      if (walletRes.status === 'fulfilled') setBalance(walletRes.value);
      if (txRes.status === 'fulfilled') {
        const raw = txRes.value.transactions;
        setTransactions(Array.isArray(raw) ? raw : []);
      }
      if (pmRes.status === 'fulfilled') setPaymentMethods(pmRes.value.methods || []);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed to load', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      type,
      details: {},
    }));
  };

  const handleDetailChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      details: { ...prev.details, [key]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(formData.type);
    try {
      if (editingMethod) {
        await api.put(`/seller/payment-methods/${editingMethod.id}`, {
          details: formData.details,
          isDefault: formData.isDefault,
        });
        toast({ variant: 'success', title: 'Updated', description: 'Payment method updated successfully.' });
      } else {
        await api.post('/seller/payment-methods', {
          type: formData.type,
          details: formData.details,
          isDefault: formData.isDefault,
        });
        toast({ variant: 'success', title: 'Added', description: 'Payment method added successfully.' });
      }
      setDialogOpen(false);
      setEditingMethod(null);
      setFormData({ type: 'CARD', details: {}, isDefault: false });
      loadData();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed', description: err.message });
    } finally {
      setSaving(null);
    }
  };

  const handleEdit = (method: PaymentMethod) => {
    setEditingMethod(method);
    setFormData({
      type: method.type,
      details: method.details,
      isDefault: method.isDefault,
    });
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingMethod(null);
    setFormData({ type: 'CARD', details: {}, isDefault: false });
    setDialogOpen(true);
  };

  const handleDelete = async (methodId: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    try {
      await api.delete(`/seller/payment-methods/${methodId}`);
      toast({ variant: 'success', title: 'Deleted', description: 'Payment method removed.' });
      loadData();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed', description: err.message });
    }
  };

  const handleToggleDefault = async (method: PaymentMethod) => {
    try {
      await api.put(`/seller/payment-methods/${method.id}`, {
        isDefault: !method.isDefault,
      });
      loadData();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Failed', description: err.message });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SellerPageHeader
          title="Payments"
          description="Your EMART wallet balance, transaction history, and payout methods."
        />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const fields = paymentMethodTypeFields[formData.type] || [];

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Payments"
        description="Your EMART wallet balance, transaction history, and payout methods."
      />

      {/* Wallet Balance */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <WalletIcon className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Available Balance</p>
              <p className="font-display text-3xl font-extrabold text-foreground">
                {formatCurrency(balance?.balance ?? 0)}
              </p>
            </div>
          </div>
          <Badge variant="warning" className="gap-1">
            <Info className="h-3 w-3" />
            Seller payouts are processed from this balance
          </Badge>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <CardHeader className="flex-1">
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            Payout Methods
          </CardTitle>
        </CardHeader>
        <Button onClick={handleAddNew} className="sm:ml-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Method
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {paymentMethods.length === 0 ? (
            <EmptyState
              title="No payout methods yet"
              description="Add a payment method to receive payouts from your sales."
              action={{
                label: 'Add Payment Method',
                onClick: handleAddNew,
              }}
            />
          ) : (
            <div className="divide-y divide-border/60">
              {paymentMethods.map((method) => {
                const Icon = paymentMethodTypeIcons[method.type] || SettingsIcon;
                const fieldList = paymentMethodTypeFields[method.type] || [];
                return (
                  <div key={method.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
                        method.isDefault ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="truncate text-sm font-medium text-foreground">
                            {paymentMethodTypeLabels[method.type] || method.type}
                          </p>
                          {method.isDefault && (
                            <Badge variant="primary" size="xs">
                              <Check className="h-2.5 w-2.5 mr-1" />
                              Default
                            </Badge>
                          )}
                          {!method.isActive && (
                            <Badge variant="secondary" size="xs">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {fieldList.map(f => method.details[f.label]).filter(Boolean).join(' • ') || 'No details'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!method.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleDefault(method)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                          Set Default
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(method)}
                      >
                        <SettingsIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(method.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-foreground">Transaction History</h2>
          {transactions.length === 0 ? (
            <EmptyState
              title="No transactions yet"
              description="Deposits, payouts and order payments for your store will appear here."
            />
          ) : (
            <div className="divide-y divide-border/60">
              {transactions.slice(0, 30).map((tx) => {
                const incoming = tx.amount > 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          incoming ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {tx.description || tx.title || typeLabel(tx.type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant={statusVariant(tx.status)} size="sm">
                        {tx.status.charAt(0) + tx.status.slice(1).toLowerCase()}
                      </Badge>
                      <span className={cn('text-sm font-bold', incoming ? 'text-success' : 'text-foreground')}>
                        {incoming ? '+' : ''}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Payment Method Modal */}
      <Modal
        isOpen={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingMethod(null); setFormData({ type: 'CARD', details: {}, isDefault: false }); }}
        title={editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingMethod(null); setFormData({ type: 'CARD', details: {}, isDefault: false }); }}>
              Cancel
            </Button>
            <Button type="submit" form="payment-method-form" disabled={saving === formData.type}>
              {saving === formData.type ? 'Saving...' : (editingMethod ? 'Save Changes' : 'Add Method')}
            </Button>
          </>
        }
      >
        <form id="payment-method-form" onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Method Type</label>
              <Select value={formData.type} onChange={(e) => handleTypeChange(e.target.value)}>
                {Object.entries(paymentMethodTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>

            {fields.map((field, index) => (
              <div key={index} className="grid gap-2">
                <label className="text-sm font-medium text-foreground">{field.label}</label>
                <Input
                  type={field.type || 'text'}
                  placeholder={field.placeholder}
                  value={formData.details[field.label] || ''}
                  onChange={(e) => handleDetailChange(field.label, e.target.value)}
                  required
                />
              </div>
            ))}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="isDefault" className="text-sm text-foreground">
                Set as default payout method
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SellerPayments;