const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY || "");
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Hygiene Hub <onboarding@resend.dev>";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "hygienhub@gmail.com";
const STORE_URL = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0];
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || `${STORE_URL}/logo.png`;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Send order confirmation email to the customer.
 */
async function sendOrderConfirmation(toEmail, order) {
  try {
    const safeOrderId = (order.$id || order._id || "").toString();
    const shortOrderId = safeOrderId.slice(-8).toUpperCase();
    const orderDate = order.orderDate
      ? new Date(order.orderDate).toLocaleDateString("en-ZA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-ZA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
    const totalAmount = Number(order.totalAmount || 0).toFixed(2);
    const customerName = escapeHtml(order.customerName || order.addressInfo?.name || "there");
    const trackOrderUrl = `${STORE_URL}/track-order?orderId=${encodeURIComponent(safeOrderId)}`;

    const itemsHtml = (order.cartItems || [])
      .map(
        (item) => `
<tr>
  <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td width="68" style="vertical-align: top;">
          ${
            item.image
              ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || item.name || "Product")}" width="60" height="60" style="border-radius: 10px; object-fit: cover; display: block;" />`
              : `<div style="width:60px;height:60px;border-radius:10px;background:#e2e8f0;"></div>`
          }
        </td>
        <td style="vertical-align: top;">
          <p style="margin: 0; color: #0f172a; font-size: 14px; font-weight: 700;">${escapeHtml(item.title || item.name || "Product")}</p>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">Qty ${Number(item.quantity || 0)}</p>
        </td>
        <td style="vertical-align: top; text-align: right; color: #0f172a; font-size: 14px; font-weight: 700;">
          R${Number(item.price || 0).toFixed(2)}
        </td>
      </tr>
    </table>
  </td>
</tr>
`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order Confirmation</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f6f8;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 24px 20px;background:linear-gradient(135deg,#124e66 0%,#2d6a4f 100%);">
              <img src="${escapeHtml(EMAIL_LOGO_URL)}" width="120" alt="Hygiene Hub" style="display:block;margin:0 auto;" />
              <p style="margin:12px 0 0;color:rgba(255,255,255,0.88);font-size:13px;letter-spacing:0.2px;">Order Confirmation</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f8fafc;border-radius:12px;">
                <tr>
                  <td align="center" style="padding:22px 16px;">
                    <p style="margin:0;color:#16a34a;font-size:24px;font-weight:700;">Order Confirmed</p>
                    <p style="margin:12px 0 0;color:#334155;font-size:14px;line-height:1.6;">Hi ${customerName},</p>
                    <p style="margin:8px 0 0;color:#475569;font-size:14px;line-height:1.6;">Thank you for shopping with <strong>Hygiene Hub Skincare</strong>. Your payment has been successfully processed.</p>
                    <a href="${trackOrderUrl}" style="display:inline-block;margin-top:16px;background:#0f6bdc;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:700;">Track Your Order</a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:18px;background:#f8fafc;border-radius:12px;">
                <tr><td style="padding:18px 18px 8px;color:#0f172a;font-size:16px;font-weight:700;">Order Details</td></tr>
                <tr><td style="padding:0 18px 6px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr><td style="color:#475569;font-size:14px;">Order ID</td><td align="right" style="color:#0f172a;font-size:14px;font-weight:700;">#${escapeHtml(shortOrderId || safeOrderId)}</td></tr>
                    <tr><td style="padding-top:8px;color:#475569;font-size:14px;">Date</td><td align="right" style="padding-top:8px;color:#0f172a;font-size:14px;font-weight:700;">${orderDate}</td></tr>
                    <tr><td style="padding-top:8px;padding-bottom:14px;color:#475569;font-size:14px;">Payment</td><td align="right" style="padding-top:8px;padding-bottom:14px;color:#16a34a;font-size:14px;font-weight:700;">Paid via Paystack</td></tr>
                  </table>
                </td></tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:18px;background:#f8fafc;border-radius:12px;">
                <tr><td style="padding:18px 18px 6px;color:#0f172a;font-size:16px;font-weight:700;">Items Ordered</td></tr>
                <tr><td style="padding:0 18px 12px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${itemsHtml}</table>
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:10px;border-top:1px solid #dbe3ea;">
                    <tr><td style="padding-top:10px;color:#0f172a;font-size:16px;font-weight:700;">Total</td><td align="right" style="padding-top:10px;color:#0f172a;font-size:16px;font-weight:700;">R${totalAmount}</td></tr>
                  </table>
                </td></tr>
              </table>

              ${
                order.addressInfo
                  ? `
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top:18px;background:#f8fafc;border-radius:12px;">
                <tr><td style="padding:18px 18px 8px;color:#0f172a;font-size:16px;font-weight:700;">Shipping Address</td></tr>
                <tr><td style="padding:0 18px 18px;color:#475569;font-size:14px;line-height:1.6;">
                  ${escapeHtml(order.addressInfo.address || "")}<br/>
                  ${escapeHtml(order.addressInfo.city || "")}${order.addressInfo.pincode ? `, ${escapeHtml(order.addressInfo.pincode)}` : ""}<br/>
                  ${order.addressInfo.phone ? `Phone: ${escapeHtml(order.addressInfo.phone)}` : ""}
                </td></tr>
              </table>`
                  : ""
              }
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:20px 24px 26px;background:#f8fafc;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#64748b;font-size:12px;">Questions? Contact us at <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#124e66;text-decoration:none;">${escapeHtml(SUPPORT_EMAIL)}</a></p>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">&copy; ${new Date().getFullYear()} Hygiene Hub Skincare</p>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">Confidence in Every Glow</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `Your Hygiene Hub Order Confirmation #${shortOrderId}`,
      html,
    });

    if (error) {
      console.error("Resend email error:", error);
      return { success: false, error };
    }

    console.log(`Order confirmation email sent to ${toEmail}, id: ${data.id}`);
    return { success: true, emailId: data.id };
  } catch (err) {
    console.error("Failed to send order confirmation email:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send contact form message to the support inbox.
 * Also sends an auto-reply to the customer.
 */
async function sendContactMessage({ name, email, subject, message }) {
  try {
    const notifyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f7f7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white;">
    <div style="background: linear-gradient(135deg, #2d5016 0%, #4a7c28 100%); padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 22px;">New Contact Message</h1>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">Hygiene Hub - Contact Form</p>
    </div>
    <div style="padding: 32px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #666; width: 100px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${name}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0; font-weight: 600;"><a href="mailto:${email}" style="color: #2d5016;">${email}</a></td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Subject</td><td style="padding: 8px 0; font-weight: 600;">${subject || "(no subject)"}</td></tr>
      </table>
      <div style="margin-top: 20px; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #2d5016;">
        <p style="margin: 0; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${message}</p>
      </div>
      <p style="margin-top: 16px; font-size: 12px; color: #999;">Received: ${new Date().toLocaleString("en-ZA")}</p>
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: SUPPORT_EMAIL,
      subject: `[Contact] ${subject || "New message"} - from ${name}`,
      html: notifyHtml,
      reply_to: email,
    });

    const autoReplyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f7f7; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white;">
    <div style="background: linear-gradient(135deg, #2d5016 0%, #4a7c28 100%); padding: 32px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">Hygiene Hub</h1>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">We got your message!</p>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 16px; color: #1a1a1a;">Hi ${name},</p>
      <p style="color: #555; line-height: 1.7;">Thanks for reaching out. We've received your message and will get back to you as soon as possible, usually within 24 hours.</p>
      <div style="margin: 24px 0; padding: 20px; background: #f9fafb; border-radius: 8px;">
        <p style="margin: 0 0 8px; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Your message</p>
        <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.7; white-space: pre-wrap;">${message}</p>
      </div>
      <p style="color: #555; font-size: 14px;">In the meantime, you can browse our <a href="${STORE_URL}/shop" style="color: #2d5016;">shop</a> or check our <a href="${STORE_URL}/faq" style="color: #2d5016;">FAQ</a>.</p>
      <p style="color: #555; font-size: 14px; margin-top: 24px;">With love,<br/><strong>The Hygiene Hub Team</strong></p>
    </div>
    <div style="padding: 20px 32px; background: #f9fafb; text-align: center; border-top: 1px solid #eee;">
      <p style="margin: 0; color: #999; font-size: 12px;">&copy; ${new Date().getFullYear()} Hygiene Hub. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "We received your message - Hygiene Hub",
      html: autoReplyHtml,
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to send contact email:", err);
    return { success: false, error: err.message };
  }
}

module.exports = { sendOrderConfirmation, sendContactMessage };
