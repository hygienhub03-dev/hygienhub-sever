const { createUsersClient } = require("../../helpers/appwrite");

function sanitizeString(value, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

async function getCurrentUser(users, userId) {
  return users.get(String(userId));
}

const getProfile = async (req, res) => {
  try {
    const users = createUsersClient();
    const user = await getCurrentUser(users, req.user.id);
    return res.status(200).json({
      success: true,
      data: {
        fullName: user.name || "",
        email: user.email || "",
        title: user.prefs?.profileTitle || "",
        timezone: user.prefs?.profileTimezone || "",
      },
    });
  } catch (e) {
    console.error("getProfile error:", e);
    return res.status(500).json({ success: false, message: "Failed to load profile" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const users = createUsersClient();
    const userId = String(req.user.id);
    const user = await getCurrentUser(users, userId);
    const fullName = sanitizeString(req.body?.fullName, 120);
    const title = sanitizeString(req.body?.title, 120);
    const timezone = sanitizeString(req.body?.timezone, 120);

    if (!fullName) return res.status(400).json({ success: false, message: "fullName is required" });

    await users.updateName(userId, fullName);
    await users.updatePrefs(userId, {
      ...(user.prefs || {}),
      role: user.prefs?.role || "user",
      profileTitle: title,
      profileTimezone: timezone,
    });

    return res.status(200).json({ success: true, message: "Profile updated" });
  } catch (e) {
    console.error("updateProfile error:", e);
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

const getSettings = async (req, res) => {
  try {
    const users = createUsersClient();
    const user = await getCurrentUser(users, req.user.id);
    return res.status(200).json({
      success: true,
      data: user.prefs?.adminSettings || null,
    });
  } catch (e) {
    console.error("getSettings error:", e);
    return res.status(500).json({ success: false, message: "Failed to load settings" });
  }
};

const updateSettings = async (req, res) => {
  try {
    const users = createUsersClient();
    const userId = String(req.user.id);
    const user = await getCurrentUser(users, userId);
    const adminSettings = req.body?.adminSettings;
    if (!adminSettings || typeof adminSettings !== "object") {
      return res.status(400).json({ success: false, message: "adminSettings payload is required" });
    }

    await users.updatePrefs(userId, {
      ...(user.prefs || {}),
      role: user.prefs?.role || "user",
      adminSettings,
    });

    return res.status(200).json({ success: true, message: "Settings updated" });
  } catch (e) {
    console.error("updateSettings error:", e);
    return res.status(500).json({ success: false, message: "Failed to update settings" });
  }
};

const getSecurity2FA = async (req, res) => {
  try {
    const users = createUsersClient();
    const user = await getCurrentUser(users, req.user.id);
    return res.status(200).json({
      success: true,
      data: user.prefs?.security2fa || null,
    });
  } catch (e) {
    console.error("getSecurity2FA error:", e);
    return res.status(500).json({ success: false, message: "Failed to load 2FA settings" });
  }
};

const updateSecurity2FA = async (req, res) => {
  try {
    const users = createUsersClient();
    const userId = String(req.user.id);
    const user = await getCurrentUser(users, userId);
    const security2fa = req.body?.security2fa;
    if (!security2fa || typeof security2fa !== "object") {
      return res.status(400).json({ success: false, message: "security2fa payload is required" });
    }

    await users.updatePrefs(userId, {
      ...(user.prefs || {}),
      role: user.prefs?.role || "user",
      security2fa,
    });

    return res.status(200).json({ success: true, message: "2FA settings updated" });
  } catch (e) {
    console.error("updateSecurity2FA error:", e);
    return res.status(500).json({ success: false, message: "Failed to update 2FA settings" });
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const users = createUsersClient();
    const user = await getCurrentUser(users, req.user.id);
    const logs = Array.isArray(user.prefs?.adminAuditLogs) ? user.prefs.adminAuditLogs : [];
    return res.status(200).json({ success: true, data: logs });
  } catch (e) {
    console.error("getAuditLogs error:", e);
    return res.status(500).json({ success: false, message: "Failed to load audit logs" });
  }
};

const appendAuditLog = async (req, res) => {
  try {
    const users = createUsersClient();
    const userId = String(req.user.id);
    const user = await getCurrentUser(users, userId);
    const entry = req.body?.entry;
    if (!entry || typeof entry !== "object") {
      return res.status(400).json({ success: false, message: "entry payload is required" });
    }

    const logs = Array.isArray(user.prefs?.adminAuditLogs) ? user.prefs.adminAuditLogs : [];
    const nextLogs = [entry, ...logs].slice(0, 300);

    await users.updatePrefs(userId, {
      ...(user.prefs || {}),
      role: user.prefs?.role || "user",
      adminAuditLogs: nextLogs,
    });

    return res.status(200).json({ success: true, message: "Audit log recorded" });
  } catch (e) {
    console.error("appendAuditLog error:", e);
    return res.status(500).json({ success: false, message: "Failed to record audit log" });
  }
};

const clearAuditLogs = async (req, res) => {
  try {
    const users = createUsersClient();
    const userId = String(req.user.id);
    const user = await getCurrentUser(users, userId);
    await users.updatePrefs(userId, {
      ...(user.prefs || {}),
      role: user.prefs?.role || "user",
      adminAuditLogs: [],
    });
    return res.status(200).json({ success: true, message: "Audit logs cleared" });
  } catch (e) {
    console.error("clearAuditLogs error:", e);
    return res.status(500).json({ success: false, message: "Failed to clear audit logs" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getSettings,
  updateSettings,
  getSecurity2FA,
  updateSecurity2FA,
  getAuditLogs,
  appendAuditLog,
  clearAuditLogs,
};
