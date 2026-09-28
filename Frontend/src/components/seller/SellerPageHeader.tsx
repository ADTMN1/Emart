import * as React from 'react';
import { cn } from '@/lib/utils';

interface SellerPageHeaderProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Consistent page heading for every Seller Center page. */
export const SellerPageHeader: React.FC<SellerPageHeaderProps> = ({ title, description, action, className }) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-extrabold text-foreground">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default SellerPageHeader;