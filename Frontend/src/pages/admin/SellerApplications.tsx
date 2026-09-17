import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Ban,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Admin Seller Applications (Phase 5).
 *
 * All data comes from the ADMIN seller endpoints. Server-side pagination and
 * status filters; approve/reject/suspend/activate call the admin actions and
 * refresh from the server afterwards.
 */

interface SellerApplication {
  id: string;
  storeName: string;
  storeDescription: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    sellerProfile?: { id: string; status: string } | null;
  };
}

interface ApplicationList {
  applications: SellerApplication[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const statusVariant = (status: string): 'warning' | 'success' | 'destructive' | 'default' => {
  const map: Record<string, any> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'destructive',
    SUSPENDED: 'default',
  };
  return map[status] || 'default';
};

export const AdminSellerApplications: React.FC = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<ApplicationList | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<SellerApplication | null>(null);
  const [actionModal, setActionModal] = React.useState<'approve' | 'reject' | 'suspend' | 'activate' | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');
  const [acting, setActing] = React.useState(false);

  const fetchApplications = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await api.get<ApplicationList>(`/admin/sellers/applications?${params.toString()}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load seller applications.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  React.useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const openAction = (app: SellerApplication, action: 'approve' | 'reject' | 'suspend' | 'activate') => {
    setSelected(app);
    setRejectReason('');
    setActionModal(action);
  };

  const runAction = async () => {
    if (!selected || !actionModal) return;
    try {
      setActing(true);
      if (actionModal === 'approve') {
        await api.post(`/admin/sellers/applications/${selected.id}/approve`, {});
      } else if (actionModal === 'reject') {
        await api.post(`/admin/sellers/applications/${selected.id}/reject`, { reason: rejectReason.trim() });
      } else if (actionModal === 'suspend') {
        const sellerId = selected.user.sellerProfile?.id;
        if (!sellerId) throw new Error('This application has no linked seller profile.');
        await api.post(`/admin/sellers/${sellerId}/suspend`, {});
      } else if (actionModal === 'activate') {
        const sellerId = selected.user.sellerProfile?.id;
        if (!sellerId) throw new Error('This application has no linked seller profile.');
        await api.post(`/admin/sellers/${sellerId}/activate`, {});
      }
      toast({ variant: 'success', title: 'Seller application updated' });
      setActionModal(null);
      await fetchApplications();
    } catch (err: any) {
      toast({ variant: 'error', title: 'Action failed', description: err.message || 'Please try again.' });
    } finally {
      setActing(false);
    }
  };

  const rows = data?.applications ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Store className="h-7 w-7" />
            Seller Applications
          </h1>
          <p className="text-muted-foreground mt-1">Review seller applications and manage seller status.</p>
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
          <Button variant="outline" size="md" onClick={fetchApplications} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
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
            <p className="p-6 text-sm text-muted-foreground">Loading applications…</p>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <Store className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 font-semibold">No applications found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Seller applications will appear here when customers apply.
              </p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-4 font-semibold">Store</th>
                    <th className="p-4 font-semibold">Applicant</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold">Submitted</th>
                    <th className="p-4 font-semibold">Reviewed</th>
                    <th className="p-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((app) => (
                    <tr key={app.id} className="border-t border-border align-middle">
                      <td className="p-4 font-medium">{app.storeName}</td>
                      <td className="p-4">
                        <p>{[app.user.firstName, app.user.lastName].filter(Boolean).join(' ') || 'Customer'}</p>
                        <p className="text-xs text-muted-foreground">{app.user.email}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant={statusVariant(app.status)} size="sm">
                          {app.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelected(app)}>
                            Details
                          </Button>
                          {app.status === 'PENDING' && (
                            <>
                              <Button size="sm" onClick={() => openAction(app, 'approve')}>
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => openAction(app, 'reject')}>
                                Reject
                              </Button>
                            </>
                          )}
                          {app.status === 'APPROVED' && app.user.sellerProfile && (
                            <Button size="sm" variant="destructive" onClick={() => openAction(app, 'suspend')}>
                              Suspend
                            </Button>
                          )}
                          {app.status === 'SUSPENDED' && app.user.sellerProfile && (
                            <Button size="sm" onClick={() => openAction(app, 'activate')}>
                              Activate
                            </Button>
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
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-end gap-3 border-t border-border p-3">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pagination.pages}
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
      <Modal isOpen={!!selected && !actionModal} onClose={() => setSelected(null)} title="Application Details">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">{selected.storeName}</h3>
              <Badge variant={statusVariant(selected.status)} size="sm">
                {selected.status}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Applicant</p>
                <p>
                  {[selected.user.firstName, selected.user.lastName].filter(Boolean).join(' ') || 'Customer'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Email</p>
                <p className="truncate">{selected.user.email}</p>
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
              <p className="text-xs text-muted-foreground uppercase font-semibold">Store Description</p>
              <p className="whitespace-pre-wrap">{selected.storeDescription}</p>
            </div>
            {selected.rejectionReason && (
              <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-xs text-destructive uppercase font-semibold mb-1">Rejection Reason</p>
                <p>{selected.rejectionReason}</p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {selected.status === 'PENDING' && (
                <>
                  <Button size="sm" onClick={() => openAction(selected, 'approve')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => openAction(selected, 'reject')}>
                    Reject
                  </Button>
                </>
              )}
              {selected.status === 'APPROVED' && selected.user.sellerProfile && (
                <Button size="sm" variant="destructive" onClick={() => openAction(selected, 'suspend')}>
                  Suspend Seller
                </Button>
              )}
              {selected.status === 'SUSPENDED' && selected.user.sellerProfile && (
                <Button size="sm" onClick={() => openAction(selected, 'activate')}>
                  Activate Seller
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Approve / Reject / Suspend / Activate modal */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => !acting && setActionModal(null)}
        title={
          actionModal === 'approve'
            ? 'Approve Application'
            : actionModal === 'reject'
            ? 'Reject Application'
            : actionModal === 'suspend'
            ? 'Suspend Seller'
            : 'Activate Seller'
        }
        description={selected ? `Store: ${selected.storeName}` : undefined}
      >
        <div className="space-y-4">
          {actionModal === 'approve' && (
            <p className="text-sm text-muted-foreground">
              Approves this application and creates the seller profile for this customer. This cannot be
              undone without suspending the seller.
            </p>
          )}
          {actionModal === 'reject' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Rejection Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                placeholder="e.g. Store description lacks required detail."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </div>
          )}
          {actionModal === 'suspend' && (
            <p className="text-sm text-muted-foreground">
              Suspends this seller. The profile and application are preserved and the seller can be
              reactivated later.
            </p>
          )}
          {actionModal === 'activate' && (
            <p className="text-sm text-muted-foreground">
              Reactivates this suspended seller. They will regain seller capabilities once those are
              introduced.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => !acting && setActionModal(null)} disabled={acting}>
              Cancel
            </Button>
            <Button
              onClick={runAction}
              disabled={acting || (actionModal === 'reject' && rejectReason.trim().length < 3)}
              isLoading={acting}
              variant={actionModal === 'reject' || actionModal === 'suspend' ? 'destructive' : 'primary'}
            >
              {actionModal === 'approve'
                ? 'Approve'
                : actionModal === 'reject'
                ? 'Reject'
                : actionModal === 'suspend'
                ? 'Suspend'
                : 'Activate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminSellerApplications;
