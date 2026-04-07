import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { Store } from '../models/Store.model.js';

/**
 * Middleware to extract the active store ID from:
 * 1. X-Store-Id header
 * 2. query.storeId
 * 3. User's selectedStore (if authenticated)
 * 
 * Attaches the value to `req.storeId`.
 */
export const extractStoreId = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const storeHeader = req.headers['x-store-id'] as string;
    const storeQuery = req.query.storeId as string;
    
    let storeId = storeHeader || storeQuery || req.userStoreId;

    if (storeId) {
      // Basic format check for MongoDB ObjectId
      if (!/^[0-9a-fA-F]{24}$/.test(storeId)) {
        return next(new AppError('Invalid Store ID format', 400));
      }
      req.storeId = storeId;
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Ensures that a StoreAdmin only accesses data belonging to their assigned store.
 * SuperAdmins are exempt.
 * Must be used AFTER `requireAuth` and `extractStoreId`.
 */
export const requireOwnStore = (req: Request, _res: Response, next: NextFunction) => {
  if (req.userRole === 'superAdmin') return next();

  if (req.userRole === 'storeAdmin') {
    // Check if the requested store context matches the admin's assigned store
    if (req.storeId && req.userStoreId && req.storeId !== req.userStoreId) {
      return next(new AppError('Access denied. You can only access your own store data.', 403));
    }
  }

  next();
};

/**
 * Validates that the extracted storeId exists and is active.
 * Useful for public routes like product listing.
 */
export const validateStoreContext = async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.storeId) return next();

  try {
    const store = await Store.findOne({ _id: req.storeId, isActive: true });
    if (!store) {
      return next(new AppError('Selected store is invalid or inactive', 404));
    }
    next();
  } catch (error) {
    next(error);
  }
};
