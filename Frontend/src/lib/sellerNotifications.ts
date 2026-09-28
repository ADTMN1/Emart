import { MessageSquare, ShoppingBag, PackageCheck, Bell } from 'lucide-react';
import type { NotificationItem } from '@/lib/api';

/**
 * Shared seller notification metadata.
 *
 * The navbar bell dropdown and the full `/seller/notifications` page must
 * resolve a notification to the same destination and the same icon. Keeping
 * that logic here is what guarantees the dropdown stops disagreeing with the
 * page.
 */

export const SELLER_ALL_NOTIFICATIONS_PATH = '/seller/notifications';

/**
 * Where a seller notification navigates to.
 *
 * Sellers only ever receive `MESSAGE` and `ORDER_REQUEST`, so:
 *   * MESSAGE        → the seller inbox thread for that conversation
 *   * ORDER_REQUEST  → the order itself, in the Seller Center
 *   * anything else  → the seller overview (no valid deeper target exists)
 *
 * `ORDER_REQUEST` previously fell through to `/seller`, which both buried the
 * request and left the seller without context. The order id is the correct
 * deep link and already has a working seller route (`/seller/orders/:id`).
 */
export const sellerNotificationTargetPath = (n: NotificationItem): string => {
  if (n.conversationId) return `/seller/messages/${n.conversationId}`;
  if (n.type === 'ORDER_REQUEST' && n.orderId) return `/seller/orders/${n.orderId}`;
  return '/seller';
};

/**
 * Can this notification be marked read when the seller opens it?
 *
 * `ORDER_REQUEST` is exempt on purpose. The row is the request record, and
 * marking it read used to make the pending request vanish from the seller's
 * queue. Read state and request state are now independent fields, but skipping
 * the read for order requests keeps the bell from implying the request was
 * "handled" by merely being clicked, and leaves the decision to the explicit
 * accept/decline actions.
 */
export const marksReadOnOpen = (n: NotificationItem): boolean => n.type !== 'ORDER_REQUEST';

export const sellerNotificationIcon = (n: NotificationItem) => {
  if (n.type === 'MESSAGE') return MessageSquare;
  if (n.type === 'ORDER_REQUEST') return ShoppingBag;
  if (n.shipmentId) return PackageCheck;
  return Bell;
};

/** Tailwind classes for the icon chip, keyed off the icon we picked. */
export const sellerNotificationIconClass = (n: NotificationItem): string => {
  if (n.type === 'MESSAGE') return 'bg-destructive/10 text-destructive';
  return 'bg-primary/10 text-primary';
};

/** Human label for a notification type, for the notifications page. */
export const sellerNotificationTypeLabel = (type: string): string => {
  if (type === 'ORDER_REQUEST') return 'Order request';
  if (type === 'MESSAGE') return 'Message';
  return 'Notification';
};
