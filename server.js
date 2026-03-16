require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRouter          = require("./routes/auth/auth-routes");
const shopOrderRouter     = require("./routes/shop/order-routes");
const adminOrderRouter    = require("./routes/admin/order-routes");
const adminCustomersRouter = require("./routes/admin/customers-routes");
const adminProductsRouter  = require("./routes/admin/products-routes");
const adminConfigRouter    = require("./routes/admin/config-routes");
const contactRouter        = require("./routes/common/contact-routes");

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === "production";

const allowedOrigins = (
  process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:3000,http://localhost:5173"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

console.log("[CORS] Allowed origins:", allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Exact match against whitelisted origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow all Vercel preview deployments for your team
      if (origin.endsWith("-hygienhub03-devs-projects.vercel.app")) return callback(null, true);
      // Also allow any hygiene-hub-admin preview URLs
      if (/^https:\/\/hygiene-hub-admin(-[a-z0-9]+)*\.vercel\.app$/.test(origin)) return callback(null, true);
      // Allow any hygienhub preview URLs
      if (/^https:\/\/hygienhub(-[a-z0-9]+)*\.vercel\.app$/.test(origin)) return callback(null, true);
      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Expires", "Pragma"],
    credentials: true,
  })
);

if (IS_PROD) {
  app.set("trust proxy", 1);
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cookieParser());
app.use(globalLimiter);

// Paystack sends signed webhooks; keep raw body for HMAC validation.
app.use("/api/shop/order/webhook/paystack", express.raw({ type: "application/json", limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", storage: "appwrite" });
});

app.use("/api/auth/login",      authLimiter);
app.use("/api/auth/register",   authLimiter);
app.use("/api/auth/mfa/verify-login", authLimiter);
app.use("/api/auth/mfa/setup", authLimiter);
app.use("/api/auth",            authRouter);
app.use("/api/shop/order",      shopOrderRouter);
app.use("/api/admin/orders",    adminOrderRouter);
app.use("/api/admin/customers", adminCustomersRouter);
app.use("/api/admin/products",  adminProductsRouter);
app.use("/api/admin/config",    adminConfigRouter);
app.use("/api/contact",         contactRouter);

app.listen(PORT, () => console.log(`Server running on port ${PORT} — using Appwrite for storage`));
