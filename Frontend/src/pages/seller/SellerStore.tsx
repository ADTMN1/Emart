import * as React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Store as StoreIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';

interface SellerProfileState {
  id: string;
  storeName: string;
  storeDescription: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SellerOutlet {
  profile: SellerProfileState;
  refreshProfile: () => Promise<void>;
}

/**
 * Shop Profile page (/seller/shop, alias /seller/store) — real profile view
 * backed by PUT /seller/profile. Identity (name + status) lives in the Seller
 * Center sidebar, so this page stays focused on editing. Suspended sellers see
 * the same form but the API rejects writes server-side (403) — surfaced here.
 */
export default function SellerStore() {
  const { profile, refreshProfile } = useOutletContext<SellerOutlet>();
  const { toast } = useToast();

  const [storeName, setStoreName] = React.useState(profile.storeName);
  const [storeDescription, setStoreDescription] = React.useState(profile.storeDescription);
  const [saving, setSaving] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setStoreName(profile.storeName);
    setStoreDescription(profile.storeDescription);
  }, [profile.storeName, profile.storeDescription]);

  const dirty = storeName !== profile.storeName || storeDescription !== profile.storeDescription;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setLoadError(null);
      await api.put('/seller/profile', {
        storeName: storeName.trim(),
        storeDescription: storeDescription.trim(),
      });
      await refreshProfile();
      toast({ variant: 'success', title: 'Store updated', description: 'Your store profile has been saved.' });
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to save store profile.');
      toast({
        variant: 'error',
        title: 'Save failed',
        description: err?.message || 'Your store profile could not be updated.',
      });
    } finally {
      setSaving(false);
    }
  };

  const active = profile.status === 'APPROVED';
  const suspended = profile.status === 'SUSPENDED';
  const statusBadge = (
    <Badge variant={active ? 'success' : suspended ? 'destructive' : 'warning'}>
      {active ? 'Active' : suspended ? 'Suspended' : 'Pending'}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Shop Profile"
        description="The store identity customers see on your products and store page."
        action={statusBadge}
      />

      <Card>
        <CardContent className="p-5 lg:p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="storeName">
                Store name
              </label>
              <Input
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                maxLength={80}
                className="mt-1.5"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">3–80 characters. Trimmed automatically.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="storeDescription">
                Store description
              </label>
              <textarea
                id="storeDescription"
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                maxLength={2000}
                rows={5}
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30 focus:border-destructive/50"
                placeholder="Tell customers what your store sells..."
              />
              <p className="mt-1 text-xs text-muted-foreground">10–2000 characters.</p>
            </div>

            {loadError && <p className="text-sm text-destructive">{loadError}</p>}

            <div className="flex gap-3 border-t border-border/60 pt-4">
              <Button type="submit" disabled={saving || !dirty}>
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving || !dirty}
                onClick={() => {
                  setStoreName(profile.storeName);
                  setStoreDescription(profile.storeDescription);
                  setLoadError(null);
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <StoreIcon className="h-3.5 w-3.5" />
        Upload your logo and banner from the Shop menu — Shop → Logo / Shop → Banner.
      </p>
    </div>
  );
}