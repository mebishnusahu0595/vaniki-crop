import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler.js';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Verifies JWT access token from the Authorization header.
 * Attaches userId and userRole to the request object.
 * @param req - Express request object (extended)
 * @param _res - Express response object
 * @param next - Express next function
 */
export function authenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Access denied. No token provided.');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new ApiError(500, 'JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret) as { id: string; role: string };
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(401, 'Invalid or expired token'));
    }
  }
}

/**
 * Role-based authorization middleware factory.
 * Restricts access to users with specific roles.
 * @param roles - Allowed roles for the route
 * @returns Express middleware function
 */
export function authorize(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      next(new ApiError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}
