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

/**
 * POST /api/analytics/pageview
 */
export async function recordPageView(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { url, visitorId } = req.body;
    if (!url || !visitorId) {
      res.status(400).json({ success: false, message: 'URL and visitorId are required' });
      return;
    }

    const userAgent = req.headers['user-agent'] || '';
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;

    // Detect device type
    let device: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'desktop';
    if (/tablet|ipad|playbook|silk/i.test(userAgent)) {
      device = 'tablet';
    } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|webos/i.test(userAgent)) {
      device = 'mobile';
    } else if (!userAgent) {
      device = 'unknown';
    }

    await analyticsService.recordPageView({ url, visitorId, userAgent, device, ip });
    res.status(201).json({ success: true, message: 'Page view recorded' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/website-reporting
 */
export async function getWebsiteReporting(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await analyticsService.getWebsiteReporting();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
