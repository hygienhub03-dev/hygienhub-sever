const crypto = require("crypto");
const { initializeTransaction, verifyTransaction } = require("../../helpers/paystack");
const { sendOrderConfirmation } = require("../../helpers/resend");
const { createAppwriteClient, DATABASE_ID, COLLECTIONS, ID, Query } = require("../../helpers/appwrite");
const { paystackWebhookEventSchema } = require("../../validation/schemas");

function toOrderTotalInMinorUnits(totalAmount) {
  return Math.round(Number(totalAmount || 0) * 100);
}

function isAdmin(user) {
  return user?.role === "admin";
}

function assertCanAccessOrder(reqUser, orderUserId) {
  if (!reqUser) return false;
  return isAdmin(reqUser) || String(reqUser.id) === String(orderUserId);
}

async function finalizePaidOrder(db, order, reference, verificationEmail) {
  const updatedOrder = await db.updateDocument(DATABASE_ID, COLLECTIONS.orders, order.$id, {
    paymentStatus: "paid",
    orderStatus: "confirmed",
    paymentId: reference,
    payerId: verificationEmail || "",
    orderUpdateDate: new Date().toISOString(),
  });

  const cartItems = JSON.parse(order.cartItems || "[]");
  if (cartItems.length) {
    await Promise.all(
      cartItems.map(async (item) => {
        try {
          const product = await db.getDocument(DATABASE_ID, COLLECTIONS.products, item.productId);
          const qty = Number(item.quantity) || 0;
          await db.updateDocument(DATABASE_ID, COLLECTIONS.products, item.productId, {
            totalStock: Math.max(0, (product.totalStock || 0) - qty),
          });
        } catch (err) {
          console.warn(`Stock update skipped for product ${item.productId}:`, err.message);
        }
      })
    );
  }

  return { updatedOrder, cartItems };
}

const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartItems,
      addressInfo,
      orderStatus,
      paymentMethod,
      paymentStatus,
      totalAmount,
      orderDate,
      orderUpdateDate,
      cartId,
      email,
    } = req.body;

    const db = createAppwriteClient();
    const normalizedTotalAmount = Number(totalAmount || 0);

    if (!email || !Array.isArray(cartItems) || cartItems.length === 0 || normalizedTotalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid order payload" });
    }

    const order = await db.createDocument(DATABASE_ID, COLLECTIONS.orders, ID.unique(), {
      userId,
      cartId: cartId || "",
      cartItems: JSON.stringify(cartItems || []),
      addressInfo: JSON.stringify(addressInfo || {}),
      orderStatus: orderStatus || "pending",
      paymentMethod: paymentMethod || "paystack",
      paymentStatus: paymentStatus || "pending",
      totalAmount: normalizedTotalAmount,
      orderDate: orderDate || new Date().toISOString(),
      orderUpdateDate: orderUpdateDate || new Date().toISOString(),
      paymentId: "",
      payerId: "",
    });

    const amountInCents = toOrderTotalInMinorUnits(normalizedTotalAmount);
    const callbackUrl = `${(process.env.CLIENT_URL || "http://localhost:5173").split(",")[0]}/paystack-return?orderId=${order.$id}`;

    const paystackResult = await initializeTransaction(email, amountInCents, callbackUrl, {
      orderId: order.$id,
      cartId,
    });

    await db.updateDocument(DATABASE_ID, COLLECTIONS.orders, order.$id, {
      paymentId: paystackResult.reference,
    });

    res.status(201).json({
      success: true,
      paymentURL: paystackResult.authorization_url,
      reference: paystackResult.reference,
      orderId: order.$id,
    });
  } catch (e) {
    console.error("createOrder error:", e);
    res.status(500).json({
      success: false,
      message: "Error creating order: " + (e.message || "Unknown error"),
    });
  }
};

const capturePayment = async (req, res) => {
  try {
    const { reference, orderId } = req.body;
    if (!reference || !orderId) {
      return res.status(400).json({ success: false, message: "reference and orderId are required" });
    }

    const db = createAppwriteClient();
    const order = await db.getDocument(DATABASE_ID, COLLECTIONS.orders, orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const verification = await verifyTransaction(reference);
    const verificationEmail = verification.customer?.email || "";
    const expectedAmount = toOrderTotalInMinorUnits(order.totalAmount);
    const metadataOrderId = verification.metadata?.orderId || verification.metadata?.custom_fields?.orderId;

    if (verification.reference !== reference || order.paymentId !== reference) {
      return res.status(400).json({ success: false, message: "Payment reference mismatch" });
    }

    if (Number(verification.amount) !== expectedAmount) {
      return res.status(400).json({ success: false, message: "Payment amount mismatch" });
    }

    if (String((verification.currency || "").toUpperCase()) !== "ZAR") {
      return res.status(400).json({ success: false, message: "Payment currency mismatch" });
    }

    if (metadataOrderId && String(metadataOrderId) !== String(order.$id)) {
      return res.status(400).json({ success: false, message: "Payment metadata mismatch" });
    }

    if (verification.status !== "success") {
      await db.updateDocument(DATABASE_ID, COLLECTIONS.orders, orderId, {
        paymentStatus: "failed",
        orderStatus: "rejected",
      });

      return res.status(400).json({
        success: false,
        message: `Payment not successful. Status: ${verification.status}`,
      });
    }

    if (order.paymentStatus === "paid" && order.orderStatus === "confirmed") {
      return res.status(200).json({
        success: true,
        message: "Payment already captured",
        data: {
          ...order,
          _id: order.$id,
          cartItems: JSON.parse(order.cartItems || "[]"),
          addressInfo: JSON.parse(order.addressInfo || "{}"),
        },
      });
    }

    const { updatedOrder, cartItems } = await finalizePaidOrder(db, order, reference, verificationEmail);

    const customerEmail = verificationEmail || req.body.email || "";
    const parsedAddress = JSON.parse(order.addressInfo || "{}");
    if (customerEmail) {
      sendOrderConfirmation(customerEmail, {
        $id: updatedOrder.$id,
        _id: updatedOrder.$id,
        orderDate: updatedOrder.orderDate,
        totalAmount: updatedOrder.totalAmount,
        paymentMethod: updatedOrder.paymentMethod,
        cartItems,
        addressInfo: parsedAddress,
      }).catch((err) => console.error("Confirmation email failed:", err));
    }

    res.status(200).json({
      success: true,
      message: "Payment verified and order confirmed",
      data: {
        ...updatedOrder,
        _id: updatedOrder.$id,
        cartItems,
        addressInfo: parsedAddress,
      },
    });
  } catch (e) {
    console.error("capturePayment error:", e);
    res.status(500).json({
      success: false,
      message: "Error verifying payment: " + (e.message || "Unknown error"),
    });
  }
};

const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!assertCanAccessOrder(req.user, userId)) {
      return res.status(403).json({ success: false, message: "Not authorised to view these orders" });
    }

    const db = createAppwriteClient();
    const result = await db.listDocuments(DATABASE_ID, COLLECTIONS.orders, [
      Query.equal("userId", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);

    const orders = result.documents.map((o) => ({
      ...o,
      _id: o.$id,
      cartItems: JSON.parse(o.cartItems || "[]"),
      addressInfo: JSON.parse(o.addressInfo || "{}"),
    }));

    res.status(200).json({ success: true, data: orders });
  } catch (e) {
    console.error("getAllOrdersByUser error:", e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const db = createAppwriteClient();

    const o = await db.getDocument(DATABASE_ID, COLLECTIONS.orders, id);
    // Route is public — anyone with the order ID can view it (like a tracking link)
    // If user is authenticated, additionally verify ownership for extra safety
    if (req.user && !assertCanAccessOrder(req.user, o.userId)) {
      return res.status(403).json({ success: false, message: "Not authorised to view this order" });
    }

    res.status(200).json({
      success: true,
      data: {
        ...o,
        _id: o.$id,
        cartItems: JSON.parse(o.cartItems || "[]"),
        addressInfo: JSON.parse(o.addressInfo || "{}"),
      },
    });
  } catch (e) {
    console.error("getOrderDetails error:", e);
    res.status(500).json({ success: false, message: "Order not found!" });
  }
};

const paystackWebhook = async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY || "";
    if (!secret) return res.status(500).json({ success: false, message: "Webhook secret missing" });

    const signature = req.headers["x-paystack-signature"];
    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const digest = crypto.createHmac("sha512", secret).update(bodyBuffer).digest("hex");
    const isValidSignature =
      typeof signature === "string" &&
      signature.length === digest.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));

    if (!isValidSignature) {
      return res.status(401).json({ success: false, message: "Invalid webhook signature" });
    }

    let payload;
    try {
      payload = JSON.parse(bodyBuffer.toString("utf8"));
    } catch {
      return res.status(400).json({ success: false, message: "Invalid webhook JSON" });
    }

    const parsedWebhook = paystackWebhookEventSchema.safeParse(payload);
    if (!parsedWebhook.success) {
      return res.status(400).json({ success: false, message: "Invalid webhook payload" });
    }

    payload = parsedWebhook.data;
    if (payload?.event !== "charge.success") {
      return res.status(200).json({ success: true, ignored: true });
    }

    const data = payload.data || {};
    const reference = data.reference;
    const metadataOrderId = data.metadata?.orderId || data.metadata?.custom_fields?.orderId;
    if (!reference || !metadataOrderId) {
      return res.status(400).json({ success: false, message: "Invalid webhook payload" });
    }

    const db = createAppwriteClient();
    const order = await db.getDocument(DATABASE_ID, COLLECTIONS.orders, metadataOrderId);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const expectedAmount = toOrderTotalInMinorUnits(order.totalAmount);
    const verificationEmail = data.customer?.email || "";

    if (data.reference !== order.paymentId) return res.status(400).json({ success: false, message: "Reference mismatch" });
    if (Number(data.amount) !== expectedAmount) return res.status(400).json({ success: false, message: "Amount mismatch" });
    if (String((data.currency || "").toUpperCase()) !== "ZAR") return res.status(400).json({ success: false, message: "Currency mismatch" });

    if (order.paymentStatus !== "paid" || order.orderStatus !== "confirmed") {
      const { cartItems } = await finalizePaidOrder(db, order, reference, verificationEmail);
      const parsedAddress = JSON.parse(order.addressInfo || "{}");
      if (verificationEmail) {
        sendOrderConfirmation(verificationEmail, {
          $id: order.$id,
          _id: order.$id,
          orderDate: order.orderDate,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          cartItems,
          addressInfo: parsedAddress,
        }).catch((err) => console.error("Confirmation email failed (webhook):", err));
      }
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("paystackWebhook error:", e);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};

module.exports = { createOrder, capturePayment, getAllOrdersByUser, getOrderDetails, paystackWebhook };
