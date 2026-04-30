import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/database.js';
import { Order } from '../models/Order.model.js';
import { Payment } from '../models/Payment.model.js';

const envPath = process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env';
dotenv.config({ path: envPath });

async function clearE2EOrders() {
  console.log('Clearing E2E seeded orders from Vaniki Crop database...');

  await connectDB();

  try {
    // Delete orders starting with VNK-E2E-
    const ordersToDelete = await Order.find({ orderNumber: /^VNK-E2E-/ });
    const orderIds = ordersToDelete.map(o => o._id);

    console.log(`Found ${ordersToDelete.length} E2E orders to delete.`);

    if (orderIds.length > 0) {
      await Order.deleteMany({ _id: { $in: orderIds } });
      await Payment.deleteMany({ orderId: { $in: orderIds } });
      console.log('Successfully deleted E2E orders and associated payments.');
    } else {
      console.log('No E2E orders found.');
    }

  } catch (error) {
    console.error('Failed to clear orders:', error);
  } finally {
    await disconnectDB();
  }
}

clearE2EOrders();
