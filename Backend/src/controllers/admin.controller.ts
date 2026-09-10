import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';

class AdminController {
  async getStats(_req: Request, res: Response, next: NextFunction) {
    try {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const [
        totalProducts,
        activeProducts,
        totalOrders,
        pendingOrders,
        totalRevenue,
        lastMonthRevenue,
      ] = await prisma.$transaction([
        prisma.product.count(),
        prisma.product.count({ where: { isAvailable: true } }),
        prisma.order.count(),
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: {
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
          },
        }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: {
            status: { notIn: ['CANCELLED', 'REFUNDED'] },
            createdAt: { gte: lastMonth },
          },
        }),
      ]);

      const revenue = totalRevenue?._sum.total ?? 0;
      const lastRevenue = lastMonthRevenue?._sum.total ?? 0;
      const revenueChange = lastRevenue > 0 ? ((revenue - lastRevenue) / lastRevenue) * 100 : 0;

      res.json({
        success: true,
        data: {
          totalProducts,
          activeProducts,
          totalOrders,
          pendingOrders,
          totalRevenue: revenue,
          revenueChange,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          suspended: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100, // Limit admin user list
      });

      res.json({
        success: true,
        data: { users },
      });
    } catch (error) {
      next(error);
    }
  }

  async getWarehousePackages(_req: Request, res: Response, next: NextFunction) {
    try {
      const packages = await prisma.warehousePackage.findMany({
        select: {
          id: true,
          packageNumber: true,
          status: true,
          weight: true,
          dimensions: true,
          storageLocation: true,
          receivedAt: true,
          expiresAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100, // Limit results
      });

      res.json({
        success: true,
        data: { packages },
      });
    } catch (error) {
      next(error);
    }
  }

  async getShipments(_req: Request, res: Response, next: NextFunction) {
    try {
      const shipments = await prisma.shipment.findMany({
        select: {
          id: true,
          trackingNumber: true,
          carrier: true,
          status: true,
          weight: true,
          dimensions: true,
          shippingCost: true,
          shippedAt: true,
          estimatedDelivery: true,
          deliveredAt: true,
          createdAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100, // Limit results
      });

      res.json({
        success: true,
        data: { shipments },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { suspended, ...updateData } = req.body;

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...(suspended !== undefined && { suspended }),
          ...updateData,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          suspended: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Don't allow deleting admin users
      const user = await prisma.user.findUnique({ 
        where: { id },
        select: { role: true },
      });
      
      if (user?.role === 'ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Cannot delete admin users',
        });
      }

      await prisma.user.delete({ where: { id } });

      res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminController();
