import mongoose from 'mongoose';
import { sendExpoPushNotification } from './expoPush.js';
import { getFirebaseAdmin } from '../config/firebase.js';
import { User } from '../models/User.model.js';
import { Staff } from '../models/Staff.model.js';
import { Store } from '../models/Store.model.js';
import type { IOrder } from '../models/Order.model.js';

interface SendNotificationInput {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export async function sendFcmNotification(tokens: string | string[], input: SendNotificationInput) {
  const admin = getFirebaseAdmin();
  if (!admin) {
    console.warn('[PUSH] Firebase Admin not initialized. Skipping FCM notification.');
    return;
  }

  const tokenList = Array.isArray(tokens) ? tokens : [tokens];
  const validTokens = tokenList.filter(t => typeof t === 'string' && t.trim().length > 0);
  if (validTokens.length === 0) return;

  const stringData: Record<string, string> = {};
  if (input.data) {
    for (const [key, value] of Object.entries(input.data)) {
      stringData[key] = String(value);
    }
  }

  const messagePayload: any = {
    notification: {
      title: input.title,
      body: input.body,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {})
    },
    data: stringData,
    android: {
      notification: {
        sound: 'default',
        channelId: 'orders',
        ...(input.imageUrl ? { imageUrl: input.imageUrl } : {})
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          mutableContent: true
        }
      }
    }
  };

  try {
    if (validTokens.length === 1) {
      await admin.messaging().send({
        token: validTokens[0],
        ...messagePayload
      });
      console.log(`[PUSH] FCM notification sent successfully to token: ${validTokens[0]}`);
    } else {
      const response = await admin.messaging().sendEachForMulticast({
        tokens: validTokens,
        ...messagePayload
      });
      console.log(`[PUSH] FCM multicast sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);
    }
  } catch (error: any) {
    console.error('[PUSH] FCM send error:', error.message);
  }
}

export async function sendNotificationToUser(userId: string | mongoose.Types.ObjectId, input: SendNotificationInput) {
  try {
    const user = await User.findById(userId).select('expoPushToken fcmToken');
    if (!user) return;

    if (user.fcmToken) {
      await sendFcmNotification(user.fcmToken, input);
    }
    if (user.expoPushToken) {
      try {
        await sendExpoPushNotification({
          to: user.expoPushToken,
          title: input.title,
          body: input.body,
          data: input.data
        });
      } catch (err: any) {
        console.error('[PUSH] Expo user send error:', err.message);
      }
    }
  } catch (error: any) {
    console.error('[PUSH] sendNotificationToUser error:', error.message);
  }
}

export async function sendNotificationToStaff(staffId: string | mongoose.Types.ObjectId, input: SendNotificationInput) {
  try {
    const staff = await Staff.findById(staffId).select('expoPushToken fcmToken');
    if (!staff) return;

    if (staff.fcmToken) {
      await sendFcmNotification(staff.fcmToken, input);
    }
    if (staff.expoPushToken) {
      try {
        await sendExpoPushNotification({
          to: staff.expoPushToken,
          title: input.title,
          body: input.body,
          data: input.data
        });
      } catch (err: any) {
        console.error('[PUSH] Expo staff send error:', err.message);
      }
    }
  } catch (error: any) {
    console.error('[PUSH] sendNotificationToStaff error:', error.message);
  }
}

/**
 * Trigger notification on a new order event:
 * - Notify all superadmins.
 * - Notify the store owner (dealer).
 * - If serviceMode is 'pickup', notify all dealer staff of that store.
 */
export async function triggerOrderPlacedNotifications(order: IOrder) {
  try {
    const firstItemImage = order.items?.[0]?.image || '';
    const payload: SendNotificationInput = {
      title: 'New Order Received',
      body: `Order ${order.orderNumber} placed for ₹${order.totalAmount}.`,
      data: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        type: 'order_placed',
        status: order.status,
        date: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
        totalAmount: String(order.totalAmount)
      },
      imageUrl: firstItemImage
    };

    // 1. Notify all active Superadmins
    const superadmins = await User.find({ role: 'superAdmin', isActive: true }).select('fcmToken expoPushToken');
    const superadminFcmTokens = superadmins.map(s => s.fcmToken).filter(Boolean) as string[];
    
    if (superadminFcmTokens.length > 0) {
      await sendFcmNotification(superadminFcmTokens, payload);
    }
    
    for (const adminUser of superadmins) {
      if (adminUser.expoPushToken) {
        try {
          await sendExpoPushNotification({
            to: adminUser.expoPushToken,
            title: payload.title,
            body: payload.body,
            data: payload.data
          });
        } catch {}
      }
    }

    // 2. Notify Store Owner (Dealer)
    const store = await Store.findById(order.storeId);
    if (store?.adminId) {
      await sendNotificationToUser(store.adminId, payload);
    }

    // 3. If pickup order, notify Dealer Staff of that store
    if (order.serviceMode === 'pickup') {
      const dealerStaffs = await Staff.find({ storeId: order.storeId, role: 'dealer-staff', isActive: true }).select('fcmToken expoPushToken');
      const staffFcmTokens = dealerStaffs.map(s => s.fcmToken).filter(Boolean) as string[];
      
      if (staffFcmTokens.length > 0) {
        await sendFcmNotification(staffFcmTokens, payload);
      }
      
      for (const staff of dealerStaffs) {
        if (staff.expoPushToken) {
          try {
            await sendExpoPushNotification({
              to: staff.expoPushToken,
              title: payload.title,
              body: payload.body,
              data: payload.data
            });
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.error('[PUSH] triggerOrderPlacedNotifications error:', err.message);
  }
}

/**
 * Trigger notification on order status update:
 * - Notify customer about status transition.
 * - If status is delivered, notify superadmins.
 */
export async function triggerOrderStatusNotifications(order: IOrder) {
  try {
    const firstItemImage = order.items?.[0]?.image || '';
    const payload: SendNotificationInput = {
      title: `Order Status: ${order.status.toUpperCase()}`,
      body: `Your order ${order.orderNumber} is now ${order.status}.`,
      data: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        type: 'order_status_update',
        status: order.status,
        date: order.updatedAt ? order.updatedAt.toISOString() : new Date().toISOString(),
        totalAmount: String(order.totalAmount)
      },
      imageUrl: firstItemImage
    };

    // Notify Customer
    await sendNotificationToUser(order.userId, payload);

    // If order was delivered, notify superadmins as well
    if (order.status === 'delivered') {
      const superadmins = await User.find({ role: 'superAdmin', isActive: true }).select('fcmToken expoPushToken');
      const superadminFcmTokens = superadmins.map(s => s.fcmToken).filter(Boolean) as string[];
      const superadminPayload = {
        title: 'Order Delivered Successfully',
        body: `Order ${order.orderNumber} has been delivered.`,
        data: payload.data,
        imageUrl: firstItemImage
      };

      if (superadminFcmTokens.length > 0) {
        await sendFcmNotification(superadminFcmTokens, superadminPayload);
      }

      for (const adminUser of superadmins) {
        if (adminUser.expoPushToken) {
          try {
            await sendExpoPushNotification({
              to: adminUser.expoPushToken,
              title: superadminPayload.title,
              body: superadminPayload.body,
              data: superadminPayload.data
            });
          } catch {}
        }
      }
    }
  } catch (err: any) {
    console.error('[PUSH] triggerOrderStatusNotifications error:', err.message);
  }
}

/**
 * Trigger notification to delivery staff when a task is assigned.
 */
export async function triggerDeliveryAssignedNotifications(order: IOrder, staffId: any) {
  try {
    const payload: SendNotificationInput = {
      title: 'New Delivery Task Assigned',
      body: `You have been assigned to deliver order ${order.orderNumber}.`,
      data: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        type: 'delivery_assigned',
        status: order.status
      }
    };
    await sendNotificationToStaff(staffId, payload);
  } catch (err: any) {
    console.error('[PUSH] triggerDeliveryAssignedNotifications error:', err.message);
  }
}
