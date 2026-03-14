const express = require("express");
const { authMiddleware, adminOnly } = require("../../controllers/auth/auth-controller");

const {
  fetchAllCustomers,
  fetchCustomerOrders,
} = require("../../controllers/admin/customers-controller");

const router = express.Router();
router.use(authMiddleware, adminOnly);

router.get("/get", fetchAllCustomers);
router.get("/:userId/orders", fetchCustomerOrders);

module.exports = router;
