/** Order status enum */
export type OrderStatus = 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

/** Payment status enum */
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/** Payment method options */
export type PaymentMethod = 'razorpay' | 'cod';

/** Item inside an order */
export interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

/** Shipping address */
export interface ShippingAddress {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
}

/** Full order object */
export interface OrderPublic {
  id: string;
  user: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  subtotal: number;
  shippingCharge: number;
  discount: number;
  totalAmount: number;
  razorpayOrderId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
