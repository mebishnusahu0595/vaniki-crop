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
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    
    let randomPoints: number;
    const roll = Math.random();
    if (roll < 0.7) {
      // 70% chance: 1 to 5 points
      randomPoints = Math.floor(Math.random() * 5) + 1;
    } else {
      // 30% chance (approx 2-3 times a week): 5 to 10 points
      randomPoints = Math.floor(Math.random() * 6) + 5;
    }

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.userId, checkInHistory: { $ne: today } },
      { 
        $inc: { loyaltyPoints: randomPoints }, 
        $set: { lastCheckIn: new Date() }, 
        $addToSet: { checkInHistory: today } 
      },
      { new: true }
    );

    if (!updatedUser) {
      const checkUser = await User.findById(req.userId);
      if (!checkUser) throw new AppError('User not found', 404);
      return res.status(400).json({ success: false, message: 'Already checked in today' });
    }

    res.status(200).json({
      success: true,
      message: 'Daily points added!',
      data: {
        loyaltyPoints: updatedUser.loyaltyPoints,
        checkInHistory: updatedUser.checkInHistory,
        pointsEarned: randomPoints
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
