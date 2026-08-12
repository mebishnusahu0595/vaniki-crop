import type { NextFunction, Request, Response } from 'express';
import * as cropService from './crop.service.js';

// ─── Public Controllers ───────────────────────────────────────────────────

export async function listActiveCrops(req: Request, res: Response, next: NextFunction) {
  try {
    const crops = await cropService.listActiveCrops();
    res.json({ success: true, data: crops });
  } catch (error) {
    next(error);
  }
}

export async function getCropBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const crop = await cropService.getCropBySlug(String(req.params.slug));
    res.json({ success: true, data: crop });
  } catch (error) {
    next(error);
  }
}

// ─── Superadmin Controllers ───────────────────────────────────────────────

export async function listAllCrops(req: Request, res: Response, next: NextFunction) {
  try {
    const crops = await cropService.listAllCrops();
    res.json({ success: true, data: crops });
  } catch (error) {
    next(error);
  }
}

export async function createCrop(req: Request, res: Response, next: NextFunction) {
  try {
    const crop = await cropService.createCrop(req.body, req.file);
    res.status(201).json({ success: true, data: crop });
  } catch (error) {
    next(error);
  }
}

export async function updateCrop(req: Request, res: Response, next: NextFunction) {
  try {
    const crop = await cropService.updateCrop(String(req.params.id), req.body, req.file);
    res.json({ success: true, data: crop });
  } catch (error) {
    next(error);
  }
}

export async function toggleCropActive(req: Request, res: Response, next: NextFunction) {
  try {
    const { isActive } = req.body;
    const crop = await cropService.toggleCropActive(String(req.params.id), isActive);
    res.json({ success: true, data: crop });
  } catch (error) {
    next(error);
  }
}

export async function deleteCrop(req: Request, res: Response, next: NextFunction) {
  try {
    await cropService.deleteCrop(String(req.params.id));
    res.json({ success: true, message: 'Crop deleted successfully' });
  } catch (error) {
    next(error);
  }
}
