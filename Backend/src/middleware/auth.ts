import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthRequest } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { verifyToken } from '../utils/jwt';

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role gate. Accepts any number of UserRole values and admits a request only
 * when the caller's role is one of them (403 otherwise, 401 when unauthenticated).
 *
 * EMART ROLE SEPARATION
 * ---------------------
 * The three roles are disjoint — nothing is inherited:
 *   • ADMIN    → admin routes only
 *   • SELLER   → seller-only; explicitly refused by the buyer routes
 *   • CUSTOMER → the buyer purchasing flow + "Become a Seller"
 * Buyer-only routers therefore use authorize('CUSTOMER'), which denies both
 * SELLER and ADMIN. Seller Center access is NOT decided here: it keeps using
 * the SellerProfile/SellerApplication status gate (requireApprovedSeller), so
 * the application workflow stays the single source of truth for selling.
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role as UserRole)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
};
