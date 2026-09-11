import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response';
import prisma from '../config/database';

interface CryptoWalletRow {
  id: string;
  currency: string;
  network: string;
  address: string;
  qrCodeUrl: string | null;
}

export class PaymentController {
  async getCryptoConfig(req: Request, res: Response, next: NextFunction) {
    try {
      // This stays parameterized and works while the deployed Prisma client is being regenerated.
      const wallets = await prisma.$queryRaw<CryptoWalletRow[]>`
        SELECT "id", "currency", "network", "address", "qrCodeUrl"
        FROM "crypto_wallets"
        WHERE "isActive" = true
        ORDER BY "currency" ASC, "network" ASC
      `;
      const requestedWalletId = String(req.query.walletId || wallets[0]?.id || '');
      const selected = wallets.find(({ id }) => id === requestedWalletId);
      if (!selected) {
        return res.status(404).json({ success: false, message: 'The requested crypto payment network is not configured.' });
      }
      return sendSuccess(res, {
        walletId: selected.id,
        network: selected.network,
        currency: selected.currency,
        address: selected.address,
        qrCodeUrl: selected.qrCodeUrl,
        networks: wallets.map(({ id, currency, network }) => ({ id, currency, network })),
      }, 'Crypto payment configuration loaded');
    } catch (error) {
      next(error);
    }
  }
}

export default new PaymentController();
