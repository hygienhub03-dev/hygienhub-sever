const express = require("express");
const {
  registerUser,
  loginUser,
  verifyMfaLogin,
  getMfaStatus,
  startMfaSetup,
  verifyMfaSetup,
  disableMfa,
  regenerateMfaRecoveryCodes,
  logoutUser,
  authMiddleware,
  adminOnly,
} = require("../../controllers/auth/auth-controller");
const { validate } = require("../../validation/validate");
const {
  registerSchema,
  loginSchema,
  mfaVerifyLoginSchema,
  mfaSetupStartSchema,
  mfaSetupVerifySchema,
} = require("../../validation/schemas");

const router = express.Router();

router.post("/register", validate(registerSchema), registerUser);
router.post("/login", validate(loginSchema), loginUser);
router.post("/mfa/verify-login", validate(mfaVerifyLoginSchema), verifyMfaLogin);
router.get("/mfa/status", authMiddleware, getMfaStatus);
router.post("/mfa/setup/start", authMiddleware, validate(mfaSetupStartSchema), startMfaSetup);
router.post("/mfa/setup/verify", authMiddleware, validate(mfaSetupVerifySchema), verifyMfaSetup);
router.post("/mfa/disable", authMiddleware, disableMfa);
router.post("/mfa/recovery-codes/regenerate", authMiddleware, regenerateMfaRecoveryCodes);
router.post("/logout", logoutUser);
router.get("/check-auth", authMiddleware, adminOnly, (req, res) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    message: "Authenticated user!",
    user,
  });
});

module.exports = router;
