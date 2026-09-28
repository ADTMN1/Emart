import * as React from 'react';
import { useOutletContext } from 'react-router-dom';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { SellerShopMediaUpload } from '@/components/seller/SellerShopMediaUpload';
import { useToast } from '@/components/ui/Toast';
import { sellerShopMediaApi } from '@/lib/api';
import type { SellerCenterOutlet } from '@/components/seller/SellerLayout';

export const SellerShopLogo: React.FC = () => {
  const { profile, refreshProfile } = useOutletContext<SellerCenterOutlet>();
  const { toast } = useToast();

  const currentUrl: string | null = profile?.logoUrl ?? null;

  const handleUpload = async (file: File) => {
    await sellerShopMediaApi.uploadLogo(file);
    // Force so the just-uploaded URL is not masked by the login-phase cache.
    await refreshProfile({ force: true });
    toast({ variant: 'success', title: 'Logo updated', description: 'Your shop logo has been saved.' });
  };

  const handleRemove = async () => {
    await sellerShopMediaApi.removeLogo();
    await refreshProfile({ force: true });
    toast({ variant: 'success', title: 'Logo removed', description: 'Your shop logo has been removed.' });
  };

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Shop Logo"
        description="Upload a logo to brand your storefront. It appears on your store and customer-facing pages."
      />
      <SellerShopMediaUpload
        kind="logo"
        aspectHint="Square (1:1)"
        dimensionHint="512×512 or larger"
        currentUrl={currentUrl}
        upload={handleUpload}
        remove={handleRemove}
      />
    </div>
  );
};

export default SellerShopLogo;