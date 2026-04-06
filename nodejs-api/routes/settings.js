const express = require("express");
const { body, param, query } = require("express-validator");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireRole, requirePermission } = require("../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { ALLOWED_MIME_TYPES, isValidMimeType } = require("../config/fileUpload");
const logger = require("../utils/logger");

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, "../public/uploads/logos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "logo-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (isValidMimeType(file.mimetype, ALLOWED_MIME_TYPES.IMAGES)) {
    cb(null, true);
  } else {
    cb(
      new Error("Only JPG, PNG, SVG, WebP, and SVG images are allowed"),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
});

// Get global site SEO settings
router.get(
  "/seo",
  requirePermission("SETTINGS", "READ"),
  asyncHandler(async (req, res) => {
    const s = await prisma.siteSeo.findFirst();
    res.json({ success: true, data: s || null });
  }),
);

// Upsert global SEO settings
router.put(
  "/seo",
  requireRole(["ADMIN"]),
  [
    body("siteName").optional().isString(),
    body("defaultTitle").optional().isString(),
    body("defaultDescription").optional().isString(),
    body("defaultKeywords").optional().isString(),
    body("defaultOgImageUrl").optional().isString(),
    body("allowIndexing").optional().isBoolean(),
    body("googleAnalyticsId").optional().isString(),
    body("googleTagManagerId").optional().isString(),
    body("facebookPixelId").optional().isString(),
    body("additionalHeadTags").optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const data = {
      siteName: req.body.siteName,
      defaultTitle: req.body.defaultTitle,
      defaultDescription: req.body.defaultDescription,
      defaultKeywords: req.body.defaultKeywords,
      defaultOgImageUrl: req.body.defaultOgImageUrl,
      allowIndexing: req.body.allowIndexing,
      googleAnalyticsId: req.body.googleAnalyticsId,
      googleTagManagerId: req.body.googleTagManagerId,
      facebookPixelId: req.body.facebookPixelId,
      additionalHeadTags: req.body.additionalHeadTags,
    };
    // Remove undefineds
    Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
    const exists = await prisma.siteSeo.findFirst();
    const record = exists
      ? await prisma.siteSeo.update({ where: { id: exists.id }, data })
      : await prisma.siteSeo.create({
          data: {
            siteName: data.siteName || "Site",
            defaultTitle: data.defaultTitle || "",
            defaultDescription: data.defaultDescription || "",
            defaultKeywords: data.defaultKeywords || "",
            defaultOgImageUrl: data.defaultOgImageUrl || "",
            allowIndexing: data.allowIndexing ?? true,
            googleAnalyticsId: data.googleAnalyticsId || "",
            googleTagManagerId: data.googleTagManagerId || "",
            facebookPixelId: data.facebookPixelId || "",
            additionalHeadTags: data.additionalHeadTags || "",
          },
        });
    res.json({ success: true, data: record });
  }),
);

// ─── Google Places Integration Settings ───────────────────────────
// Public – no auth required (API key is client-side / domain-restricted)
router.get(
  "/integrations/google-places",
  asyncHandler(async (req, res) => {
    const rows = await prisma.setting.findMany({
      where: {
        key: { in: ["google_places_enabled", "google_places_api_key"] },
      },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({
      success: true,
      data: {
        enabled: map.google_places_enabled === "true",
        apiKey: map.google_places_api_key || null,
      },
    });
  }),
);

// Admin only – save Google Places config
router.put(
  "/integrations/google-places",
  requireRole(["ADMIN"]),
  [
    body("enabled").isBoolean().withMessage("enabled must be a boolean"),
    body("apiKey")
      .optional({ nullable: true })
      .isString()
      .withMessage("apiKey must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { enabled, apiKey } = req.body;

    // Upsert enabled flag
    await prisma.setting.upsert({
      where: { key: "google_places_enabled" },
      update: { value: String(!!enabled), updatedAt: new Date() },
      create: {
        key: "google_places_enabled",
        value: String(!!enabled),
        type: "boolean",
        category: "integrations",
      },
    });

    // Upsert API key (clear if disabled)
    const keyValue = enabled && apiKey ? apiKey.trim() : "";
    await prisma.setting.upsert({
      where: { key: "google_places_api_key" },
      update: { value: keyValue, updatedAt: new Date() },
      create: {
        key: "google_places_api_key",
        value: keyValue,
        type: "string",
        category: "integrations",
      },
    });

    res.json({
      success: true,
      data: { enabled: !!enabled, apiKey: keyValue || null },
    });
  }),
);

// Deprecated generic setting endpoints retained for compatibility

// Create setting
router.post(
  "/",
  requireRole(["ADMIN"]),
  [
    body("key").notEmpty().withMessage("Setting key is required"),
    body("value").notEmpty().withMessage("Setting value is required"),
    body("type")
      .optional()
      .isIn(["string", "number", "boolean", "json"])
      .withMessage("Invalid setting type"),
    body("category")
      .optional()
      .isString()
      .withMessage("Category must be a string"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: "Create setting endpoint - To be implemented",
      data: {},
    });
  }),
);

// Delete setting
router.delete(
  "/:key",
  requireRole(["ADMIN"]),
  [
    param("key").notEmpty().withMessage("Setting key is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: "Delete setting endpoint - To be implemented",
    });
  }),
);

// Get store information
router.get(
  "/store/info",
  requirePermission("SETTINGS", "READ"),
  asyncHandler(async (req, res) => {
    const storeInfo = await prisma.storeInformation.findFirst();

    if (!storeInfo) {
      // Return default values if no store info exists
      return res.json({
        success: true,
        data: {
          name: "Centre Labs",
          description: "Premium peptides for research and development",
          email: "contact@centreresearch.com",
          phone: "+1 (555) 123-4567",
          addressLine1: "123 Research Boulevard",
          addressLine2: "",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
          logoUrl: null,
          taxId: null,
          registrationNumber: null,
        },
      });
    }

    res.json({ success: true, data: storeInfo });
  }),
);

// Update store information
router.put(
  "/store/info",
  requireRole(["ADMIN"]),
  [
    body("name")
      .optional()
      .isString()
      .withMessage("Store name must be a string"),
    body("description")
      .optional()
      .isString()
      .withMessage("Description must be a string"),
    body("email").optional().isEmail().withMessage("Valid email is required"),
    body("phone").optional().isString().withMessage("Phone must be a string"),
    body("addressLine1")
      .optional()
      .isString()
      .withMessage("Address line 1 must be a string"),
    body("addressLine2")
      .optional()
      .isString()
      .withMessage("Address line 2 must be a string"),
    body("city").optional().isString().withMessage("City must be a string"),
    body("state").optional().isString().withMessage("State must be a string"),
    body("postalCode")
      .optional()
      .isString()
      .withMessage("Postal code must be a string"),
    body("country")
      .optional()
      .isString()
      .withMessage("Country must be a string"),
    body("taxId")
      .optional({ nullable: true })
      .isString()
      .withMessage("Tax ID must be a string"),
    body("registrationNumber")
      .optional({ nullable: true })
      .isString()
      .withMessage("Registration number must be a string"),
    body("logoUrl")
      .optional({ nullable: true })
      .custom((value) => {
        // Allow null, undefined, or a string
        if (value === null || value === undefined || value === "") return true;
        if (typeof value === "string") return true;
        return false;
      })
      .withMessage("Logo URL must be a string or null"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const data = req.body;

    // Remove undefined values
    Object.keys(data).forEach(
      (key) => data[key] === undefined && delete data[key],
    );

    const existingStore = await prisma.storeInformation.findFirst();

    let storeInfo;
    if (existingStore) {
      storeInfo = await prisma.storeInformation.update({
        where: { id: existingStore.id },
        data: { ...data, updatedAt: new Date() },
      });
    } else {
      storeInfo = await prisma.storeInformation.create({
        data: {
          name: data.name || "Centre Labs",
          description:
            data.description || "Premium peptides for research and development",
          email: data.email || "contact@centreresearch.com",
          phone: data.phone || "+1 (555) 123-4567",
          addressLine1: data.addressLine1 || "123 Research Boulevard",
          addressLine2: data.addressLine2 || "",
          city: data.city || "Boston",
          state: data.state || "MA",
          postalCode: data.postalCode || "02101",
          country: data.country || "US",
          logoUrl: data.logoUrl || null,
          taxId: data.taxId || null,
          registrationNumber: data.registrationNumber || null,
        },
      });
    }

    res.json({ success: true, data: storeInfo });
  }),
);

// Upload store logo (file upload)
router.post(
  "/store/logo/upload",
  requireRole(["ADMIN"]),
  upload.single("logo"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    // Generate the URL path for the uploaded file
    const logoUrl = `/uploads/logos/${req.file.filename}`;

    logger.info("[Settings] Logo uploaded", {
      filename: req.file.filename,
      url: logoUrl,
    });

    const existingStore = await prisma.storeInformation.findFirst();

    let storeInfo;
    if (existingStore) {
      storeInfo = await prisma.storeInformation.update({
        where: { id: existingStore.id },
        data: { logoUrl, updatedAt: new Date() },
      });
    } else {
      storeInfo = await prisma.storeInformation.create({
        data: {
          name: "Centre Labs",
          description:
            "Peptides made in America with the highest quality control standards possible.",
          email: "info@centreresearch.org",
          phone: "",
          addressLine1: "5825 W Sunset Blvd",
          addressLine2: "",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90028",
          country: "US",
          logoUrl,
        },
      });
    }

    res.json({
      success: true,
      data: storeInfo,
      message: "Logo uploaded successfully",
    });
  }),
);

// Legacy endpoint for backward compatibility (accepts logoUrl string)
router.post(
  "/store/logo",
  requireRole(["ADMIN"]),
  [
    body("logoUrl").isString().withMessage("Logo URL is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { logoUrl } = req.body;

    const existingStore = await prisma.storeInformation.findFirst();

    if (existingStore) {
      await prisma.storeInformation.update({
        where: { id: existingStore.id },
        data: { logoUrl, updatedAt: new Date() },
      });
    } else {
      await prisma.storeInformation.create({
        data: {
          name: "Centre Labs",
          description: "Premium peptides for research and development",
          email: "info@centreresearch.org",
          phone: "",
          addressLine1: "5825 W Sunset Blvd",
          addressLine2: "",
          city: "Los Angeles",
          state: "CA",
          postalCode: "90028",
          country: "US",
          logoUrl,
        },
      });
    }

    res.json({ success: true, message: "Logo updated successfully" });
  }),
);

module.exports = router;
