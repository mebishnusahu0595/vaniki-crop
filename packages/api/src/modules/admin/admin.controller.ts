import type { Request, Response, NextFunction } from 'express';
import * as adminService from './admin.service.js';

export async function searchAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(200).json({ success: true, data: { orders: [], products: [], customers: [] } });
      return;
    }

    const result = await adminService.searchAdminStoreData(req.userStoreId!, q);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await adminService.listStoreCustomers(req.userStoreId!, req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}
