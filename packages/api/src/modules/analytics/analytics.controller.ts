import type { Request, Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service.js';

/**
 * GET /api/analytics/superadmin
 */
export async function getSuperAdminAnalytics(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getSuperAdminAnalytics();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/admin
 */
export async function getStoreAdminAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Falls back to req.userStoreId if req.storeId is not set (ensures store admin gets own data)
    const storeId = req.storeId || req.userStoreId;
    
    if (!storeId) {
      res.status(400).json({ success: false, message: 'Store context not found' });
      return;
    }

    const data = await analyticsService.getStoreAdminAnalytics(storeId, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
