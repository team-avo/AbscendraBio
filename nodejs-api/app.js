require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
// const rateLimit = require("express-rate-limit"); // DISABLED - Rate limiting removed
const { body, validationResult } = require("express-validator");
const createError = require("http-errors");
const path = require("path");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const multer = require("multer");

// Import Prisma client
const prisma = require("./prisma/client");
const logger = require("./utils/logger");

// Import middleware
const { authMiddleware } = require("./middleware/auth");
const { errorHandler } = require("./middleware/errorHandler");
const validateRequest = require("./middleware/validateRequest");

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const customerRoutes = require("./routes/customers");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const inventoryRoutes = require("./routes/inventory");
const inventorySyncQuickRoutes = require("./routes/inventory-sync-quick");
const paymentRoutes = require("./routes/payments");
const shippingRoutes = require("./routes/shipping");
const promotionRoutes = require("./routes/promotions");
const analyticsRoutes = require("./routes/analytics");
const marketingRoutes = require("./routes/marketing");
const campaignsRoutes = require("./routes/campaigns");
const settingRoutes = require("./routes/settings");
const reviewRoutes = require("./routes/reviews");
const inventoryBatchesRoutes = require("./routes/inventory-batches");
const locationsRoutes = require("./routes/locations");
const categoriesRouter = require("./routes/categories");
const productsRouter = require("./routes/products");
const publicProductsRouter = require("./routes/public-products");
const cartRouter = require("./routes/cart");
const usersRouter = require("./routes/users");
const collectionsRouter = require("./routes/collections");
const taxRatesRoutes = require("./routes/taxRates");
const transactionsRoutes = require("./routes/transactions");
const emailTemplatesRoutes = require("./routes/email-templates");
const uploadsRoutes = require("./routes/uploads");
const notificationsRoutes = require("./routes/notifications");
const scriptsRoutes = require("./routes/scripts");
const productBulkRoutes = require("./routes/product-bulk");
const contentRoutes = require("./routes/content");
const publicContentRoutes = require("./routes/public-content");
const salesRepRoutes = require("./routes/sales-reps");
const salesManagerRoutes = require("./routes/sales-managers");
const inquiriesRoutes = require("./routes/inquiries");
const contactLabRoutes = require("./routes/contact-lab");
const sendEmailRoutes = require("./routes/send-email");
const customerSignupConfirmationRoutes = require("./routes/customer-signup-confirmation");
const otpRoutes = require("./routes/otp");
const bulkQuotesRoutes = require("./routes/bulk-quotes");
const shipstationRoutes = require("./routes/shipstation");
const stockAlertsRoutes = require("./routes/stock-alerts");
const stockReceiptsRoutes = require("./routes/stock-receipts");
const bulkPricesRoutes = require("./routes/bulkPrices");
const odooRoutes = require("./integrations/skydell_odoo/odooRoutes");
const odooConfigRoutes = require("./integrations/skydell_odoo/odooConfigRoutes");
const salesChannelRoutes = require("./routes/sales-channels");
const thirdPartyReportsRoutes = require("./routes/third-party-reports");
const publicThirdPartyReportsRoutes = require("./routes/public-third-party-reports");
const loginAuditLogRoutes = require("./routes/loginAuditLogs");
const commentsRoutes = require("./routes/comments");
// Import stock alert scheduler
const {
  initializeStockAlertScheduler,
} = require("./utils/stockAlertScheduler");

// Initialize Background Workers
require("./workers/reportWorker");

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = (process.env.FRONTEND_CORS_URL || process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map(origin => origin.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Rate limiting - DISABLED
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
//   message: {
//     error: "Too many requests from this IP, please try again later.",
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use("/api/", limiter); // DISABLED - Rate limiting removed

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Logging middleware
app.use(morgan("combined"));

// File upload configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.UPLOAD_PATH || "./uploads");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  },
  fileFilter: function (req, file, cb) {
    // Allow only images and documents
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("application/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and document files are allowed"), false);
    }
  },
});

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API documentation endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "Centre Research Peptide Store API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      customers: "/api/customers",
      products: "/api/products",
      orders: "/api/orders",
      inventory: "/api/inventory",
      payments: "/api/payments",
      shipping: "/api/shipping",
      promotions: "/api/promotions",
      analytics: "/api/analytics",
      marketing: "/api/marketing",
      settings: "/api/settings",
      reviews: "/api/reviews",
      "inventory-batches": "/api/inventory-batches",
      locations: "/api/locations",
      content: "/api/content",
      "public-pages": "/api/public-pages",
      "public-navigation": "/api/public-pages/navigation",
    },
    documentation: "https://docs.centreresearch.com/api",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", authMiddleware, userRoutes);
app.use("/api/customers", authMiddleware, customerRoutes);
app.use("/api/products", authMiddleware, productRoutes);
// Public storefront endpoints (no auth)
app.use("/api/storefront/products", publicProductsRouter);
app.use("/api/scripts", authMiddleware, scriptsRoutes);
app.use("/api/products", authMiddleware, productBulkRoutes);
app.use("/api/cart", authMiddleware, cartRouter);
app.use("/api/orders", authMiddleware, orderRoutes);
app.use("/api/inventory", authMiddleware, inventoryRoutes);
app.use("/api/inventory-sync", authMiddleware, inventorySyncQuickRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/shipping", authMiddleware, shippingRoutes);
app.use("/api/promotions", authMiddleware, promotionRoutes);
app.use("/api/analytics", authMiddleware, analyticsRoutes);
app.use("/api/marketing", authMiddleware, marketingRoutes);
app.use("/api/campaigns", authMiddleware, campaignsRoutes);
app.use("/api/settings", authMiddleware, settingRoutes);
app.use("/api/reviews", authMiddleware, reviewRoutes);
app.use("/api/inventory-batches", authMiddleware, inventoryBatchesRoutes);
app.use("/api/locations", authMiddleware, locationsRoutes);
app.use("/api/categories", authMiddleware, categoriesRouter);
app.use("/api/products", authMiddleware, productsRouter);
app.use("/api/users", authMiddleware, usersRouter);
app.use("/api/collections", authMiddleware, collectionsRouter);
app.use("/api/tax-rates", authMiddleware, taxRatesRoutes);
app.use("/api/transactions", authMiddleware, transactionsRoutes);
app.use("/api/email-templates", authMiddleware, emailTemplatesRoutes);
app.use("/api/bulk-prices", authMiddleware, bulkPricesRoutes);
app.use("/api/uploads", authMiddleware, uploadsRoutes);
app.use("/api/third-party-reports", authMiddleware, thirdPartyReportsRoutes);
app.use("/api/notifications", authMiddleware, notificationsRoutes);
app.use("/api/content", authMiddleware, contentRoutes);
app.use("/api/shipstation", authMiddleware, shipstationRoutes);
// Public content endpoint (no auth)
app.use("/api/public-pages", publicContentRoutes);
// Backward-compatible alias: /api/public-content
app.use("/api/public-content", publicContentRoutes);
app.use("/api/public-third-party-reports", publicThirdPartyReportsRoutes);
app.use("/api/sales-reps", authMiddleware, salesRepRoutes);
app.use("/api/sales-managers", authMiddleware, salesManagerRoutes);
// Inquiries (public)
app.use("/api/inquiries", inquiriesRoutes);
// Contact Lab (public)
app.use("/api/contact-lab", contactLabRoutes);
// Contact form email (public)
app.use("/api/send-email", sendEmailRoutes);
// Customer signup confirmation (public)
app.use("/api/customer-signup-confirmation", customerSignupConfirmationRoutes);
// Mobile OTP verification (auth optional per-route checks)
app.use("/api/otp", otpRoutes);
// Bulk quotes (auth required)
app.use("/api/bulk-quotes", authMiddleware, bulkQuotesRoutes);
// Stock alerts (auth required)
logger.info("Registering stock alerts routes...");
app.use("/api/stock-alerts", authMiddleware, stockAlertsRoutes);
// Supplier email auto-import + admin review for inbound stock (auth required)
app.use("/api/stock-receipts", authMiddleware, stockReceiptsRoutes);
app.use("/api/sales-channels", salesChannelRoutes);
app.use("/api/login-audit-logs", authMiddleware, loginAuditLogRoutes);
app.use("/api/comments", authMiddleware, commentsRoutes);
logger.info("Stock alerts routes registered successfully");
// Odoo integration (auth required)
logger.info("Registering Odoo integration routes...");
app.use("/api/odoo", authMiddleware, odooRoutes);
app.use("/api/odoo/config", authMiddleware, odooConfigRoutes);
logger.info("Odoo integration routes registered successfully");

// File upload endpoint
app.post("/api/upload", authMiddleware, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    message: "File uploaded successfully",
    file: {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/${req.file.filename}`,
    },
  });
});

// Stripe webhook endpoint (before body parser)
app.post("/api/webhooks/stripe", express.json(), (req, res) => {
  const sig = req.headers["stripe-signature"];
  // Handle Stripe webhook
  res.json({ received: true });
});

// Initialize stock alert scheduler
try {
  initializeStockAlertScheduler();
} catch (error) {
  logger.error("Failed to initialize stock alert scheduler:", error);
}

// Global error handler
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested resource was not found",
    path: req.originalUrl,
  });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully");
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
