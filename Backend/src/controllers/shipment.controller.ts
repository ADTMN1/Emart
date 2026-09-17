import { Response, NextFunction } from 'express';
import shipmentService from '../services/shipment.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

/**
 * ADMIN shipment-lifecycle endpoints. All routes are mounted behind
 * `authenticate` + `authorize('ADMIN')` in admin.routes.ts.
 */
export class ShipmentController {
  async createShipment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.createShipment(req.params.orderId, req.user!.id, {
        carrier: req.body.carrier,
        trackingNumber: req.body.trackingNumber,
        shippingCost: req.body.shippingCost,
        estimatedDelivery: req.body.estimatedDelivery ?? null,
        status: req.body.status,
      });
      return sendSuccess(res, { shipment }, 'Shipment created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getShipment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.getShipmentByOrderId(req.params.orderId, true);
      return sendSuccess(res, { shipment }, 'Shipment retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateShipment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.updateShipment(req.params.orderId, req.user!.id, {
        carrier: req.body.carrier,
        trackingNumber: req.body.trackingNumber,
        shippingCost: req.body.shippingCost,
        estimatedDelivery: req.body.estimatedDelivery ?? undefined,
        status: req.body.status,
      });
      return sendSuccess(res, { shipment }, 'Shipment updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async changeShipmentStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.changeShipmentStatus(req.params.orderId, req.user!.id, {
        status: req.body.status,
        message: req.body.message,
        location: req.body.location,
      });
      return sendSuccess(res, { shipment }, 'Shipment status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async addTrackingEvent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const shipment = await shipmentService.addTrackingEvent(req.params.orderId, req.user!.id, {
        message: req.body.message,
        status: req.body.status,
        location: req.body.location,
        occurredAt: req.body.occurredAt ?? null,
      });
      return sendSuccess(res, { shipment }, 'Tracking event added successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getTrackingEvents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const events = await shipmentService.getTrackingEvents(req.params.orderId);
      return sendSuccess(res, { events }, 'Tracking events retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new ShipmentController();
