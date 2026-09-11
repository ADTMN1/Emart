import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

interface CryptoWalletRow {
  id: string;
  currency: string;
  network: string;
  address: string;
  qrCodeUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class AdminController {
  private async findCryptoWallets() {
    // Use parameterized raw queries until the local generated Prisma client is refreshed.
    // The database model remains defined in prisma/schema.prisma.
    return prisma.$queryRaw<CryptoWalletRow[]>`
      SELECT * FROM "crypto_wallets"
      ORDER BY "currency" ASC, "network" ASC
    `;
  }

  private walletInput(body: Record<string, unknown>) {
    const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
    const network = typeof body.network === 'string' ? body.network.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const qrCodeUrl = typeof body.qrCodeUrl === 'string' ? body.qrCodeUrl.trim() : '';
    if (!currency || !network || !address) {
      throw new ValidationError('Currency, network, and receiving address are required.');
    }
    if (qrCodeUrl) {
      try {
        new URL(qrCodeUrl);
      } catch {
        throw new ValidationError('QR code URL must be a valid URL.');
      }
    }
    return { currency, network, address, qrCodeUrl: qrCodeUrl || null, isActive: body.isActive !== false };
  }

  async getCryptoWallets(_req: Request, res: Response, next: NextFunction) {
    try {
      const wallets = await this.findCryptoWallets();
      res.json({ success: true, data: wallets });
    } catch (error) {
      next(error);
    }
  }

  async createCryptoWallet(req: Request, res: Response, next: NextFunction) {
    try {
      const data = this.walletInput(req.body);
      const existing = await prisma.$queryRaw<CryptoWalletRow[]>`
        SELECT * FROM "crypto_wallets"
        WHERE "address" = ${data.address} OR ("currency" = ${data.currency} AND "network" = ${data.network})
        LIMIT 1
      `;
      if (existing.length > 0) throw new ConflictError('Each network must have a unique receiving address and currency/network combination.');
      const [wallet] = await prisma.$queryRaw<CryptoWalletRow[]>`
        INSERT INTO "crypto_wallets" ("id", "currency", "network", "address", "qrCodeUrl", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, ${data.currency}, ${data.network}, ${data.address}, ${data.qrCodeUrl}, ${data.isActive}, NOW(), NOW())
        RETURNING *
      `;
      res.status(201).json({ success: true, data: wallet });
    } catch (error) {
      next(error);
    }
  }

  async updateCryptoWallet(req: Request, res: Response, next: NextFunction) {
    try {
      const data = this.walletInput(req.body);
      const existing = await prisma.$queryRaw<CryptoWalletRow[]>`
        SELECT * FROM "crypto_wallets"
        WHERE "id" <> ${req.params.id}
          AND ("address" = ${data.address} OR ("currency" = ${data.currency} AND "network" = ${data.network}))
        LIMIT 1
      `;
      if (existing.length > 0) throw new ConflictError('Each network must have a unique receiving address and currency/network combination.');
      const [wallet] = await prisma.$queryRaw<CryptoWalletRow[]>`
        UPDATE "crypto_wallets"
        SET "currency" = ${data.currency}, "network" = ${data.network}, "address" = ${data.address},
            "qrCodeUrl" = ${data.qrCodeUrl}, "isActive" = ${data.isActive}, "updatedAt" = NOW()
        WHERE "id" = ${req.params.id}
        RETURNING *
      `;
      if (!wallet) throw new NotFoundError('Crypto wallet not found.');
      res.json({ success: true, data: wallet });
    } catch (error) {
      next(error);
    }
  }

  async deleteCryptoWallet(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM "crypto_wallets" WHERE "id" = ${req.params.id}
      `;
      if (result === 0) throw new NotFoundError('Crypto wallet not found.');
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

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
