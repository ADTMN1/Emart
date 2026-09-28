import * as React from 'react';
import { useOutletContext } from 'react-router-dom';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { SellerShopMediaUpload } from '@/components/seller/SellerShopMediaUpload';
import { useToast } from '@/components/ui/Toast';
import { sellerShopMediaApi } from '@/lib/api';
import type { SellerCenterOutlet } from '@/components/seller/SellerLayout';

export const SellerShopBanner: React.FC = () => {
  const { profile, refreshProfile } = useOutletContext<SellerCenterOutlet>();
  const { toast } = useToast();

  const currentUrl: string | null = profile?.bannerUrl ?? null;

  const handleUpload = async (file: File) => {
    await sellerShopMediaApi.uploadBanner(file);
    // Force so the just-uploaded URL is not masked by the login-phase cache.
    await refreshProfile({ force: true });
    toast({ variant: 'success', title: 'Banner updated', description: 'Your shop banner has been saved.' });
  };

  const handleRemove = async () => {
    await sellerShopMediaApi.removeBanner();
    await refreshProfile({ force: true });
    toast({ variant: 'success', title: 'Banner removed', description: 'Your shop banner has been removed.' });
  };

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Shop Banner"
        description="Add a banner image to make your storefront stand out."
      />
      <SellerShopMediaUpload
        kind="banner"
        aspectHint="Wide (3:1)"
        dimensionHint="1500×500 or larger"
        currentUrl={currentUrl}
        upload={handleUpload}
        remove={handleRemove}
      />
    </div>
  );
};

export default SellerShopBanner;