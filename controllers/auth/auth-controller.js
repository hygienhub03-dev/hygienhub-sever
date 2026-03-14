const jwt = require("jsonwebtoken");
const { Client, Account, Query } = require("node-appwrite");
const { createUsersClient, ID } = require("../../helpers/appwrite");

const JWT_SECRET = process.env.JWT_SECRET;
const IS_PROD = process.env.NODE_ENV === "production";
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://nyc.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || "69a6c56c002ced051526";

const MFA_PENDING_COOKIE = "mfa_pending";
const MFA_SETUP_COOKIE = "mfa_setup";

function assertJwtSecret() {
  if (!JWT_SECRET) throw new Error("JWT_SECRET is required");
}

function getSameSiteValue() {
  const configuredSameSite = (process.env.COOKIE_SAME_SITE || "lax").toLowerCase();
  if (configuredSameSite === "none") return "none";
  if (configuredSameSite === "strict") return "strict";
  return "lax";
}

function getCookieOptions() {
  const sameSite = getSameSiteValue();
  const secure = sameSite === "none" ? true : IS_PROD;
  const maxAgeMs = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 1000 * 60 * 60);

  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path: "/",
  };
}

function getTransientCookieOptions(path, maxAgeMs = 1000 * 60 * 10) {
  const sameSite = getSameSiteValue();
  const secure = sameSite === "none" ? true : IS_PROD;
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: maxAgeMs,
    path,
  };
}

function clearTransientCookie(res, name, path) {
  const sameSite = getSameSiteValue();
  const secure = sameSite === "none" ? true : IS_PROD;
  res.clearCookie(name, {
    httpOnly: true,
    secure,
    sameSite,
    path,
  });
}

function createAccountClient() {
  return new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
}

function createAccountWithSession(sessionSecret) {
  const client = createAccountClient().setSession(String(sessionSecret));
  return new Account(client);
}

function signAppToken(user) {
  assertJwtSecret();
  return jwt.sign(
    {
      id: user.$id,
      role: user.prefs?.role || "user",
      email: user.email,
      userName: user.name,
    },
    JWT_SECRET,
    { expiresIn: "60m" }
  );
}

function signTransientToken(payload, expiresIn = "10m") {
  assertJwtSecret();
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyTransientToken(tokenValue) {
  try {
    assertJwtSecret();
    return jwt.verify(tokenValue, JWT_SECRET);
  } catch {
    return null;
  }
}

async function syncSecurityPrefs(userId, updater) {
  const users = createUsersClient();
  const user = await users.get(String(userId));
  const prevPrefs = user.prefs || {};
  const nextSecurity = updater(prevPrefs.security2fa || {});
  await users.updatePrefs(String(userId), {
    ...prevPrefs,
    role: prevPrefs.role || "user",
    security2fa: nextSecurity,
  });
  return nextSecurity;
}

function buildSecurity2faState(user, recoveryCodes = null) {
  const prefsState = user.prefs?.security2fa || {};
  const enabled = Boolean(user.mfa || prefsState.enabled);
  return {
    enabled,
    enabledAt: prefsState.enabledAt || (enabled ? new Date().toISOString() : undefined),
    method: "authenticator",
    recoveryCodes: Array.isArray(recoveryCodes)
      ? recoveryCodes
      : Array.isArray(prefsState.recoveryCodes)
        ? prefsState.recoveryCodes
        : [],
  };
}

const registerUser = async (req, res) => {
  const { userName, email, password } = req.body;
  try {
    const users = createUsersClient();
    const existing = await users.list([Query.equal("email", email)]).catch(() => ({ total: 0 }));
    if (existing.total > 0) {
      return res.json({ success: false, message: "User already exists with this email!" });
    }

    const newUser = await users.create(ID.unique(), email, undefined, password, userName);
    await users.updatePrefs(newUser.$id, { role: "user" });
    return res.status(200).json({ success: true, message: "Registration successful" });
  } catch (e) {
    console.error("registerUser error:", e);
    if (e.code === 409) {
      return res.json({ success: false, message: "User already exists with this email!" });
    }
    return res.status(500).json({ success: false, message: e.message || "Registration failed" });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    assertJwtSecret();
    const users = createUsersClient();
    const account = new Account(createAccountClient());
    const passwordSession = await account.createEmailPasswordSession({ email, password });
    const user = await users.get(passwordSession.userId);
    const role = user.prefs?.role || "user";
    const mfaEnabled = Boolean(user.mfa || user.prefs?.security2fa?.enabled);

    if (mfaEnabled) {
      try {
        await users.deleteSession(user.$id, passwordSession.$id);
      } catch {
        // Best effort cleanup of password verification session.
      }

      const elevatedSession = await users.createSession(user.$id);
      const mfaAccount = createAccountWithSession(elevatedSession.secret);
      const challenge = await mfaAccount.createMFAChallenge({ factor: "totp" });

      const pending = signTransientToken({
        type: "mfa_pending",
        uid: user.$id,
        challengeId: challenge.$id,
        sessionId: elevatedSession.$id,
        sessionSecret: elevatedSession.secret,
      });

      clearTransientCookie(res, MFA_SETUP_COOKIE, "/api/auth/mfa/setup");
      res.cookie(MFA_PENDING_COOKIE, pending, getTransientCookieOptions("/api/auth/mfa"));
      return res.status(200).json({
        success: true,
        mfaRequired: true,
        message: "Multi-factor authentication required",
      });
    }

    const token = signAppToken(user);
    clearTransientCookie(res, MFA_PENDING_COOKIE, "/api/auth/mfa");
    clearTransientCookie(res, MFA_SETUP_COOKIE, "/api/auth/mfa/setup");
    res.cookie("token", token, getCookieOptions());
    if (setupSession.$id !== passwordSession.$id) {
      try {
        await users.deleteSession(user.$id, passwordSession.$id);
      } catch {
        // Best effort cleanup of password verification session.
      }
    }
    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: { email: user.email, role, id: user.$id, userName: user.name },
    });
  } catch (e) {
    console.error("loginUser error:", e);
    if (e.code === 401) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password! Please try again.",
      });
    }
    return res.status(500).json({ success: false, message: e.message || "Login failed" });
  }
};

const verifyMfaLogin = async (req, res) => {
  const { otp } = req.body;
  const tokenValue = req.cookies?.[MFA_PENDING_COOKIE];
  if (!tokenValue) {
    return res.status(401).json({ success: false, message: "MFA session expired. Please sign in again." });
  }

  const pending = verifyTransientToken(tokenValue);
  if (!pending || pending.type !== "mfa_pending") {
    clearTransientCookie(res, MFA_PENDING_COOKIE, "/api/auth/mfa");
    return res.status(401).json({ success: false, message: "Invalid MFA session. Please sign in again." });
  }

  try {
    const users = createUsersClient();
    const mfaAccount = createAccountWithSession(pending.sessionSecret);
    await mfaAccount.updateMFAChallenge({ challengeId: pending.challengeId, otp });

    try {
      await users.deleteSession(pending.uid, pending.sessionId);
    } catch {
      // Best effort cleanup of temporary Appwrite session.
    }

    const user = await users.get(String(pending.uid));
    const token = signAppToken(user);
    clearTransientCookie(res, MFA_PENDING_COOKIE, "/api/auth/mfa");
    res.cookie("token", token, getCookieOptions());
    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      user: {
        email: user.email,
        role: user.prefs?.role || "user",
        id: user.$id,
        userName: user.name,
      },
    });
  } catch (e) {
    console.error("verifyMfaLogin error:", e);
    if (e.code === 401) {
      return res.status(401).json({ success: false, message: "Invalid verification code." });
    }
    return res.status(500).json({ success: false, message: e.message || "MFA verification failed" });
  }
};

const getMfaStatus = async (req, res) => {
  try {
    const users = createUsersClient();
    const user = await users.get(String(req.user.id));
    return res.status(200).json({ success: true, data: buildSecurity2faState(user) });
  } catch (e) {
    console.error("getMfaStatus error:", e);
    return res.status(500).json({ success: false, message: "Failed to load MFA status" });
  }
};

const startMfaSetup = async (req, res) => {
  const { password } = req.body;
  try {
    const users = createUsersClient();
    const user = await users.get(String(req.user.id));
    const account = new Account(createAccountClient());
    const passwordSession = await account.createEmailPasswordSession({
      email: user.email,
      password,
    });

    const setupSession = passwordSession.secret
      ? passwordSession
      : await users.createSession(user.$id);
    const mfaAccount = createAccountWithSession(setupSession.secret);
    const authenticator = await mfaAccount.createMFAAuthenticator({ type: "totp" });

    const setupToken = signTransientToken({
      type: "mfa_setup",
      uid: user.$id,
      sessionId: setupSession.$id,
      sessionSecret: setupSession.secret,
    });

    res.cookie(MFA_SETUP_COOKIE, setupToken, getTransientCookieOptions("/api/auth/mfa/setup"));
    try {
      await users.deleteSession(user.$id, passwordSession.$id);
    } catch {
      // Best effort cleanup of password verification session.
    }
    return res.status(200).json({
      success: true,
      data: {
        secret: authenticator.secret,
        uri: authenticator.uri,
      },
    });
  } catch (e) {
    console.error("startMfaSetup error:", e);
    if (e.code === 401) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }
    return res.status(500).json({ success: false, message: e.message || "Failed to start MFA setup" });
  }
};

const verifyMfaSetup = async (req, res) => {
  const { otp } = req.body;
  const setupCookie = req.cookies?.[MFA_SETUP_COOKIE];
  if (!setupCookie) {
    return res.status(401).json({ success: false, message: "MFA setup session expired. Start setup again." });
  }

  const setup = verifyTransientToken(setupCookie);
  if (!setup || setup.type !== "mfa_setup" || String(setup.uid) !== String(req.user.id)) {
    clearTransientCookie(res, MFA_SETUP_COOKIE, "/api/auth/mfa/setup");
    return res.status(401).json({ success: false, message: "Invalid MFA setup session. Start setup again." });
  }

  try {
    const users = createUsersClient();
    const mfaAccount = createAccountWithSession(setup.sessionSecret);
    await mfaAccount.updateMFAAuthenticator({ type: "totp", otp });
    await mfaAccount.updateMFA({ mfa: true });
    const recovery = await mfaAccount.createMFARecoveryCodes();

    await syncSecurityPrefs(setup.uid, () => ({
      enabled: true,
      enabledAt: new Date().toISOString(),
      method: "authenticator",
      recoveryCodes: recovery.recoveryCodes || [],
    }));

    try {
      await users.deleteSession(setup.uid, setup.sessionId);
    } catch {
      // Best effort cleanup of setup session.
    }

    clearTransientCookie(res, MFA_SETUP_COOKIE, "/api/auth/mfa/setup");
    return res.status(200).json({
      success: true,
      message: "MFA enabled",
      data: {
        recoveryCodes: recovery.recoveryCodes || [],
      },
    });
  } catch (e) {
    console.error("verifyMfaSetup error:", e);
    if (e.code === 401) {
      return res.status(401).json({ success: false, message: "Invalid verification code." });
    }
    return res.status(500).json({ success: false, message: e.message || "Failed to verify MFA setup" });
  }
};

const disableMfa = async (req, res) => {
  try {
    const users = createUsersClient();
    const userId = String(req.user.id);
    await users.updateMFA({ userId, mfa: false });
    try {
      await users.deleteMFAAuthenticator({ userId, type: "totp" });
    } catch {
      // If authenticator doesn't exist, continue.
    }

    await syncSecurityPrefs(userId, () => ({
      enabled: false,
      enabledAt: undefined,
      method: "authenticator",
      recoveryCodes: [],
    }));

    return res.status(200).json({ success: true, message: "MFA disabled" });
  } catch (e) {
    console.error("disableMfa error:", e);
    return res.status(500).json({ success: false, message: e.message || "Failed to disable MFA" });
  }
};

const regenerateMfaRecoveryCodes = async (req, res) => {
  try {
    const users = createUsersClient();
    const userId = String(req.user.id);
    const recovery = await users.updateMFARecoveryCodes({ userId });
    await syncSecurityPrefs(userId, (prev) => ({
      ...prev,
      enabled: true,
      method: "authenticator",
      recoveryCodes: recovery.recoveryCodes || [],
    }));
    return res.status(200).json({
      success: true,
      data: { recoveryCodes: recovery.recoveryCodes || [] },
    });
  } catch (e) {
    console.error("regenerateMfaRecoveryCodes error:", e);
    return res.status(500).json({
      success: false,
      message: e.message || "Failed to regenerate recovery codes",
    });
  }
};

const logoutUser = (req, res) => {
  clearTransientCookie(res, MFA_PENDING_COOKIE, "/api/auth/mfa");
  clearTransientCookie(res, MFA_SETUP_COOKIE, "/api/auth/mfa/setup");
  res.clearCookie("token", { ...getCookieOptions(), maxAge: undefined }).json({
    success: true,
    message: "Logged out successfully!",
  });
};

const authMiddleware = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ success: false, message: "Unauthorised user!" });
  try {
    assertJwtSecret();
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorised user!" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Not authorised" });
  }
  return next();
};

module.exports = {
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
};
