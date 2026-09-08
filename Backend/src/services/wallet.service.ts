import prisma from '../config/database';
import { NotFoundError, BadRequestError } from '../utils/errors';

export class WalletService {
  /**
   * Get or create wallet for user
   */
  async getWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: 0,
          currency: 'USD',
        },
      });
    }

    return wallet;
  }

  /**
   * Get wallet balance
   */
  async getBalance(userId: string) {
    const wallet = await this.getWallet(userId);
    return {
      balance: wallet.balance,
      currency: wallet.currency,
      isActive: wallet.isActive,
    };
  }

  /**
   * Add funds to wallet (deposit)
   */
  async deposit(
    userId: string,
    amount: number,
    paymentMethod: string,
    reference?: string,
    paymentDetails?: any
  ) {
    if (amount <= 0) {
      throw new BadRequestError('Deposit amount must be greater than zero');
    }

    const wallet = await this.getWallet(userId);

    if (!wallet.isActive) {
      throw new BadRequestError('Wallet is not active');
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    // Create transaction and update wallet balance in a transaction
    const [transaction, updatedWallet] = await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'DEPOSIT',
          amount,
          balanceBefore,
          balanceAfter,
          status: 'COMPLETED',
          description: `Deposit via ${paymentMethod}`,
          reference,
          paymentMethod,
          paymentDetails,
          processedAt: new Date(),
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
    ]);

    return {
      transaction,
      wallet: updatedWallet,
    };
  }

  /**
   * Withdraw funds from wallet
   */
  async withdraw(
    userId: string,
    amount: number,
    withdrawMethod: string,
    reference?: string
  ) {
    if (amount <= 0) {
      throw new BadRequestError('Withdrawal amount must be greater than zero');
    }

    const wallet = await this.getWallet(userId);

    if (!wallet.isActive) {
      throw new BadRequestError('Wallet is not active');
    }

    if (wallet.balance < amount) {
      throw new BadRequestError(
        `Insufficient balance. Available: $${wallet.balance.toFixed(2)}`
      );
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    // Create transaction and update wallet balance
    const [transaction, updatedWallet] = await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount,
          balanceBefore,
          balanceAfter,
          status: 'COMPLETED',
          description: `Withdrawal via ${withdrawMethod}`,
          reference,
          paymentMethod: withdrawMethod,
          processedAt: new Date(),
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
    ]);

    return {
      transaction,
      wallet: updatedWallet,
    };
  }

  /**
   * Process payment from wallet for an order
   */
  async processPayment(userId: string, amount: number, orderNumber: string) {
    if (amount <= 0) {
      throw new BadRequestError('Payment amount must be greater than zero');
    }

    const wallet = await this.getWallet(userId);

    if (!wallet.isActive) {
      throw new BadRequestError('Wallet is not active');
    }

    if (wallet.balance < amount) {
      throw new BadRequestError(
        `Insufficient balance. Available: $${wallet.balance.toFixed(2)}, Required: $${amount.toFixed(2)}`
      );
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    // Create transaction and update wallet balance
    const [transaction, updatedWallet] = await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'PAYMENT',
          amount,
          balanceBefore,
          balanceAfter,
          status: 'COMPLETED',
          description: `Payment for order ${orderNumber}`,
          reference: orderNumber,
          paymentMethod: 'Wallet',
          processedAt: new Date(),
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
    ]);

    return {
      transaction,
      wallet: updatedWallet,
    };
  }

  /**
   * Process refund to wallet
   */
  async processRefund(userId: string, amount: number, orderNumber: string, reason: string) {
    if (amount <= 0) {
      throw new BadRequestError('Refund amount must be greater than zero');
    }

    const wallet = await this.getWallet(userId);

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    // Create transaction and update wallet balance
    const [transaction, updatedWallet] = await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'REFUND',
          amount,
          balanceBefore,
          balanceAfter,
          status: 'COMPLETED',
          description: `Refund for order ${orderNumber}`,
          reference: orderNumber,
          notes: reason,
          processedAt: new Date(),
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
    ]);

    return {
      transaction,
      wallet: updatedWallet,
    };
  }

  /**
   * Get wallet transaction history
   */
  async getTransactions(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: string;
      status?: string;
    } = {}
  ) {
    const { limit = 20, offset = 0, type, status } = options;

    const where: any = { userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  /**
   * Get single transaction
   */
  async getTransaction(userId: string, transactionId: string) {
    const transaction = await prisma.walletTransaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }

  /**
   * Add bonus to wallet (promotional/referral bonus)
   */
  async addBonus(userId: string, amount: number, description: string, reference?: string) {
    if (amount <= 0) {
      throw new BadRequestError('Bonus amount must be greater than zero');
    }

    const wallet = await this.getWallet(userId);

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    const [transaction, updatedWallet] = await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: 'BONUS',
          amount,
          balanceBefore,
          balanceAfter,
          status: 'COMPLETED',
          description,
          reference,
          processedAt: new Date(),
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      }),
    ]);

    return {
      transaction,
      wallet: updatedWallet,
    };
  }
}

export default new WalletService();
