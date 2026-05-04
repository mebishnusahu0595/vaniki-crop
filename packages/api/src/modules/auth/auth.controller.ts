import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import { AppError } from '../../utils/AppError.js';

// ─── Cookie Config ───────────────────────────────────────────────────────

const REFRESH_TOKEN_COOKIE = 'refreshToken';

/** Options for the httpOnly refresh token cookie */
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  path: '/',
};

// ─── Controllers ─────────────────────────────────────────────────────────

/**
 * POST /api/auth/send-otp
 * Sends a 6-digit OTP to the given mobile number via MSG91.
 */
export async function sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.sendOtp(req.body);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully. Valid for 10 minutes.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/signup
 * Registers a new user after OTP verification.
 * Returns access token in body + refresh token in httpOnly cookie.
 */
export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, tokens } = await authService.signup(req.body);

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions);

    res.status(201).json({
      success: true,
      data: {
        user: user.toJSON(),
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/dealer-signup
 * Registers a dealer account and marks it pending for super-admin approval.
 */
export async function dealerSignup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.dealerSignup(req.body, req.file);

    res.status(201).json({
      success: true,
      message: 'Registration submitted. Please wait for super admin approval before login.',
      data: {
        user: user.toJSON(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Authenticates user with mobile + password.
 * Returns access token in body + refresh token in httpOnly cookie.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, tokens } = await authService.login(req.body);

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login-otp
 * Authenticates user with mobile + OTP.
 * Returns access token in body + refresh token in httpOnly cookie.
 */
export async function loginWithOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, tokens } = await authService.loginWithOtp(req.body);

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 * Uses the refresh token from the httpOnly cookie to issue a new token pair.
 */
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!currentToken) {
      throw new AppError('No refresh token found. Please log in.', 401);
    }

    const tokens = await authService.refreshTokens(currentToken);

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      data: { accessToken: tokens.accessToken },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * Clears the refresh token cookie and invalidates the stored token.
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.userId) {
      await authService.logout(req.userId);
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/forgot-password
 * Sends an OTP for password reset.
 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.forgotPassword(req.body);

    // Always return success to prevent enumeration
    res.status(200).json({
      success: true,
      message: 'If an account exists, an OTP has been sent to the registered mobile and/or email.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/firebase-login
 * Authenticates user via Firebase Phone Auth ID Token.
 */
export async function firebaseLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { idToken } = req.body;
    if (!idToken) throw new AppError('Firebase ID Token is required', 400);

    const { user, tokens } = await authService.firebaseLogin(idToken);

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      data: {
        user: user.toJSON(),
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/firebase-reset-password
 * Resets password using Firebase token verification.
 */
export async function firebaseResetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { idToken, newPassword } = req.body;
    if (!idToken || !newPassword) throw new AppError('ID Token and new password are required', 400);

    await authService.firebaseResetPassword({ idToken, newPassword });

    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully via Firebase verification.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/reset-password
 * Resets user's password after OTP verification.
 */
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.resetPassword(req.body);

    // Clear any refresh token cookies since all sessions are invalidated
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.getMe(req.userId!);

    res.status(200).json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/auth/service-mode
 * Updates the user's delivery/pickup preference.
 */
export async function updateServiceMode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.updateServiceMode(req.userId!, req.body.serviceMode);

    res.status(200).json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/auth/selected-store
 * Updates the user's selected store.
 */
export async function updateSelectedStore(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.updateSelectedStore(req.userId!, req.body.storeId);

    res.status(200).json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/auth/push-token
 * Updates the authenticated user's Expo push token.
 */
export async function updatePushToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.updatePushToken(req.userId!, req.body);

    res.status(200).json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/auth/me
 * Updates the authenticated user's profile details.
 */
export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.updateMe(req.userId!, req.body);

    res.status(200).json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/auth/me/profile-image
 * Updates the authenticated user's profile image.
 */
export async function updateProfileImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.updateProfileImage(req.userId!, req.file);

    res.status(200).json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/auth/change-password
 * Updates the authenticated user's password.
 */
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.changePassword(req.userId!, req.body);

    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
    res.status(200).json({
      success: true,
      message: 'Password updated successfully. Please log in again.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/auth/wishlist/toggle
 * Adds/removes a product from the authenticated user's wishlist.
 */
export async function toggleWishlist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.toggleWishlist(req.userId!, req.body);

    res.status(200).json({
      success: true,
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}
