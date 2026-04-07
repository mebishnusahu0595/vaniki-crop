import type { Request, Response, NextFunction } from 'express';
import * as couponService from './coupon.service.js';

/**
 * POST /api/coupons/validate
 * Public endpoint to check coupon validity and discount amount.
 */
export async function validateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, storeId, cartTotal } = req.body;
    const result = await couponService.validateCoupon(code, storeId, cartTotal);
    
    if (!result.valid) {
      res.status(400).json({ success: false, ...result });
      return;
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/admin/coupons
 * Admin only: Create a new coupon.
 */
export async function createCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const coupon = await couponService.createCoupon(req.body, req.userId!);
    res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/coupons
 * List all coupons (filtered by store if storeAdmin).
 */
export async function listCoupons(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const coupons = await couponService.listCoupons(req.userRole!, req.userStoreId);
    res.status(200).json({ success: true, data: coupons });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/admin/coupons/:id
 */
export async function updateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const coupon = await couponService.updateCoupon(req.params.id as string, req.body);
    res.status(200).json({ success: true, data: coupon });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/admin/coupons/:id
 */
export async function deactivateCoupon(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await couponService.deactivateCoupon(req.params.id as string);
    res.status(200).json({ success: true, message: 'Coupon deactivated successfully' });
  } catch (error) {
    next(error);
  }
}
