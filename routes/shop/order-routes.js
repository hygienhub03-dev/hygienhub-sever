const express = require("express");
const { authMiddleware } = require("../../controllers/auth/auth-controller");
const { validate } = require("../../validation/validate");
const {
  createOrderSchema,
  capturePaymentSchema,
  listOrdersParamsSchema,
  orderDetailsParamsSchema,
} = require("../../validation/schemas");

const {
  createOrder,
  getAllOrdersByUser,
  getOrderDetails,
  capturePayment,
  paystackWebhook,
} = require("../../controllers/shop/order-controller");

const router = express.Router();

router.post("/create", validate(createOrderSchema), createOrder);
router.post("/capture", validate(capturePaymentSchema), capturePayment);
router.post("/webhook/paystack", paystackWebhook);
router.get("/list/:userId", authMiddleware, validate(listOrdersParamsSchema, "params"), getAllOrdersByUser);
// Public — anyone with the order ID can look up their order (no auth required)
router.get("/details/:id", validate(orderDetailsParamsSchema, "params"), getOrderDetails);

module.exports = router;
