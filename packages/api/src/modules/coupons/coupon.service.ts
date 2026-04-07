import { Coupon, type ICoupon } from '../../models/Coupon.model.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Validates a coupon code against business rules.
 */
export async function validateCoupon(code: string, storeId: string, cartTotal: number) {
  const coupon = await Coupon.findOne({ code, isActive: true });

  if (!coupon) {
    return { valid: false, message: 'Invalid or inactive coupon code' };
  }

  // 1. Expiry check
  if (new Date() > coupon.expiryDate) {
    return { valid: false, message: 'Coupon has expired' };
  }

  // 2. Usage limit check
  if (coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: 'Coupon usage limit reached' };
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
