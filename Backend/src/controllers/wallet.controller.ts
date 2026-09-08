import { Response, NextFunction } from 'express';
import walletService from '../services/wallet.service';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';

export class WalletController {
  async getWallet(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const wallet = await walletService.getWallet(req.user!.id);
      sendSuccess(res, wallet, 'Wallet retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getBalance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const balance = await walletService.getBalance(req.user!.id);
      sendSuccess(res, balance, 'Balance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async deposit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, paymentMethod, reference, paymentDetails } = req.body;
      const result = await walletService.deposit(
        req.user!.id,
        amount,
        paymentMethod,
        reference,
        paymentDetails
      );
      sendSuccess(res, result, 'Deposit successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async withdraw(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, withdrawMethod, reference } = req.body;
      const result = await walletService.withdraw(
        req.user!.id,
        amount,
        withdrawMethod,
        reference
      );
      sendSuccess(res, result, 'Withdrawal successful', 201);
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit, offset, type, status } = req.query;
      const result = await walletService.getTransactions(req.user!.id, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        type: type as string,
        status: status as string,
      });
      sendSuccess(res, result, 'Transactions retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getTransaction(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const transaction = await walletService.getTransaction(req.user!.id, id);
      sendSuccess(res, transaction, 'Transaction retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new WalletController();
