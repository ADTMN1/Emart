import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const code = (err as any).code;

    if (code === 'P2023' || code === 'P2025') {
      return sendError(res, 'Requested resource not found or invalid ID format', 404);
    }

    if (code === 'P1001' || code === 'P1010' || code === 'P1002') {
      return sendError(res, 'Database connection failed. Check your DATABASE_URL and Supabase project status.', 503);
    }

    console.error('Prisma Known Error:', code, err.message);
    return sendError(res, 'Database error occurred', 400);
  }

  if (err.name === 'PrismaClientInitializationError') {
    console.error('Prisma Initialization Error:', err.message);
    return sendError(
      res,
      'Database connection failed. Check your DATABASE_URL and Supabase status.',
      503
    );
  }

  if (err.name === 'PrismaClientValidationError') {
    console.error('Prisma Validation Error:', err.message);
    const isDev = process.env.NODE_ENV !== 'production';
    let fieldName = 'unknown';
    let details = '';
    
    const argMatch = err.message.match(/Argument `(\w+)`/);
    if (argMatch) {
      fieldName = argMatch[1];
    }
    
    const typeMatch = err.message.match(/Got invalid value.*?Expected (\w+)/);
    if (typeMatch) {
      details = ` Expected type: ${typeMatch[1]}.`;
    }
    
    const missingMatch = err.message.match(/Missing required value for argument `(\w+)`/);
    if (missingMatch) {
      fieldName = missingMatch[1];
      details = ' This field is required.';
    }
    
    const userMsg = `Invalid data for field '${fieldName}'.${details}`;
    const devMsg = err.message.split('\n').slice(0, 3).join(' ');
    
    return sendError(res, isDev ? `Prisma error: ${devMsg}` : userMsg, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);

  return sendError(
    res,
    process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    500
  );
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  return sendError(res, `Route ${req.originalUrl} not found`, 404);
};
