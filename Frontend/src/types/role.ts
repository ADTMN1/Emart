/**
 * EMART role separation — the single shared definition of an account role.
 *
 * The three roles are DISJOINT; nothing is inherited between them:
 *
 *   CUSTOMER  browse, cart, checkout, buyer orders, wallet, favorites,
 *             account, and "Become a Seller". Stays a full buyer while a
 *             seller application is PENDING or REJECTED.
 *   SELLER    seller-only. Seller Center, products, inventory, seller orders,
 *             seller messages, shop settings, sales/payments. Explicitly
 *             refused by the buyer purchasing flow (cart, checkout, buyer
 *             orders, shipping, wallet money movement).
 *   ADMIN     admin dashboard only. Never a buyer.
 *
 * Assigned server-side: a user becomes SELLER only when an admin approves
 * their seller application (and returns to CUSTOMER if the store is
 * suspended). SellerApplication.status / SellerProfile.status remain the
 * authority for *seller* access; the role is what separates the accounts.
 *
 * NOT to be confused with the message-participant unions
 * ('admin' | 'seller' / 'admin' | 'customer'), which describe who is in a
 * conversation thread and are deliberately left alone.
 */
export type UserRole = 'CUSTOMER' | 'SELLER' | 'ADMIN';

/**
 * Shown whenever a seller-only account touches a buyer purchasing surface
 * (route, button, or an API call rejected with 403). One message, one place,
 * so the buyer UI never degrades into a generic "something went wrong".
 */
export const SELLER_CANNOT_PURCHASE = 'Seller accounts cannot purchase products.';

/** True for the seller-only role. A role check is all the buyer guards need. */
export const isSellerRole = (role: string | undefined | null): boolean => role === 'SELLER';
