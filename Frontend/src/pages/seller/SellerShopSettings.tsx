import * as React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Store, FileCheck2, Globe, MapPin, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import type { SellerCenterOutlet } from '@/components/seller/SellerLayout';

export const SellerShopSettings: React.FC = () => {
  const { profile, sellerApp } = useOutletContext<SellerCenterOutlet>();

  const sections = [
    {
      title: 'Shop Profile',
      description: 'Your store name and description are shown to customers across the marketplace.',
      detail: `${profile.storeName || 'Your Store'}${profile.storeDescription ? ` — ${profile.storeDescription}` : ''}`,
      to: '/seller/shop',
      icon: <Store className="h-4 w-4" />,
    },
    {
      title: 'Seller Agreement',
      description: 'The agreement governing your seller account and obligations as a merchant.',
      detail: 'Review current terms and acceptance status under Settings.',
      to: '/seller/settings',
      icon: <FileCheck2 className="h-4 w-4" />,
    },
    {
      title: 'Store Locations & Shipping',
      description: 'Configure where you ship from and how orders are fulfilled.',
      detail: 'Preference changes will be enabled with the order-request workflow.',
      to: '/seller/orders/requests',
      icon: <Globe className="h-4 w-4" />,
    },
    {
      title: 'Business Address',
      description: 'Your registered business address used for return and tax purposes.',
      detail: sellerApp?.id ? 'On file with your seller application.' : 'Update via your application record.',
      to: '/seller/settings',
      icon: <MapPin className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      <SellerPageHeader
        title="Shop Settings"
        description="Configure how your shop is represented and how it operates."
      />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border/60">
            {sections.map((s) => (
              <Link key={s.title} to={s.to} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <span className="text-destructive">{s.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
                </div>
                <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">{s.description}</div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SellerShopSettings;