import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { ApiError } from '../middleware/errorHandler.js';

/**
 * Generates a JWT access token for a given user.
 * @param id - User's MongoDB ObjectId
 * @param role - User's role (customer, storeAdmin, superAdmin)
 * @returns Signed JWT string
 */
function generateAccessToken(id: string, role: string): string {
  return jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: '15m' });
}

/**
 * Generates a JWT refresh token for a given user.
 * @param id - User's MongoDB ObjectId
 * @returns Signed JWT refresh string
 */
function generateRefreshToken(id: string): string {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
}

/**
 * Registers a new user account.
 * POST /api/auth/register
 * @param req - Express request with { name, email, mobile, password } in body
 * @param res - Express response
 * @param next - Express next function
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, email, mobile, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      throw new ApiError(409, 'User with this email or mobile already exists');
    }

    const user = await User.create({ name, email, mobile, password });

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticates a user with mobile and password.
 * POST /api/auth/login
 * @param req - Express request with { mobile, password } in body
 * @param res - Express response
 * @param next - Express next function
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mobile, password } = req.body;

    const user = await User.findOne({ mobile }).select('+password');
    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = generateRefreshToken(user.id);

    res.status(200).json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refreshes an expired access token using a valid refresh token.
 * POST /api/auth/refresh
 * @param req - Express request with { refreshToken } in body
 * @param res - Express response
 * @param next - Express next function
 */
export async function refreshAccessToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new ApiError(400, 'Refresh token is required');
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string };
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new ApiError(403, 'Invalid refresh token');
    }

    const newAccessToken = generateAccessToken(user.id, user.role);
    const newRefreshToken = generateRefreshToken(user.id);

    res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    next(error);
  }
}
