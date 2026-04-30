import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { User } from '../../models/User.model.js';
import { AppError } from '../../utils/AppError.js';

const router = Router();

/**
 * POST /api/loyalty/checkin
 * Daily check-in to earn 1 point
 */
router.post('/checkin', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw new AppError('User not found', 404);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const lastCheckInStr = user.lastCheckIn 
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(user.lastCheckIn)
      : '';

    if (lastCheckInStr === today) {
      return res.status(400).json({ success: false, message: 'Already checked in today' });
    }

    user.loyaltyPoints += 1;
    user.lastCheckIn = new Date();
    user.checkInHistory.push(today);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Daily point added!',
      data: {
        loyaltyPoints: user.loyaltyPoints,
        checkInHistory: user.checkInHistory
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/loyalty/data
 * Get user's loyalty points and history
 */
router.get('/data', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('loyaltyPoints checkInHistory lastCheckIn');
    if (!user) throw new AppError('User not found', 404);

    res.status(200).json({
      success: true,
      data: {
        loyaltyPoints: user.loyaltyPoints,
        checkInHistory: user.checkInHistory,
        lastCheckIn: user.lastCheckIn
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
