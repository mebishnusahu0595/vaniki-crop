import { Coupon, type ICoupon } from '../../models/Coupon.model.js';
import { Order } from '../../models/Order.model.js';
import { User } from '../../models/User.model.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Validates a coupon code against business rules.
 */
export async function validateCoupon(code: string, storeId: string, cartTotal: number, userId?: string) {
  const coupon = await Coupon.findOne({ code, isActive: true });

  if (!coupon) {
    return { valid: false, message: 'Invalid or inactive coupon code' };
  }

  // 1. Expiry check
  if (new Date() > coupon.expiryDate) {
    return { valid: false, message: 'Coupon has expired' };
  }

  // 2. Usage limit check (Global)
  if (coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: 'Coupon usage limit reached globally' };
  }

  // 3. Per-user limit check
  if (userId && coupon.perUserLimit) {
    const userUsageCount = await Order.countDocuments({
      userId,
      couponCode: code.toUpperCase(),
      status: { $ne: 'cancelled' },
    });

    if (userUsageCount >= coupon.perUserLimit) {
      return { 
        valid: false, 
        message: coupon.perUserLimit === 1 
          ? 'You have already used this coupon' 
          : `You can only use this coupon ${coupon.perUserLimit} times`
      };
    }
  }

  // 3. Store applicability check
  if (coupon.applicableStores.length > 0) {
    const isApplicable = coupon.applicableStores.some(
      (id) => id.toString() === storeId
    );
    if (!isApplicable) {
      return { valid: false, message: 'Coupon is not valid for this store' };
    }
  }

  // 4. Minimum order amount check
  if (cartTotal < coupon.minOrderAmount) {
    return { 
      valid: false, 
      message: `Minimum order of ₹${coupon.minOrderAmount} required for this coupon` 
    };
  }

  // 5. Calculate discount
  let discount = 0;
  if (coupon.type === 'percent') {
    discount = (cartTotal * coupon.value) / 100;
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else {
    discount = coupon.value;
  }

  // Ensure discount doesn't exceed cart total
  discount = Math.min(discount, cartTotal);

  return {
    valid: true,
    discount,
    finalAmount: cartTotal - discount,
    coupon,
    message: `₹${discount.toFixed(2)} savings applied!`
  };
}

/**
 * Admin: Create a new coupon.
 */
export async function createCoupon(data: any, creatorId: string) {
  const existing = await Coupon.findOne({ code: data.code });
  if (existing) {
    throw new AppError('Coupon code already exists', 400);
  }

  const coupon = await Coupon.create({
    ...data,
    createdBy: creatorId,
  });

  return coupon;
}

/**
 * Admin: List coupons with role-based filtering.
 */
export async function listCoupons(userRole: string, userStoreId?: string) {
  const filter: any = {};
  
  if (userRole === 'storeAdmin' && userStoreId) {
    filter.applicableStores = userStoreId;
  }

  return Coupon.find(filter).sort({ createdAt: -1 }).populate('applicableStores', 'name');
}

/**
 * Admin: Update coupon.
 */
export async function updateCoupon(id: string, data: any) {
  const coupon = await Coupon.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!coupon) {
    throw new AppError('Coupon not found', 404);
  }
  return coupon;
}

/**
 * Admin: Soft delete (deactivate) coupon.
 */
export async function deactivateCoupon(id: string) {
  const coupon = await Coupon.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!coupon) {
    throw new AppError('Coupon not found', 404);
  }
  return coupon;
}

/**
 * Admin: Get coupon usage statistics.
 */
export async function getCouponUsageStats(couponId: string) {
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new AppError('Coupon not found', 404);
  }

  const redemptions = await Order.find({
    couponCode: coupon.code,
    status: { $ne: 'cancelled' },
  })
    .select('orderNumber totalAmount couponDiscount createdAt userId shippingAddress paymentStatus')
    .populate('userId', 'name mobile email')
    .sort({ createdAt: -1 })
    .lean();

  const totalDiscountGiven = redemptions.reduce(
    (sum, order) => sum + (order.couponDiscount || 0),
    0
  );

  return {
    coupon,
    totalRedemptions: redemptions.length,
    totalDiscountGiven,
    redemptions,
  };
}

/**
 * Gets all active and available coupons for storefront customers.
 */
export async function getAvailableCoupons(storeId?: string, cartTotal?: number, userId?: string) {
  const now = new Date();
  const query: any = {
    isActive: true,
    expiryDate: { $gt: now },
  };

  const coupons = await Coupon.find(query).sort({ value: -1 }).lean();

  const results = [];
  for (const coupon of coupons) {
    if (coupon.usedCount >= coupon.usageLimit) continue;

    // Check store scope if applicable
    if (storeId && coupon.applicableStores && coupon.applicableStores.length > 0) {
      const isForStore = coupon.applicableStores.some((id: any) => id.toString() === storeId.toString());
      if (!isForStore) continue;
    }

    // Check per-user limit if userId is given
    let isUserEligible = true;
    if (userId && coupon.perUserLimit) {
      const userUsageCount = await Order.countDocuments({
        userId,
        couponCode: coupon.code.toUpperCase(),
        status: { $ne: 'cancelled' },
      });
      if (userUsageCount >= coupon.perUserLimit) {
        isUserEligible = false;
      }
    }

    if (!isUserEligible) continue;

    // Calculate potential discount if cartTotal is provided
    let calculatedDiscount = 0;
    if (cartTotal && cartTotal >= (coupon.minOrderAmount || 0)) {
      if (coupon.type === 'percent') {
        calculatedDiscount = (cartTotal * coupon.value) / 100;
        if (coupon.maxDiscount && calculatedDiscount > coupon.maxDiscount) {
          calculatedDiscount = coupon.maxDiscount;
        }
      } else {
        calculatedDiscount = Math.min(coupon.value, cartTotal);
      }
    }

    results.push({
      id: coupon._id.toString(),
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount || 0,
      maxDiscount: coupon.maxDiscount,
      expiryDate: coupon.expiryDate,
      calculatedDiscount: Math.round(calculatedDiscount),
      isApplicableToCart: !cartTotal || cartTotal >= (coupon.minOrderAmount || 0),
    });
  }

  return results;
}
