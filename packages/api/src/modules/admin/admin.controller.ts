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

export async function listInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listDealerInventory(req.userStoreId!);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const data = await adminService.upsertDealerInventory(req.userStoreId!, req.userId!, payload);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createProductRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.createDealerProductRequest(req.userStoreId!, req.userId!, req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listProductRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await adminService.listDealerProductRequests(req.userStoreId!, req.query);
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function getGarages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const garages = await adminService.getGarages();
    res.status(200).json({ success: true, data: garages });
  } catch (error) {
    next(error);
  }
}
export async function getSettlementEligibleOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listSettlementEligibleOrders(req.userStoreId!);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function createSettlementRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { orderIds } = req.body;
    const result = await adminService.createSettlementRequest(req.userStoreId!, req.userId!, orderIds);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
