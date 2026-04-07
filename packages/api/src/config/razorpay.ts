import Razorpay from 'razorpay';

/**
 * Initialize Razorpay instance with environment variables.
 */
let razorpay: Razorpay;

try {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || '',
  });
} catch (error) {
  console.error('Failed to initialize Razorpay:', error);
}

export { razorpay };
