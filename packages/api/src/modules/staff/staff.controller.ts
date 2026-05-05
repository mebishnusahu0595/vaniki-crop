import type { Request, Response, NextFunction } from 'express';
import * as staffService from './staff.service.js';

export async function addStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.createStaff(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStaffList(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.listStaff(req.query as any);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStaffDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new Error('Staff ID is required');
    const data = await staffService.getStaffDetail(id as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStaffReferrals(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new Error('Staff ID is required');
    const data = await staffService.getStaffReferrals(id as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function loginStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.loginStaff(req.body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStaffMe(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.getStaffSession(req.staffId!);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getAvailableDeliveryOrders(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.listAvailableDeliveryOrders();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function assignDelivery(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new Error('Staff ID is required');
    const data = await staffService.assignDelivery(id as string, req.body, req.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStaffTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.listStaffTasks(req.staffId!);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getStaffTask(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.getStaffTask(req.staffId!, req.params.id as string);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function markTaskCompleted(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.markTaskCompleted(req.staffId!, req.params.id as string, req.body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deliverTask(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.deliverTask(req.staffId!, req.params.id as string, req.body, req.file);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function cancelTask(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await staffService.cancelTask(req.staffId!, req.params.id as string, req.body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function toggleStaffStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new Error('Staff ID is required');
    const data = await staffService.updateStaffStatus(id as string, req.body.isActive);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function removeStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new Error('Staff ID is required');
    await staffService.deleteStaff(id as string);
    res.status(200).json({ success: true, message: 'Staff removed' });
  } catch (error) {
    next(error);
  }
}
