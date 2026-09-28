import * as React from 'react';
import { Link } from 'react-router-dom';
import { Construction, ArrowRight, Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface SellerFeatureUnavailableProps {
  title: string;
  description: string;
  /** Which backend capability is still missing, shown as a non-salesy note. */
  scopeNote?: string;
}

/**
 * Honest placeholder for a Seller Center feature whose backend API does not
 * exist yet (e.g. seller-scoped orders, payouts, analytics). It never
 * fabricates business data — it tells the seller the feature is coming.
 */
export const SellerFeatureUnavailable: React.FC<SellerFeatureUnavailableProps> = ({
  title,
  description,
  scopeNote,
}) => (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Construction className="h-7 w-7 text-muted-foreground" />
      </div>
      <Badge variant="outline" size="sm" className="mb-3">
        Coming soon
      </Badge>
      <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">{description}</p>
      {scopeNote && (
        <p className="mt-4 max-w-md rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{scopeNote}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link to="/seller/products">
          <Button variant="outline" size="sm">
            <Store className="mr-2 h-4 w-4" />
            Manage Products
          </Button>
        </Link>
        <Link to="/seller/messages">
          <Button variant="ghost" size="sm">
            Contact Support
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </CardContent>
  </Card>
);

export default SellerFeatureUnavailable;