import * as React from 'react';
import { SellerPageHeader } from '@/components/seller/SellerPageHeader';
import { SellerFeatureUnavailable } from '@/components/seller/SellerFeatureUnavailable';

export const SellerReviews: React.FC = () => (
  <div className="space-y-6">
    <SellerPageHeader
      title="Reviews"
      description="Feedback and ratings customers have left for your store."
    />
    <SellerFeatureUnavailable
      title="Reviews aren't available yet"
      description="Customer reviews for seller stores haven't been enabled yet. When they arrive, you'll be able to read, reply to and resolve feedback here."
      scopeNote="The backend does not expose a seller-facing reviews API yet, so no review data can be displayed."
    />
  </div>
);

export default SellerReviews;