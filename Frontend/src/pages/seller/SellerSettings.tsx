import * as React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Store,
  FileCheck2,
  Bell,
  ChevronRight,
  Settings2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/States';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { sellerAgreementApi } from '@/lib/api';
import type { SellerCenterOutlet } from '@/components/seller/SellerLayout';

const statusVariant = (status: string): 'success' | 'warning' | 'destructive' =>
  status === 'APPROVED' ? 'success' : status === 'PENDING' ? 'warning' : 'destructive';

export const SellerSettings: React.FC = () => {
  const { profile } = useOutletContext<SellerCenterOutlet>();
  const [agreement, setAgreement] = React.useState<{ version: string; accepted: boolean; acceptedAt: string | null } | null>(null);
  const [agreementLoading, setAgreementLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    sellerAgreementApi
      .get()
      .then((res) => {
        if (!active) return;
        setAgreement({ version: res.version, accepted: res.accepted, acceptedAt: res.acceptedAt ?? null });
      })
      .catch(() => setAgreement(null))
      .finally(() => {
        if (active) setAgreementLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const rows: Array<{ icon: React.ReactNode; label: string; to: string; hint: string }> = [
    {
      icon: <Store className="h-4 w-4" />,
      label: 'Shop Profile',
      to: '/seller/shop',
      hint: 'Store name and description',
    },
    {
      icon: <Settings2 className="h-4 w-4" />,
      label: 'Logo & Banner',
      to: '/seller/shop/logo',
      hint: 'Branding for your storefront',
    },
    {
      icon: <Bell className="h-4 w-4" />,
      label: 'Messages & Notifications',
      to: '/seller/messages',
      hint: 'Customer conversations and in-app notifications',
    },
    {
      icon: <Settings2 className="h-4 w-4" />,
      label: 'Shop Settings',
      to: '/seller/shop/settings',
      hint: 'Store operations, business address and seller agreement',
    },
  ];

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Settings"
        description="Manage your store and account preferences."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Store status + agreement */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-destructive" />
              <h2 className="font-display text-lg font-bold text-foreground">Store Status</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Membership</span>
                <Badge variant={statusVariant(profile.status)} size="sm">
                  {profile.status.charAt(0) + profile.status.slice(1).toLowerCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span className="font-medium text-foreground">
                  {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              {profile.suspendedAt && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Suspended since {new Date(profile.suspendedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agreement */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-destructive" />
              <h2 className="font-display text-lg font-bold text-foreground">Seller Agreement</h2>
            </div>
            {agreementLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : agreement ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium text-foreground">{agreement.version}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={agreement.accepted ? 'success' : 'warning'} size="sm">
                    {agreement.accepted ? 'Accepted' : 'Not accepted'}
                  </Badge>
                </div>
                {agreement.acceptedAt && (
                  <p className="text-xs text-muted-foreground">
                    Accepted {new Date(agreement.acceptedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Agreement details are unavailable right now.</p>
            )}
          </CardContent>
        </Card>

        {/* Account links */}
        <Card>
          <CardContent className="p-0">
            <div className="p-5">
              <h2 className="font-display text-lg font-bold text-foreground">Related Settings</h2>
            </div>
            <div className="divide-y divide-border/60">
              {rows.map((row) => (
                <Link key={row.label} to={row.to} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {row.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.hint}</p>
                  </div>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SellerSettings;