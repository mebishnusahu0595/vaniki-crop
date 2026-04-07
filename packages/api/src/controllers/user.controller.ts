import type { Response, NextFunction } from 'express';
import { User } from '../models/User.model.js';
import { ApiError } from '../middleware/errorHandler.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * Fetches the authenticated user's profile.
 * GET /api/users/me
 * @param req - Authenticated request
 * @param res - Express response
 * @param next - Express next function
 */
export async function getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await User.findById(req.userId).select('-password -refreshToken -otp -otpExpiry');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates the authenticated user's profile.
 * PUT /api/users/me
 * @param req - Authenticated request with update fields in body
 * @param res - Express response
 * @param next - Express next function
 */
export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const allowedFields = ['name', 'address'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    }).select('-password -refreshToken -otp -otpExpiry');

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

/**
 * Lists all users (admin only) with pagination.
 * GET /api/users
 * @param req - Authenticated admin request
 * @param res - Express response
 * @param next - Express next function
 */
export async function getAllUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().select('-password -refreshToken -otp -otpExpiry').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
}
