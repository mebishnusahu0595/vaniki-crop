import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../utils/AppError.js';
import type { JwtAccessPayload } from './auth.service.js';

// ─── Augment Express Request ─────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      /** Authenticated user's ID (set by requireAuth middleware) */
      userId?: string;
      /** Authenticated user's role (set by requireAuth middleware) */
      userRole?: string;
      /** Authenticated user's selected store ID (set by requireAuth middleware) */
      userStoreId?: string;
      /** Active store context ID (set by extractStoreId middleware) */
      storeId?: string;
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────

/**
 * Verifies the JWT access token from the Authorization: Bearer header.
 * Attaches `userId`, `userRole`, and `userStoreId` to the request object.
 * Returns 401 if the token is missing, malformed, or expired.
 *
 * @param req - Express request
 * @param _res - Express response
 * @param next - Express next function
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT_SECRET is not configured', 500);
    }

    const decoded = jwt.verify(token, secret) as JwtAccessPayload;
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.userStoreId = decoded.storeId;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AppError('Token has expired. Please refresh your session.', 401));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid token.', 401));
    } else {
      next(new AppError('Authentication failed.', 401));
    }
  }
}

/**
 * Restricts access to users with the `storeAdmin` or `superAdmin` role.
 * Must be used AFTER `requireAuth` middleware.
 *
 * @param req - Express request (must have userId and userRole set)
 * @param _res - Express response
 * @param next - Express next function
 */
export function requireStoreAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.userRole || !['storeAdmin', 'superAdmin'].includes(req.userRole)) {
    return next(new AppError('Access denied. Store admin privileges required.', 403));
  }
  next();
}

/**
 * Restricts access to users with the `superAdmin` role only.
 * Must be used AFTER `requireAuth` middleware.
 *
 * @param req - Express request (must have userId and userRole set)
 * @param _res - Express response
 * @param next - Express next function
 */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.userRole !== 'superAdmin') {
    return next(new AppError('Access denied. Super admin privileges required.', 403));
  }
  next();
}

/**
 * Role-based authorization middleware factory.
 * Allows access to users with any of the specified roles.
 * Must be used AFTER `requireAuth` middleware.
 *
 * @param roles - Allowed roles
 * @returns Express middleware
 *
 * @example
 * router.get('/admin-or-super', requireAuth, requireRole('storeAdmin', 'superAdmin'), handler);
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return next(new AppError(`Access denied. Required role: ${roles.join(' or ')}`, 403));
    }
    next();
  };
}
