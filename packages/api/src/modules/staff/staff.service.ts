import { Staff } from '../../models/Staff.model.js';
import { User } from '../../models/User.model.js';
import { Order } from '../../models/Order.model.js';

export async function createStaff(payload: { name: string; mobile: string; email?: string }) {
  return Staff.create(payload);
}

export async function listStaff() {
  const staff = await Staff.find().sort({ createdAt: -1 });
  
  // Get referral counts for each staff
  const staffWithStats = await Promise.all(
    staff.map(async (s) => {
      const count = await User.countDocuments({ referredByStaff: s._id });
      return {
        ...s.toJSON(),
        referralCount: count,
      };
    })
  );
  
  return staffWithStats;
}

export async function getStaffReferrals(staffId: string) {
  const users = await User.find({ referredByStaff: staffId })
    .select('name mobile email createdAt savedAddress')
    .sort({ createdAt: -1 });

  const usersWithOrders = await Promise.all(
    users.map(async (user) => {
      const orders = await Order.find({ userId: user._id, status: 'delivered' })
        .select('orderNumber items totalAmount createdAt')
        .sort({ createdAt: -1 });
      
      return {
        ...user.toJSON(),
        orders
      };
    })
  );

  return usersWithOrders;
}

export async function updateStaffStatus(staffId: string, isActive: boolean) {
  return Staff.findByIdAndUpdate(staffId, { isActive }, { new: true });
}

export async function deleteStaff(staffId: string) {
  return Staff.findByIdAndDelete(staffId);
}
