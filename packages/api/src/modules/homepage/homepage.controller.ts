import type { Request, Response, NextFunction } from 'express';
import * as homepageService from './homepage.service.js';

/**
 * GET /api/homepage
 * Consolidates all data required for the storefront landing page.
 */
export async function getHomepage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const storeId = req.query.storeId as string || req.storeId;
    const data = await homepageService.getHomepageData(storeId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
