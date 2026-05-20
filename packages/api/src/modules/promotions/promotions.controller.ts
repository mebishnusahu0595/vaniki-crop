import { type Request, type Response, type NextFunction } from 'express';
import * as promotionsService from './promotions.service.js';

export async function listDealersPromotions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const promotions = await promotionsService.listActivePromotions();
    res.status(200).json({ success: true, data: promotions });
  } catch (error) {
    next(error);
  }
}

export async function listAdminPromotions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const promotions = await promotionsService.listAdminPromotions(req.query);
    res.status(200).json({ success: true, data: promotions });
  } catch (error) {
    next(error);
  }
}

export async function createPromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const promotion = await promotionsService.createPromotion(req.body, req.file);
    res.status(201).json({ success: true, data: promotion });
  } catch (error) {
    next(error);
  }
}

export async function updatePromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const promotion = await promotionsService.updatePromotion(String(req.params.id), req.body, req.file);
    res.status(200).json({ success: true, data: promotion });
  } catch (error) {
    next(error);
  }
}

export async function deletePromotion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await promotionsService.deletePromotion(String(req.params.id));
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
