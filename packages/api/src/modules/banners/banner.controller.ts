import type { Request, Response, NextFunction } from 'express';
import * as bannerService from './banner.service.js';

// ─── Public Controllers ──────────────────────────────────────────────────

/**
 * GET /api/banners
 * Returns active banners (Global + Store specific).
 */
export async function listBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const storeId = req.query.storeId as string || req.storeId;
    const banners = await bannerService.listActiveBanners(storeId);
    res.status(200).json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
}

// ─── Admin Controllers ───────────────────────────────────────────────────

/**
 * POST /api/admin/banners
 * Create banner with image.
 */
export async function createBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    const banner = await bannerService.createBanner(req.body, file, req.userRole, req.userStoreId);
    res.status(201).json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
}

export async function listAdminBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const banners = await bannerService.listAdminBanners(req.userRole!, req.userStoreId, req.query);
    res.status(200).json({ success: true, data: banners });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/banners/:id
 * Update banner with optional image.
 */
export async function updateBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file;
    const banner = await bannerService.updateBanner(req.params.id as string, req.body, file, req.userRole, req.userStoreId);
    res.status(200).json({ success: true, data: banner });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/banners/:id
 * Remove banner and image.
 */
export async function deleteBanner(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await bannerService.deleteBanner(req.params.id as string, req.userRole, req.userStoreId);
    res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/banners/reorder
 * Bulk update sort order.
 */
export async function reorderBanners(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await bannerService.reorderBanners(req.body.banners, req.userRole, req.userStoreId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
