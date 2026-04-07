import type { NextFunction, Request, Response } from 'express';
import * as superAdminService from './superadmin.service.js';

export async function getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.getAnalytics(req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listStores(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await superAdminService.listStores(req.query);
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function createStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.createStore(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.updateStore(req.params.id as string, req.body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function toggleStoreActive(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.toggleStoreActive(req.params.id as string, req.body.isActive);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function reassignStoreAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.reassignStoreAdmin(req.params.id as string, req.body.adminId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listAdmins(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await superAdminService.listAdmins(req.query);
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function createAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.createAdmin(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.updateAdmin(req.params.id as string, req.body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deactivateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.deactivateAdmin(req.params.id as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await superAdminService.listCustomers(req.query);
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await superAdminService.listOrders(req.query);
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function getOrderDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.getOrderDetail(req.params.id as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.updateOrderStatus(req.params.id as string, req.body, req.userId!);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function listPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await superAdminService.listPayments(req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (error) {
    next(error);
  }
}

export async function listTestimonials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await superAdminService.listTestimonials(req.query);
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
}

export async function createTestimonial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.createTestimonial(req.body, req.file);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateTestimonial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.updateTestimonial(req.params.id as string, req.body, req.file);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function toggleTestimonial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.toggleTestimonial(req.params.id as string, req.body.isActive);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function reorderTestimonials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.reorderTestimonials(req.body.testimonials);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteTestimonial(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await superAdminService.deleteTestimonial(req.params.id as string);
    res.status(200).json({ success: true, message: 'Testimonial deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function getSiteSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.getSiteSettings();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateSiteSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.updateSiteSettings(req.body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStoreSecrets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.getStoreSecrets(req.params.id as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function updateStoreSecrets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await superAdminService.updateStoreSecrets(req.params.id as string, req.body.secrets);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
