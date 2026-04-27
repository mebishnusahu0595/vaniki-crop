import type { Request, Response, NextFunction } from 'express';
import * as storeService from './store.service.js';

/**
 * GET /api/stores
 */
export async function listStores(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stores = await storeService.listActiveStores();
    res.status(200).json({ success: true, data: stores });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/stores/:id
 */
export async function getStoreDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await storeService.getStoreDetail(req.params.id as string);
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/stores/select
 */
export async function selectStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { storeId } = req.body;
    const result = await storeService.selectStoreForUser(req.userId!, storeId);
    res.status(200).json({ success: true, message: `Store "${result.storeName}" selected`, data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/superadmin/stores
 */
export async function createStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await storeService.createStore(req.body);
    res.status(201).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/superadmin/stores/:id
 */
export async function updateStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await storeService.updateStore(req.params.id as string, req.body);
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
}

export async function getAdminOwnStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await storeService.getAdminOwnStore(req.userStoreId, req.userId);
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminOwnStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const store = await storeService.updateAdminOwnStore(req.userStoreId, req.userId, req.body);
    res.status(200).json({ success: true, data: store });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/superadmin/stores/:id
 */
export async function deleteStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await storeService.deactivateStore(req.params.id as string);
    res.status(200).json({ success: true, message: 'Store deactivated' });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/stores/availability?productId=...&variantId=...
 */
export async function getProductAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId, variantId } = req.query;
    if (!productId || !variantId) {
      throw new Error('productId and variantId are required');
    }
    const availability = await storeService.getProductAvailabilityAcrossStores(productId as string, variantId as string);
    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/stores/cart-availability
 */
export async function getCartAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      throw new Error('Items array is required in request body');
    }
    const availability = await storeService.getCartAvailabilityAcrossStores(items);
    res.status(200).json({ success: true, data: availability });
  } catch (error) {
    next(error);
  }
}
