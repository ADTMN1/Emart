import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  FileText,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api, loanApi, type LoanRequestAdmin, type LoanRequestStats } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const statusVariant = (status: string): 'warning' | 'success' | 'destructive' | 'default' => {
  const map: Record<string, any> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'destructive',
  };
  return map[status] || 'default';
};

interface AdminLoanRequestListResponse {
  loanRequests: LoanRequestAdmin[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export const AdminLoanRequests: React.FC = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AdminLoanRequestListResponse | null>(null);
  const [stats, setStats] = React.useState<LoanRequestStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<LoanRequestAdmin | null>(null);
  const [actionModal, setActionModal] = React.useState<'approve' | 'reject' | null>(null);
  const [decisionNote, setDecisionNote] = React.useState('');
  const [acting, setActing] = React.useState(false);

  const fetchLoanRequests = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await api.get<AdminLoanRequestListResponse>(`/admin/loans?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load loan requests.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  const fetchStats = React.useCallback(async () => {
    try {
      const res = await loanApi.adminStats();
      setStats(res);
    } catch (err: any) {
      console.error('Failed to load loan request stats:', err);
    }
  }, []);

  React.useEffect(() => {
    fetchLoanRequests();
    fetchStats();
  }, [fetchLoanRequests, fetchStats]);

  const openAction = (loan: LoanRequestAdmin, action: 'approve' | 'reject') => {
    setSelected(loan);
    setDecisionNote('');
    setActionModal(action);
  };

  const runAction = async () => {
    if (!selected || !actionModal) return;
    try {
      setActing(true);
      await loanApi.adminDecide(selected.id, {
        decision: actionModal === 'approve' ? 'APPROVED' : 'REJECTED',
        decisionNote: decisionNote.trim() || undefined,
      });
      toast({ variant: 'success', title: `Loan request ${actionModal}d successfully` });
      setActionModal(null);
      setSelected(null);
      await fetchLoanRequests();
      await fetchStats();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Action failed', description: err.message || 'Please try again.' });
    } finally {
      setActing(false);
    }
  };

  const rows = data?.loanRequests ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="h-7 w-7" />
            Loan Requests
          </h1>
          <p className="text-muted-foreground mt-1">Review and manage customer loan requests.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="md" onClick={fetchLoanRequests} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats?.total ?? 0, icon: CreditCard, color: 'text-blue-600', bgColor: 'bg-blue-50' },
          { label: 'Pending', value: stats?.pending ?? 0, icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-50' },
          { label: 'Approved', value: stats?.approved ?? 0, icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' },
          { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
        ].map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} p-3 rounded-xl`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading loan requests…</p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 font-semibold">No loan requests found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Customer loan requests will appear here when submitted.
              </p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-4 font-semibold">Customer</th>
                    <th className="p-4 font-semibold">Amount</th>
                    <th className="p-4 font-semibold">Purpose</th>
                    <th className="p-4 font-semibold">Repayment</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Submitted</th>
                    <th className="p-4 font-semibold">Reviewed</th>
                    <th className="p-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((loan) => (
                    <tr key={loan.id} className="border-t border-border align-middle">
                      <td className="p-4">
                        <p className="font-medium">
                          {[loan.customer.firstName, loan.customer.lastName].filter(Boolean).join(' ') || 'Customer'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">{loan.customer.email}</p>
                      </td>
                      <td className="p-4 font-semibold text-lg">
                        {formatCurrency(loan.requestedAmount, 'USD')}
                      </td>
                      <td className="p-4 max-w-xs truncate" title={loan.loanPurpose}>
                        {loan.loanPurpose}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {loan.repaymentPeriod ? `${loan.repaymentPeriod} months` : '—'}
                      </td>
                      <td className="p-4">
                        <Badge variant={statusVariant(loan.status)} size="sm">
                          {loan.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(loan.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {loan.reviewedAt ? new Date(loan.reviewedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelected(loan)}>
                            <Eye className="h-3.5 w-3.5 mr-1.5" />
                            Details
                          </Button>
                          {loan.status === 'PENDING' && (
                            <>
                              <Button size="sm" onClick={() => openAction(loan, 'approve')}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openAction(loan, 'reject')}>
                                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-end gap-3 border-t border-border p-3">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Modal isOpen={!!selected && !actionModal} onClose={() => setSelected(null)} title="Loan Request Details">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Loan Request #{selected.id.slice(0, 8)}</h3>
              <Badge variant={statusVariant(selected.status)} size="sm">
                {selected.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Customer</p>
                <p>
                  {[selected.customer.firstName, selected.customer.lastName].filter(Boolean).join(' ') || 'Customer'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Email</p>
                <p className="truncate">{selected.customer.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Phone</p>
                <p>{selected.customer.phone || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Customer Since</p>
                <p>{new Date(selected.customer.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Requested Amount</p>
                <p className="font-bold text-lg">{formatCurrency(selected.requestedAmount, 'USD')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Repayment Period</p>
                <p>{selected.repaymentPeriod ? `${selected.repaymentPeriod} months` : 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Submitted</p>
                <p>{new Date(selected.submittedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Reviewed</p>
                <p>{selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString() : '—'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase font-semibold">Loan Purpose</p>
              <p className="whitespace-pre-wrap">{selected.loanPurpose}</p>
            </div>

            {selected.customer.wallet && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Customer Wallet</p>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-lg">{formatCurrency(selected.customer.wallet.balance, selected.customer.wallet.currency as 'USD' | 'EUR' | 'GBP' | 'JPY')}</span>
                  <Badge variant={selected.customer.wallet.isActive ? 'success' : 'default'} size="xs">
                    {selected.customer.wallet.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            )}

            {selected.decisionNote && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Decision Note</p>
                <p>{selected.decisionNote}</p>
              </div>
            )}

            {selected.reviewedByAdmin && (
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Reviewed By</p>
                <p>
                  {[selected.reviewedByAdmin.firstName, selected.reviewedByAdmin.lastName].filter(Boolean).join(' ') || selected.reviewedByAdmin.email}
                </p>
                <p className="text-xs text-muted-foreground">{selected.reviewedByAdmin.email}</p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {selected.status === 'PENDING' && (
                <>
                  <Button size="sm" onClick={() => openAction(selected, 'approve')}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => openAction(selected, 'reject')}>
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Approve / Reject modal */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => !acting && setActionModal(null)}
        title={actionModal === 'approve' ? 'Approve Loan Request' : 'Reject Loan Request'}
        description={selected ? `Amount: ${formatCurrency(selected.requestedAmount, 'USD')} · Customer: ${[selected.customer.firstName, selected.customer.lastName].filter(Boolean).join(' ') || selected.customer.email}` : undefined}
      >
        <div className="space-y-4">
          {actionModal === 'approve' && (
            <p className="text-sm text-muted-foreground">
              Approving this loan request will change its status to APPROVED. This records the administrative decision.
              Note: Approval does NOT automatically disburse funds to the customer's wallet.
            </p>
          )}
          {actionModal === 'reject' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Rejection Reason (Optional)
              </label>
              <textarea
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="e.g. Insufficient information provided, amount exceeds policy limits, etc."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
              />
              <p className="text-xs text-muted-foreground mt-1">Providing a reason helps the customer understand the decision.</p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => !acting && setActionModal(null)} disabled={acting}>
              Cancel
            </Button>
            <Button
              onClick={runAction}
              disabled={acting}
              isLoading={acting}
              variant={actionModal === 'reject' ? 'destructive' : 'primary'}
            >
              {actionModal === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminLoanRequests;