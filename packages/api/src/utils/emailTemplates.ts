/**
 * HTML Email template for a new order.
 */
export const orderPlacedTemplate = (order: any, user: any) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #332e2eff; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
    .header { text-align: center; margin-bottom: 20px; }
    .footer { font-size: 12px; color: #777; margin-top: 30px; text-align: center; }
    .item-list { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .item-list th, .item-list td { padding: 10px; border-bottom: 1px solid #eee; text-align: left; }
    .total-section { margin-top: 20px; text-align: right; }
    .button { display: inline-block; padding: 10px 20px; background-color: #2D6A4F; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #2D6A4F;">Order Confirmed!</h1>
      <p>Thank you for choosing Vaniki Crop.</p>
    </div>
    
    <p>Hi ${user.name},</p>
    <p>Your order <strong>${order.orderNumber}</strong> has been successfully placed. We're getting it ready for ${order.serviceMode}.</p>
    
    <table class="item-list">
      <thead>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Price</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map((item: any) => `
          <tr>
            <td>${item.productName} (${item.variantLabel})</td>
            <td>${item.qty}</td>
            <td>₹${item.price}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="total-section">
      <p>Subtotal: ₹${order.subtotal}</p>
      ${order.couponDiscount ? `<p>Coupon Discount: -₹${order.couponDiscount}</p>` : ''}
      ${order.loyaltyDiscount ? `<p>Loyalty Discount: -₹${order.loyaltyDiscount}</p>` : ''}
      ${order.deliveryCharge ? `<p>Delivery: ₹${order.deliveryCharge}</p>` : ''}
      <h2 style="color: #2D6A4F;">Total: ₹${order.totalAmount}</h2>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://vanikicrop.com/my-orders/${order._id}" class="button">Track Your Order</a>
    </div>
    
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Vaniki Crop Pesticide Store. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

/**
 * HTML template for an order status update.
 */
export const orderStatusUpdateTemplate = (order: any, user: any, newStatus: string, note?: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
    .status-badge { display: inline-block; padding: 5px 15px; color: white; background-color: #52B788; border-radius: 20px; text-transform: uppercase; font-size: 14px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h2 style="color: #2D6A4F;">Your order status was updated</h2>
    <p>Hi ${user.name},</p>
    <p>The status for your order <strong>${order.orderNumber}</strong> has changed to:</p>
    <div style="text-align: center; margin: 20px 0;">
      <span class="status-badge">${newStatus}</span>
    </div>
    ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
    <p>You can view the latest updates by tracking your order below.</p>
    <div style="text-align: center; margin-top: 30px;">
      <a href="https://vanikicrop.com/my-orders/${order._id}" style="color: #2D6A4F; font-weight: bold; text-decoration: underline;">Track Your Order</a>
    </div>
  </div>
</body>
</html>
`;
/**
 * HTML template for password reset OTP.
 */
export const passwordResetOtpTemplate = (user: any, otp: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; text-align: center; }
    .otp-code { display: inline-block; padding: 15px 30px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2D6A4F; background-color: #f0fdf4; border: 2px dashed #52B788; border-radius: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h2 style="color: #2D6A4F;">Password Reset OTP</h2>
    <p>Hi ${user.name || 'there'},</p>
    <p>You requested a password reset for your Vaniki Crop account. Use the OTP below to proceed:</p>
    <div class="otp-code">${otp}</div>
    <p>This OTP is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
    <div style="font-size: 12px; color: #777; margin-top: 30px;">
      <p>&copy; ${new Date().getFullYear()} Vaniki Crop. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;


/**
 * Comprehensive HTML template for admin order notification.
 * Sent to vaniki.crop@gmail.com (ORDER_NOTIFICATION_EMAIL) on every new order.
 */
export const adminOrderNotificationTemplate = (order: any, store: any, customer: any) => {
  const statusColor: Record<string, string> = {
    placed: '#f59e0b',
    confirmed: '#3b82f6',
    processing: '#8b5cf6',
    shipped: '#06b6d4',
    delivered: '#10b981',
    cancelled: '#ef4444',
  };
  const paymentColor: Record<string, string> = {
    pending: '#f59e0b',
    paid: '#10b981',
    failed: '#ef4444',
    refunded: '#8b5cf6',
  };

  const itemsHtml = (order.items || []).map((item: any) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${item.productName}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9;">${item.variantLabel}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: center;">${item.qty}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: right;">₹${item.price}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f1f5f9; text-align: right;">₹${item.price * item.qty}</td>
    </tr>
  `).join('');

  const address = order.shippingAddress
    ? `${order.shippingAddress.street || ''}, ${order.shippingAddress.city || ''}, ${order.shippingAddress.state || ''} - ${order.shippingAddress.pincode || ''}`
    : 'N/A';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
    .wrapper { max-width: 650px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { background: #2D6A4F; padding: 24px 30px; color: #fff; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; opacity: 0.85; font-size: 13px; }
    .body { padding: 24px 30px; }
    .info-grid { display: table; width: 100%; margin: 16px 0; }
    .info-row { display: table-row; }
    .info-label { display: table-cell; padding: 6px 12px 6px 0; font-weight: 600; font-size: 13px; color: #64748b; white-space: nowrap; }
    .info-value { display: table-cell; padding: 6px 0; font-size: 14px; color: #1e293b; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #fff; }
    table.items { width: 100%; border-collapse: collapse; margin: 16px 0; }
    table.items th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; }
    .summary { margin-top: 16px; text-align: right; font-size: 14px; }
    .summary .total { font-size: 18px; font-weight: 800; color: #2D6A4F; }
    .footer { background: #f8fafc; padding: 16px 30px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🛒 New Order Received</h1>
      <p>${order.orderNumber} · ${new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
    </div>
    <div class="body">
      <div class="info-grid">
        <div class="info-row"><span class="info-label">Store:</span><span class="info-value">${store?.name || 'Unknown Store'}</span></div>
        <div class="info-row"><span class="info-label">Customer:</span><span class="info-value">${customer?.name || 'N/A'} (${customer?.mobile || 'N/A'})</span></div>
        <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${customer?.email || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Service Mode:</span><span class="info-value">${order.serviceMode === 'pickup' ? '📦 Pickup' : '🚚 Delivery'}</span></div>
        <div class="info-row"><span class="info-label">Address:</span><span class="info-value">${address}</span></div>
        <div class="info-row"><span class="info-label">Order Status:</span><span class="info-value"><span class="badge" style="background:${statusColor[order.status] || '#64748b'}">${order.status}</span></span></div>
        <div class="info-row"><span class="info-label">Payment Method:</span><span class="info-value">${order.paymentMethod === 'cod' ? '💵 Cash on Delivery' : '💳 Razorpay'}</span></div>
        <div class="info-row"><span class="info-label">Payment Status:</span><span class="info-value"><span class="badge" style="background:${paymentColor[order.paymentStatus] || '#64748b'}">${order.paymentStatus}</span></span></div>
      </div>

      <h3 style="margin: 20px 0 8px; font-size: 15px; color: #334155;">Items Ordered</h3>
      <table class="items">
        <thead>
          <tr>
            <th>Product</th>
            <th>Variant</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Price</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="summary">
        <p>Subtotal: ₹${order.subtotal}</p>
        ${order.couponDiscount ? `<p>Coupon Discount: -₹${order.couponDiscount}</p>` : ''}
        ${order.loyaltyDiscount ? `<p>Loyalty Discount: -₹${order.loyaltyDiscount}</p>` : ''}
        ${order.deliveryCharge ? `<p>Delivery Charge: ₹${order.deliveryCharge}</p>` : ''}
        <p class="total">Total: ₹${order.totalAmount}</p>
      </div>
    </div>
    <div class="footer">
      <p>Vaniki Crop Admin Notification · <a href="https://superadmin.vanikicrop.com/orders" style="color: #2D6A4F;">View in Dashboard</a></p>
    </div>
  </div>
</body>
</html>
`;
};

/**
 * Comprehensive HTML template for admin order status change notification.
 * Sent to vaniki.crop@gmail.com (ORDER_NOTIFICATION_EMAIL) on every status change.
 */
export const adminOrderStatusChangeTemplate = (order: any, store: any, customer: any, newStatus: string, note?: string) => {
  const statusColor: Record<string, string> = {
    placed: '#f59e0b',
    confirmed: '#3b82f6',
    processing: '#8b5cf6',
    shipped: '#06b6d4',
    delivered: '#10b981',
    cancelled: '#ef4444',
  };
  const paymentColor: Record<string, string> = {
    pending: '#f59e0b',
    paid: '#10b981',
    failed: '#ef4444',
    refunded: '#8b5cf6',
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #1e293b; margin: 0; padding: 0; background: #f8fafc; }
    .wrapper { max-width: 650px; margin: 20px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { background: #1e40af; padding: 24px 30px; color: #fff; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; opacity: 0.85; font-size: 13px; }
    .body { padding: 24px 30px; }
    .info-grid { display: table; width: 100%; margin: 16px 0; }
    .info-row { display: table-row; }
    .info-label { display: table-cell; padding: 6px 12px 6px 0; font-weight: 600; font-size: 13px; color: #64748b; white-space: nowrap; }
    .info-value { display: table-cell; padding: 6px 0; font-size: 14px; color: #1e293b; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #fff; }
    .footer { background: #f8fafc; padding: 16px 30px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>📋 Order Status Updated</h1>
      <p>${order.orderNumber} → <strong>${newStatus.toUpperCase()}</strong></p>
    </div>
    <div class="body">
      <div class="info-grid">
        <div class="info-row"><span class="info-label">Order:</span><span class="info-value">${order.orderNumber}</span></div>
        <div class="info-row"><span class="info-label">Store:</span><span class="info-value">${store?.name || 'Unknown Store'}</span></div>
        <div class="info-row"><span class="info-label">Customer:</span><span class="info-value">${customer?.name || 'N/A'} (${customer?.mobile || 'N/A'})</span></div>
        <div class="info-row"><span class="info-label">Service Mode:</span><span class="info-value">${order.serviceMode === 'pickup' ? '📦 Pickup' : '🚚 Delivery'}</span></div>
        <div class="info-row"><span class="info-label">New Status:</span><span class="info-value"><span class="badge" style="background:${statusColor[newStatus] || '#64748b'}">${newStatus}</span></span></div>
        <div class="info-row"><span class="info-label">Payment Status:</span><span class="info-value"><span class="badge" style="background:${paymentColor[order.paymentStatus] || '#64748b'}">${order.paymentStatus}</span></span></div>
        <div class="info-row"><span class="info-label">Payment Method:</span><span class="info-value">${order.paymentMethod === 'cod' ? '💵 COD' : '💳 Razorpay'}</span></div>
        <div class="info-row"><span class="info-label">Total Amount:</span><span class="info-value" style="font-weight:800; color:#2D6A4F;">₹${order.totalAmount}</span></div>
        ${note ? `<div class="info-row"><span class="info-label">Note:</span><span class="info-value">${note}</span></div>` : ''}
      </div>
      <p style="font-size:13px; color:#64748b; margin-top:20px;">Updated at: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
    </div>
    <div class="footer">
      <p>Vaniki Crop Admin Notification · <a href="https://superadmin.vanikicrop.com/orders" style="color: #2D6A4F;">View in Dashboard</a></p>
    </div>
  </div>
</body>
</html>
`;
};
