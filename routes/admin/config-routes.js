const express = require("express");
const { authMiddleware, adminOnly } = require("../../controllers/auth/auth-controller");
const {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  getSecurity2FA,
  updateSecurity2FA,
  getAuditLogs,
  appendAuditLog,
  clearAuditLogs,
} = require("../../controllers/admin/admin-config-controller");

const router = express.Router();
router.use(authMiddleware, adminOnly);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);

router.get("/settings", getSettings);
router.put("/settings", updateSettings);

router.get("/security-2fa", getSecurity2FA);
router.put("/security-2fa", updateSecurity2FA);

router.get("/audit-logs", getAuditLogs);
router.post("/audit-logs", appendAuditLog);
router.delete("/audit-logs", clearAuditLogs);

module.exports = router;
