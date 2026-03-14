const { z } = require("zod");

const idSchema = z.string().min(3).max(128);
const optionalText = z.string().trim().min(1).max(200).optional();

const addressSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    address: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    pincode: z.string().trim().min(1).max(20),
    phone: z.string().trim().min(6).max(25).optional(),
  })
  .partial()
  .optional();

const cartItemSchema = z
  .object({
    productId: z.string().trim().min(1).max(128),
    title: optionalText,
    name: optionalText,
    image: z.string().trim().max(500).optional(),
    quantity: z.number().int().min(1).max(200),
    price: z.number().positive().max(1000000),
  })
  .strict();

const registerSchema = z
  .object({
    userName: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(128),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(128),
  })
  .strict();

const mfaVerifyLoginSchema = z
  .object({
    otp: z.string().trim().regex(/^\d{6,8}$/, "OTP must be 6-8 digits"),
  })
  .strict();

const mfaSetupStartSchema = z
  .object({
    password: z.string().min(8).max(128),
  })
  .strict();

const mfaSetupVerifySchema = z
  .object({
    otp: z.string().trim().regex(/^\d{6,8}$/, "OTP must be 6-8 digits"),
  })
  .strict();

const createOrderSchema = z
  .object({
    userId: z.string().trim().max(128).optional(),
    cartItems: z.array(cartItemSchema).min(1),
    addressInfo: addressSchema,
    orderStatus: z.string().trim().max(40).optional(),
    paymentMethod: z.string().trim().max(40).optional(),
    paymentStatus: z.string().trim().max(40).optional(),
    totalAmount: z.number().positive().max(1000000000),
    orderDate: z.string().datetime().optional(),
    orderUpdateDate: z.string().datetime().optional(),
    cartId: z.string().trim().max(128).optional(),
    email: z.string().trim().email().max(200),
  })
  .strict();

const capturePaymentSchema = z
  .object({
    reference: z.string().trim().min(5).max(200),
    orderId: idSchema,
    email: z.string().trim().email().max(200).optional(),
  })
  .strict();

const listOrdersParamsSchema = z
  .object({
    userId: idSchema,
  })
  .strict();

const orderDetailsParamsSchema = z
  .object({
    id: idSchema,
  })
  .strict();

const contactMessageSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(200),
    subject: z.string().trim().max(160).optional(),
    message: z.string().trim().min(1).max(5000),
  })
  .strict();

const paystackWebhookEventSchema = z
  .object({
    event: z.string().trim(),
    data: z
      .object({
        reference: z.string().trim().min(5),
        amount: z.number(),
        currency: z.string().trim().min(3).max(3),
        customer: z.object({ email: z.string().trim().email().optional() }).partial().optional(),
        metadata: z
          .object({
            orderId: z.string().trim().optional(),
            custom_fields: z.record(z.any()).optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
  })
  .strict();

module.exports = {
  registerSchema,
  loginSchema,
  mfaVerifyLoginSchema,
  mfaSetupStartSchema,
  mfaSetupVerifySchema,
  createOrderSchema,
  capturePaymentSchema,
  listOrdersParamsSchema,
  orderDetailsParamsSchema,
  contactMessageSchema,
  paystackWebhookEventSchema,
};
