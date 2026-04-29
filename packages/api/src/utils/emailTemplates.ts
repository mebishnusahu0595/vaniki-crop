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
