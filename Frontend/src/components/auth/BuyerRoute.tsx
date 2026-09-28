import * as React from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/Card';
import { isSellerRole, SELLER_CANNOT_PURCHASE } from '@/types/role';

/**
 * EMART ROLE SEPARATION — buyer-only route guards.
 *
 * An approved SELLER is a seller-only account, so the buyer purchasing
 * surfaces (cart, checkout, buyer orders, shipping, wallet) are unreachable
 * for it — including by manually typing the URL, which these guards turn into
 * a clear message plus a way back to the Seller Center.
 *
 * Deliberately NOT gated here, so role separation cannot break anything:
 *   • public browsing (/, /marketplace, /product/:id, /categories) — a seller
 *     may still look at the catalogue; those pages are browsing-only for it.
 *   • /login, /register, /auth/callback.
 *   • the /account shell, which is how a seller reaches Seller Center.
 *   • /favorites.
 *
 * Unauthenticated and CUSTOMER visitors pass through completely untouched, so
 * the pages keep their existing behaviour (an anonymous visitor is still sent
 * to /login by the pages' own 401 handling, exactly as before). ADMIN is
 * admin-only, so it is sent to /admin rather than left on a buyer page that
 * the backend would refuse anyway.
 */

/** Shown in place of a buyer page when a SELLER reaches it directly. */
const SellerPurchaseBlocked: React.FC = () => (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Store className="h-7 w-7 text-primary" />
      </div>
      <h1 className="font-display text-lg font-bold text-foreground">{SELLER_CANNOT_PURCHASE}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        Your account is a seller account, so buying is disabled. Your store, seller orders, sales and payouts are all
        in the Seller Center.
      </p>
      <Link
        to="/seller"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-600"
      >
        <Store className="h-4 w-4" />
        Go to Seller Center
      </Link>
    </CardContent>
  </Card>
);

/**
 * Decides what a non-buyer sees. `null` means "render the buyer page".
 * `undefined` while auth is still hydrating, so a refresh on /cart never
 * bounces a CUSTOMER out of their cart.
 */
const useBuyerAccessVerdict = (): 'blocked' | 'admin' | 'allow' | undefined => {
  const { user, isLoading } = useAuth();

  if (isLoading) return undefined;
  if (!user) return 'allow';
  if (isSellerRole(user.role)) return 'blocked';
  if (user.role === 'ADMIN') return 'admin';
  return 'allow';
};

/** Wraps a buyer page rendered as `children` (cart, checkout, wallet). */
export const BuyerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const verdict = useBuyerAccessVerdict();

  if (verdict === 'blocked') return <SellerPurchaseBlocked />;
  if (verdict === 'admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
};

/**
 * Outlet form, for buyer routes nested under a shared layout — the buyer
 * /orders and /shipping shells live inside AccountLayout, so the guard has to
 * render the nested <Outlet /> instead of children.
 */
export const BuyerOutlet: React.FC = () => {
  const verdict = useBuyerAccessVerdict();

  if (verdict === 'blocked') return <SellerPurchaseBlocked />;
  if (verdict === 'admin') return <Navigate to="/admin" replace />;
  return <Outlet />;
};

export default BuyerRoute;
