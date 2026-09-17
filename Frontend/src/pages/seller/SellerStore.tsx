import * as React from 'react';
import { useOutletContext } from 'react-router-dom';
import { Store as StoreIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
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
 * Seller Store page (/seller/store) — real profile view + edit backed by
 * PUT /seller/profile. Suspended sellers see the same form but the API
 * rejects writes server-side (403) — the error is surfaced honestly.
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Store Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          This is the store identity customers see on your products and store page.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <StoreIcon className="h-6 w-6 text-destructive" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-foreground truncate">{profile.storeName}</p>
                <Badge variant={active ? 'success' : suspended ? 'destructive' : 'warning'}>
                  {active ? 'Active' : suspended ? 'Suspended' : 'Pending'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seller since {new Date(profile.createdAt).toLocaleDateString()}
                {suspended && profile.suspendedAt
                  ? ` · Suspended ${new Date(profile.suspendedAt).toLocaleDateString()}`
                  : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
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
              <p className="text-xs text-muted-foreground mt-1">3–80 characters. Trimmed automatically.</p>
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
              <p className="text-xs text-muted-foreground mt-1">10–2000 characters.</p>
            </div>

            {loadError && <p className="text-sm text-destructive">{loadError}</p>}

            <div className="flex gap-3">
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
    </div>
  );
}
