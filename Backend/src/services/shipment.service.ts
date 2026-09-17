import prisma from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { Prisma, ShipmentStatus } from '@prisma/client';

/**
 * Shipment lifecycle management.
 *
 * The authoritative current state lives on the Shipment row (`status`);
 * `events` (Json[]) is the historical timeline. Status changes append a
 * tracking event automatically so the timeline always reflects real state
 * changes, while ad-hoc events can be added separately.
 *
 * Reuses the existing Prisma models — no new tables, no migrations.
 */

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
];

/**
 * Allowed forward/backward transitions. Mirrors the business flow:
 *
 *   PENDING → PROCESSING → SHIPPED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED
 *
 * Exceptional states (FAILED / RETURNED) can be entered from any active
 * (non-terminal) state. Terminal states (DELIVERED / FAILED / RETURNED)
 * allow no further transitions — the authoritative status is corrected only
 * by explicit admin action through the same validated endpoint.
 */
const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDING: ['PROCESSING', 'SHIPPED', 'FAILED', 'RETURNED'],
  PROCESSING: ['SHIPPED', 'PENDING', 'FAILED', 'RETURNED'],
  SHIPPED: ['IN_TRANSIT', 'FAILED', 'RETURNED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'SHIPPED', 'FAILED', 'RETURNED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'IN_TRANSIT', 'FAILED', 'RETURNED'],
  DELIVERED: [],
  FAILED: [],
  RETURNED: [],
};

/** Shape of one tracking event inside Shipment.events (Json[]). */
export interface TrackingEvent {
  status: ShipmentStatus;
  location?: string;
  message: string;
  occurredAt: string;
  createdAt: string;
  createdBy?: string;
}

const DEFAULT_STATUS_MESSAGES: Record<ShipmentStatus, string> = {
  PENDING: 'Shipment is pending preparation',
  PROCESSING: 'Shipment is being processed at our warehouse',
  SHIPPED: 'Shipment has been shipped',
  IN_TRANSIT: 'Shipment is in transit',
  OUT_FOR_DELIVERY: 'Shipment is out for delivery',
  DELIVERED: 'Shipment has been delivered',
  FAILED: 'Shipment delivery failed',
  RETURNED: 'Shipment has been returned',
};

export class ShipmentService {
  /** Returns the event array sorted newest-first (by occurredAt, then createdAt). */
  private sortEvents(events: unknown): TrackingEvent[] {
    if (!Array.isArray(events)) return [];
    return (events as TrackingEvent[]).slice().sort((a, b) => {
      const aTime = new Date(a.occurredAt || a.createdAt).getTime();
      const bTime = new Date(b.occurredAt || b.createdAt).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  private shipmentSelect(adminView: boolean) {
    return {
      id: true,
      orderId: true,
      trackingNumber: true,
      carrier: true,
      status: true,
      // Shipping cost is internal data; customers never see it.
      ...(adminView ? { shippingCost: true } : {}),
      weight: true,
      dimensions: true,
      shippedAt: true,
      estimatedDelivery: true,
      deliveredAt: true,
      createdAt: true,
      updatedAt: true,
      events: true,
    } as const;
  }

  /** Load the shipment for an order or throw NotFoundError. */
  private async requireShipment(orderId: string) {
    const shipment = await prisma.shipment.findUnique({ where: { orderId } });
    if (!shipment) {
      throw new NotFoundError('No shipment exists for this order');
    }
    return shipment;
  }

  /** Verify the order exists (id is validated as UUID by routes). */
  private async requireOrder(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    return order;
  }

  /**
   * POST /admin/orders/:orderId/shipment — create the shipment for an order.
   * The schema enforces one shipment per order (orderId @unique), surfaced as
   * a clean 409 here.
   */
  async createShipment(
    orderId: string,
    adminId: string,
    data: {
      carrier: string;
      trackingNumber: string;
      shippingCost: number;
      estimatedDelivery?: Date | null;
      status?: ShipmentStatus;
    }
  ) {
    await this.requireOrder(orderId);

    const existing = await prisma.shipment.findUnique({ where: { orderId }, select: { id: true } });
    if (existing) {
      throw new ConflictError('This order already has a shipment. Update it instead.');
    }

    // Tracking numbers are globally unique (schema constraint) — check up front
    // for a friendly message.
    const trackingTaken = await prisma.shipment.findUnique({
      where: { trackingNumber: data.trackingNumber },
      select: { id: true },
    });
    if (trackingTaken) {
      throw new ConflictError('This tracking number is already used by another shipment.');
    }

    const status = data.status ?? 'PENDING';
    const now = new Date();
    const initialEvent: TrackingEvent = {
      status,
      message: DEFAULT_STATUS_MESSAGES[status],
      occurredAt: now.toISOString(),
      createdAt: now.toISOString(),
      createdBy: adminId,
    };

    return prisma.shipment.create({
      data: {
        orderId,
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        shippingCost: data.shippingCost,
        estimatedDelivery: data.estimatedDelivery ?? null,
        status,
        shippedAt: status === 'SHIPPED' ? now : null,
        deliveredAt: status === 'DELIVERED' ? now : null,
        events: [initialEvent] as unknown as Prisma.InputJsonValue[],
      },
      select: this.shipmentSelect(true),
    });
  }

  /** GET shipment for an order (admin or owner-verified customer). */
  async getShipmentByOrderId(orderId: string, adminView: boolean) {
    const shipment = await this.requireShipment(orderId);
    return { ...shipment, events: this.sortEvents(shipment.events) };
  }

  /**
   * PATCH /admin/orders/:orderId/shipment — partial update. Only provided
   * fields are touched. A `status` change goes through the same transition
   * validation and auto-event logic as the dedicated status endpoint.
   */
  async updateShipment(
    orderId: string,
    adminId: string,
    data: {
      carrier?: string;
      trackingNumber?: string;
      shippingCost?: number | null;
      estimatedDelivery?: Date | null;
      status?: ShipmentStatus;
    }
  ) {
    const shipment = await this.requireShipment(orderId);

    const updateData: Record<string, unknown> = {};

    if (data.carrier !== undefined) updateData.carrier = data.carrier;

    if (data.trackingNumber !== undefined && data.trackingNumber !== shipment.trackingNumber) {
      const taken = await prisma.shipment.findUnique({
        where: { trackingNumber: data.trackingNumber },
        select: { id: true },
      });
      if (taken && taken.id !== shipment.id) {
        throw new ConflictError('This tracking number is already used by another shipment.');
      }
      updateData.trackingNumber = data.trackingNumber;
    }

    if (data.shippingCost !== undefined) updateData.shippingCost = data.shippingCost;
    if (data.estimatedDelivery !== undefined) updateData.estimatedDelivery = data.estimatedDelivery;

    let statusEvents: TrackingEvent[] = [];
    if (data.status !== undefined && data.status !== shipment.status) {
      const { events } = this.applyStatusChange(shipment, data.status, adminId);
      updateData.status = data.status;
      updateData.shippedAt = data.status === 'SHIPPED' ? (shipment.shippedAt ?? new Date()) : shipment.shippedAt;
      updateData.deliveredAt =
        data.status === 'DELIVERED'
          ? (shipment.deliveredAt ?? new Date())
          : data.status === 'FAILED' || data.status === 'RETURNED'
            ? null
            : shipment.deliveredAt;
      statusEvents = events;
    }

    if (Object.keys(updateData).length === 0) {
      // Nothing changed — return the current state without a pointless write.
      return { ...shipment, events: this.sortEvents(shipment.events) };
    }

    if (statusEvents.length > 0) {
      updateData.events = [
        ...(shipment.events as unknown[]),
        ...statusEvents,
      ] as unknown as Prisma.InputJsonValue[];
    }

    return prisma.shipment.update({
      where: { id: shipment.id },
      data: updateData,
      select: this.shipmentSelect(true),
    }).then((updated) => ({ ...updated, events: this.sortEvents(updated.events) }));
  }

  /**
   * Validate a status transition and build the auto tracking event.
   * Transition rules are skipped only for the identical status (no-op).
   */
  private applyStatusChange(
    shipment: { status: string; events: unknown },
    nextStatus: ShipmentStatus,
    adminId: string
  ): { events: TrackingEvent[] } {
    const currentStatus = shipment.status as ShipmentStatus;
    const allowed = SHIPMENT_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(nextStatus)) {
      if (currentStatus === nextStatus) {
        throw new ValidationError(`Shipment is already in status ${currentStatus}.`);
      }
      throw new ValidationError(
        `Cannot change shipment status from ${currentStatus} to ${nextStatus}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}.`
      );
    }

    const now = new Date();
    return {
      events: [
        {
          status: nextStatus,
          message: DEFAULT_STATUS_MESSAGES[nextStatus],
          occurredAt: now.toISOString(),
          createdAt: now.toISOString(),
          createdBy: adminId,
        },
      ],
    };
  }

  /**
   * POST /admin/orders/:orderId/shipment/status — change shipment status.
   * Appends one tracking event describing the change.
   */
  async changeShipmentStatus(
    orderId: string,
    adminId: string,
    data: { status: ShipmentStatus; message?: string; location?: string }
  ) {
    const shipment = await this.requireShipment(orderId);
    const { events } = this.applyStatusChange(shipment, data.status, adminId);

    if (data.message || data.location) {
      events[0] = {
        ...events[0],
        ...(data.message ? { message: data.message } : {}),
        ...(data.location ? { location: data.location } : {}),
      };
    }

    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: data.status,
        shippedAt: data.status === 'SHIPPED' ? (shipment.shippedAt ?? new Date()) : shipment.shippedAt,
        deliveredAt:
          data.status === 'DELIVERED'
            ? (shipment.deliveredAt ?? new Date())
            : data.status === 'FAILED' || data.status === 'RETURNED'
              ? null
              : shipment.deliveredAt,
        events: [
          ...(shipment.events as unknown[]),
          ...events,
        ] as unknown as Prisma.InputJsonValue[],
      },
      select: this.shipmentSelect(true),
    });

    return { ...updated, events: this.sortEvents(updated.events) };
  }

  /**
   * POST /admin/orders/:orderId/shipment/events — add a tracking event
   * without changing the current status.
   */
  async addTrackingEvent(
    orderId: string,
    adminId: string,
    data: { message: string; status?: ShipmentStatus; location?: string; occurredAt?: Date | null }
  ) {
    const shipment = await this.requireShipment(orderId);

    const now = new Date();
    const event: TrackingEvent = {
      status: data.status ?? (shipment.status as ShipmentStatus),
      ...(data.location ? { location: data.location } : {}),
      message: data.message,
      occurredAt: (data.occurredAt ?? now).toISOString(),
      createdAt: now.toISOString(),
      createdBy: adminId,
    };

    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: { events: [...(shipment.events as unknown[]), event] as unknown as Prisma.InputJsonValue[] },
      select: this.shipmentSelect(true),
    });

    return { ...updated, events: this.sortEvents(updated.events) };
  }

  /** GET /admin/orders/:orderId/shipment/events — newest-first timeline. */
  async getTrackingEvents(orderId: string) {
    const shipment = await this.requireShipment(orderId);
    return this.sortEvents(shipment.events);
  }
}

export default new ShipmentService();
