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
    const data = await staffService.listStaff();
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
