const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { body, query } = require("express-validator");
const { Resend } = require("resend");
const resend = require("../config/resend");
const path = require("path");
const prisma = require("../prisma/client");
const validateRequest = require("../middleware/validateRequest");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, optionalAuth } = require("../middleware/auth");
const { logLoginAttempt } = require("../utils/loginAuditLogger");

// Initialize Resend (now handled via config/resend.js)
// const resend = new Resend(process.env.RESEND_API_KEY);

// Email verification using Resend API (no DB template)
const sendVerificationEmail = async (toEmail, firstName, verificationLink) => {
  const subject = "Verify your email address";
  const html = `
    <body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f6f7fb;">
      <table align="center" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;margin:24px auto;border:1px solid #eee;border-radius:8px;overflow:hidden">
        <tr>
          <td style="padding:24px 24px 0 24px;text-align:center;background:#ffffff;border-bottom:1px solid #f0f0f0;">
            <img src="https://centrelabs.org/logo.png" alt="Verify" width="120" height="80"/>
            <h1 style="margin:16px 0 8px 0;color:#111827;font-size:22px;">Confirm your email</h1>
            <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;">Hi ${
              firstName || "there"
            }, please verify your email to finish setting up your account.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;text-align:center;">
            <a href="${verificationLink}" style="display:inline-block;padding:12px 20px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Verify email</a>
            <p style="margin:16px 0 0 0;color:#6b7280;font-size:12px;">This link will expire in 24 hours.</p>
            <p style="margin:8px 0 0 0;color:#6b7280;font-size:12px;word-break:break-all;">If the button doesn't work, copy and paste this URL into your browser:<br/>${verificationLink}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 24px 24px;color:#9ca3af;font-size:12px;text-align:center;border-top:1px solid #f0f0f0;">
            © ${new Date().getFullYear()} Ascendra Bio. All rights reserved.
          </td>
        </tr>
      </table>
    </body>
  `;

  console.log("[Resend] Sending email verification...");
  await resend.emails.send({
    from: "Notifications | Ascendra Bio <notifications@ascendrabio.com>",
    to: toEmail,
    subject,
    html,
  });
  console.log("[Resend] Email verification sent successfully");
};

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "365d",
  });
};

// Set auth cookie manually to support SameSite=None (express 4.16's cookie lib doesn't support it)
const setAuthCookie = (res, token) => {
  const maxAge = 365 * 24 * 60 * 60; // seconds
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
  res.setHeader(
    "Set-Cookie",
    `token=${token}; Path=/; HttpOnly; Secure; SameSite=None; Expires=${expires}`,
  );
};

// User registration
router.post(
  "/register",
  [
    body("email")
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: false,
      })
      .withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .custom((val) => !/\s/.test(val))
      .withMessage("Password cannot contain spaces"),
    body("firstName").notEmpty().trim().withMessage("First name is required"),
    body("lastName").notEmpty().trim().withMessage("Last name is required"),
    body("middleName").optional().trim(),
    body("companyName").optional().trim(),
    body("licenseNumber")
      .if(body("role").equals("CUSTOMER"))
      .notEmpty()
      .trim()
      .withMessage("NPI / License number is required for customer registration")
      .if(body("role").equals("CUSTOMER"))
      .matches(/^\d{10}$/)
      .withMessage("NPI / License number must be exactly 10 digits"),
    body("role")
      .optional()
      .isIn(["ADMIN", "MANAGER", "STAFF", "CUSTOMER"])
      .withMessage("Invalid role"),
    body("mobile")
      .if(body("role").equals("CUSTOMER"))
      .notEmpty()
      .trim()
      .withMessage("Mobile number is required for customer registration")
      .if(body("role").equals("CUSTOMER"))
      .custom((val) => {
        const digits = (val || "").replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 15;
      })
      .withMessage("Mobile number must be between 10 and 15 digits"),

    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const {
      email,
      password,
      firstName,
      middleName,
      lastName,
      companyName,
      licenseNumber,
      city,
      zip,
      role = "STAFF",
      mobile,
      customerType,
    } = req.body;

    const trimmedCompanyName =
      typeof companyName === "string" ? companyName.trim() : undefined;
    const trimmedLicenseNumber =
      typeof licenseNumber === "string" ? licenseNumber.trim() : undefined;
    const trimmedCity = typeof city === "string" ? city.trim() : undefined;
    const trimmedZip = typeof zip === "string" ? zip.trim() : undefined;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "User already exists with this email",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    let user;
    if (role === "CUSTOMER") {
      // In a transaction: create Customer then link to User
      const result = await prisma.$transaction(async (tx) => {
        const existingCustomer = await tx.customer.findFirst({
          where: {
            OR: [
              { email },
              ...(mobile && mobile.trim() ? [{ mobile: mobile.trim() }] : []),
            ],
          },
        });
        if (existingCustomer) {
          throw new Error("Customer already exists with this email or mobile");
        }

        const customer = await tx.customer.create({
          data: {
            firstName,
            middleName,
            lastName,
            companyName: trimmedCompanyName || null,
            licenseNumber: trimmedLicenseNumber || null,
            city: trimmedCity || null,
            zip: trimmedZip || null,
            email,
            mobile,
            customerType: customerType || "B2C",
            isActive: false, // start inactive until approval
            isApproved: false,
            approvalStatus: "PENDING",
          },
        });

        const createdUser = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role: "CUSTOMER",
            isActive: false,
            customerId: customer.id,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            customerId: true,
          },
        });

        return createdUser;
      });
      user = result;
    } else {
      // Create staff user only
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          customerId: true,
        },
      });
    }

    if (role === "CUSTOMER") {
      // Generate email verification token and send email
      let emailSent = false;
      try {
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
        await prisma.emailVerificationToken.create({
          data: { userId: user.id, token: verificationToken, expiresAt },
        });
        const link = `${
          process.env.FRONTEND_URL || "http://localhost:3000"
        }/verify?token=${verificationToken}`;
        await sendVerificationEmail(user.email, user.firstName || "", link);
        emailSent = true;
      } catch (e) {
        console.error("Failed to send verification email:", e?.message);
      }

      res.status(201).json({
        success: true,
        emailSent,
        message: emailSent
          ? "Account created. Please verify your email and wait for admin approval."
          : "Account created, but we couldn't send the verification email. Please use the resend option on the login page.",
        data: { user },
      });
    } else {
      // Generate token for staff users
      const token = generateToken(user.id);
      setAuthCookie(res, token);
      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user,
          token,
        },
      });
    }
  }),
);

// Password reset - request
router.post(
  "/password-reset/request",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "This email ID does not exist in our record. Please check and enter the correct email.",
      });
    }

    // Generate short-lived token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "365d",
    });
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      const { sendPasswordResetEmail } = require("../utils/emailService");
      await sendPasswordResetEmail(user, token);
    } catch (e) {
      // Log but do not leak info
      console.error("Failed to send reset email:", e);
      return res.status(500).json({
        success: false,
        error: "Failed to send reset email. Please try again later.",
      });
    }
    return res.json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });
  }),
);

// Password reset - confirm
router.post(
  "/password-reset/confirm",
  [
    body("token").isString().withMessage("Token is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long")
      .custom((val) => !/\s/.test(val))
      .withMessage("New password cannot contain spaces"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const userId = payload.userId;
      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
      });
      return res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (e) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid or expired token" });
    }
  }),
);

// User login
router.post(
  "/login",
  [
    body("email")
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: false,
      })
      .withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email, password, portal } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        permissions: true,
        customer: {
          select: {
            id: true,
            customerType: true,
            isActive: true,
            isApproved: true,
          },
        },
      },
    });

    if (!user) {
      logLoginAttempt({
        email,
        status: "FAILED",
        failureReason: "USER_NOT_FOUND",
        portal: portal || "unknown",
        req,
      });
      return res.status(401).json({
        success: false,
        error: "User not found",
      });
    }

    // Enforce portal role restrictions (no auto-login/logout)
    if (portal === "CUSTOMER" && user.role !== "CUSTOMER") {
      logLoginAttempt({
        email,
        userId: user.id,
        status: "FAILED",
        failureReason: "ROLE_MISMATCH",
        failureDetail: "Admin attempted customer portal login",
        portal: portal || "customer",
        req,
      });
      return res.status(403).json({
        success: false,
        error:
          "Oops! Admins can't login to customer panel. Please use the Admin login.",
      });
    }
    if (portal === "ADMIN" && user.role === "CUSTOMER") {
      logLoginAttempt({
        email,
        userId: user.id,
        status: "FAILED",
        failureReason: "ROLE_MISMATCH",
        failureDetail: "Customer attempted admin portal login",
        portal: portal || "admin",
        req,
      });
      return res.status(403).json({
        success: false,
        error:
          "Oops! Customers can't login to admin panel. Please use the Customer login.",
      });
    }

    // Verify password FIRST before checking account status
    // This prevents "invalid password" error after closing pending approval popup
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      logLoginAttempt({
        email,
        userId: user.id,
        status: "FAILED",
        failureReason: "INVALID_PASSWORD",
        portal: portal || "unknown",
        req,
      });
      return res.status(401).json({
        success: false,
        error: "Invalid password",
      });
    }

    // Now check account status (after password is verified)
    // Check if user is active
    if (!user.isActive) {
      logLoginAttempt({
        email,
        userId: user.id,
        status: "FAILED",
        failureReason: "ACCOUNT_INACTIVE",
        portal: portal || "unknown",
        req,
      });
      return res.status(401).json({
        success: false,
        error: "Account is inactive",
      });
    }

    // Check if customer account is approved
    if (user.role === "CUSTOMER" && user.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: user.customerId },
        select: { isApproved: true, emailVerified: true },
      });

      if (customer && !customer.emailVerified) {
        // Proactively send (or resend) verification email
        try {
          await prisma.emailVerificationToken.deleteMany({
            where: { userId: user.id },
          });
          const verificationToken = crypto.randomBytes(32).toString("hex");
          const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // 365 days
          await prisma.emailVerificationToken.create({
            data: { userId: user.id, token: verificationToken, expiresAt },
          });
          const link = `${
            process.env.FRONTEND_URL || "http://localhost:3000"
          }/verify?token=${verificationToken}`;
          await sendVerificationEmail(user.email, user.firstName || "", link);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(
            "[AUTH] Failed to send verification email on login:",
            e?.message || e,
          );
        }
        logLoginAttempt({
          email,
          userId: user.id,
          status: "FAILED",
          failureReason: "EMAIL_NOT_VERIFIED",
          portal: portal || "unknown",
          req,
        });
        return res.status(401).json({
          success: false,
          error: "Please verify your email address to continue.",
        });
      }

      if (customer && !customer.isApproved) {
        logLoginAttempt({
          email,
          userId: user.id,
          status: "FAILED",
          failureReason: "PENDING_APPROVAL",
          portal: portal || "unknown",
          req,
        });
        return res.status(401).json({
          success: false,
          error:
            "Your account is pending for approval. Please wait for approval before logging in.",
        });
      }
    }

    // Generate token
    const token = generateToken(user.id);
    setAuthCookie(res, token);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    logLoginAttempt({
      email,
      userId: user.id,
      status: "SUCCESS",
      portal: portal || "unknown",
      req,
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  }),
);

// Request email verification (resend) — public endpoint, takes email in body
router.post(
  "/request-email-verification",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    // Always return the same success shape to avoid user-enumeration
    const genericOk = { success: true, message: "If that email is registered and unverified, a new link has been sent." };

    const me = await prisma.user.findUnique({ where: { email } });
    if (!me || me.role !== "CUSTOMER" || !me.customerId) {
      return res.json(genericOk);
    }

    const customer = await prisma.customer.findUnique({ where: { id: me.customerId } });
    if (customer?.emailVerified) {
      return res.json({ success: true, message: "Email already verified" });
    }

    // Invalidate previous tokens and issue a fresh one
    await prisma.emailVerificationToken.deleteMany({ where: { userId: me.id } });
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
    await prisma.emailVerificationToken.create({
      data: { userId: me.id, token: verificationToken, expiresAt },
    });
    const link = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify?token=${verificationToken}`;
    try {
      await sendVerificationEmail(me.email, me.firstName || "", link);
    } catch (e) {
      console.error("Failed to resend verification email:", e?.message);
    }
    res.json(genericOk);
  }),
);

// Verify email by token
router.get(
  "/verify-email",
  [
    query("token").isString().notEmpty().withMessage("Token is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { token } = req.query;
    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });
    if (!record) {
      return res.status(400).json({ success: false, error: "Invalid token" });
    }
    if (record.usedAt) {
      return res.json({ success: true, message: "Email already verified" });
    }
    if (record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: "Token expired" });
    }
    // Mark customer as verified if linked
    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid token" });
    }
    if (user.customerId) {
      await prisma.customer.update({
        where: { id: user.customerId },
        data: { emailVerified: true },
      });
    }
    await prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    res.json({ success: true, message: "Email verified successfully" });
  }),
);

// Get current user profile
router.get(
  "/profile",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        permissions: {
          select: {
            module: true,
            action: true,
            granted: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerType: true,
            isApproved: true,
            isActive: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  }),
);

// Update user profile
router.put(
  "/profile",
  authMiddleware,
  [
    body("firstName")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("First name cannot be empty"),
    body("lastName")
      .optional()
      .notEmpty()
      .trim()
      .withMessage("Last name cannot be empty"),
    body("email")
      .optional()
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: false,
      })
      .withMessage("Valid email is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email } = req.body;

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  }),
);

// Change password
router.put(
  "/change-password",
  authMiddleware,
  [
    body("currentPassword")
      .notEmpty()
      .withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long")
      .custom((val) => !/\s/.test(val))
      .withMessage("New password cannot contain spaces"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: "Current password is incorrect",
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedNewPassword },
    });

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  }),
);

// Refresh token
router.post(
  "/refresh",
  optionalAuth,
  asyncHandler(async (req, res) => {
    let user = req.user;

    // If middleware didn't attach user (likely due to expired token), try to decode ignoring expiry
    if (!user) {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            ignoreExpiration: true,
          });
          user = await prisma.user.findUnique({
            where: { id: decoded.userId },
          });
        } catch (e) {
          // Token invalid or malformed
        }
      }
    }

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired session" });
    }

    const token = generateToken(user.id);
    setAuthCookie(res, token);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      data: { token },
    });
  }),
);

// Logout (client-side token removal)
router.post(
  "/logout",
  authMiddleware,
  asyncHandler(async (req, res) => {
    // Clear the token cookie
    res.setHeader(
      "Set-Cookie",
      "token=; Path=/; HttpOnly; Secure; SameSite=None; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
    res.json({
      success: true,
      message: "Logout successful",
    });
  }),
);

// Debug endpoint: get current user and permissions
router.get(
  "/whoami",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        permissions: true,
      },
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }
    res.json({
      success: true,
      data: user,
    });
  }),
);

// Grant all permissions to admin user (for debugging/fixing permissions)
router.post(
  "/grant-admin-permissions",
  authMiddleware,
  asyncHandler(async (req, res) => {
    // Only allow if current user is ADMIN
    if (req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ success: false, error: "Only admin can grant permissions." });
    }
    const modules = [
      "users",
      "customers",
      "products",
      "orders",
      "payments",
      "analytics",
      "settings",
      "inventory",
      "shipping",
      "promotions",
      "collections",
      "categories",
      "tax-rates",
    ];
    const actions = ["CREATE", "READ", "UPDATE", "DELETE"];
    // Remove all existing permissions for this user
    await prisma.userPermission.deleteMany({ where: { userId: req.user.id } });
    // Grant all permissions
    for (const module of modules) {
      for (const action of actions) {
        await prisma.userPermission.create({
          data: {
            userId: req.user.id,
            module,
            action,
            granted: true,
          },
        });
      }
    }
    res.json({ success: true, message: "All admin permissions granted." });
  }),
);

// ===== Email OTP Login =====

// Helper: Generate 6-digit OTP code
function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Helper: Add minutes to date
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

// Request email OTP for passwordless login
router.post(
  "/email-otp/request",
  [
    body("email")
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: false,
      })
      .withMessage("Valid email is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error:
          "This email ID does not exist in our record. Please check and enter the correct email.",
      });
    }

    // Rate limit: 2 minutes between requests
    const existing = await prisma.emailLoginOtp.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { lastSentAt: "desc" },
    });

    if (existing) {
      const nextAllowed = new Date(
        existing.lastSentAt.getTime() + 2 * 60 * 1000,
      ); // 2 minutes
      if (nextAllowed > new Date()) {
        const waitSeconds = Math.ceil(
          (nextAllowed.getTime() - Date.now()) / 1000,
        );
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitSeconds} seconds before requesting another code.`,
        });
      }
    }

    // Generate 6-digit code
    const code = generateOtpCode();
    const expiresAt = addMinutes(new Date(), 15); // 15 minutes expiry

    // Create OTP record
    await prisma.emailLoginOtp.create({
      data: {
        userId: user.id,
        email: user.email,
        code,
        expiresAt,
        lastSentAt: new Date(),
      },
    });

    // Send email
    try {
      const { sendLoginOtpEmail } = require("../utils/emailService");
      const firstName = user.customer?.firstName || user.firstName || "";
      await sendLoginOtpEmail(user.email, code, firstName);
    } catch (e) {
      console.error("[Email OTP] Failed to send email:", e?.message || e);
      return res.status(500).json({
        success: false,
        error: "Failed to send verification code. Please try again.",
      });
    }

    res.json({
      success: true,
      message: "Verification code sent to your email.",
    });
  }),
);

// Verify email OTP and login
router.post(
  "/email-otp/verify",
  [
    body("email")
      .isEmail()
      .normalizeEmail({
        gmail_remove_dots: false,
        gmail_remove_subaddress: false,
        gmail_convert_googlemaildotcom: false,
      })
      .withMessage("Valid email is required"),
    body("code")
      .isString()
      .isLength({ min: 6, max: 6 })
      .withMessage("6-digit code is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { email, code, portal } = req.body;

    // Find the OTP record
    const otp = await prisma.emailLoginOtp.findFirst({
      where: { email, usedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          include: {
            permissions: true,
            customer: {
              select: {
                id: true,
                customerType: true,
                isActive: true,
                isApproved: true,
                emailVerified: true,
              },
            },
          },
        },
      },
    });

    if (!otp) {
      return res.status(400).json({
        success: false,
        error: "No active code found. Please request a new one.",
      });
    }

    // Check if expired
    if (otp.expiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        error: "Code expired. Please request a new one.",
      });
    }

    // Increment attempts
    const attempts = (otp.attempts || 0) + 1;
    if (attempts > 15) {
      await prisma.emailLoginOtp.update({
        where: { id: otp.id },
        data: { attempts },
      });
      return res.status(429).json({
        success: false,
        error: "Too many attempts. Please request a new code.",
      });
    }

    // Verify code
    if (otp.code !== String(code).trim()) {
      await prisma.emailLoginOtp.update({
        where: { id: otp.id },
        data: { attempts },
      });
      return res.status(400).json({
        success: false,
        error: "Invalid code. Please try again.",
      });
    }

    // Code is valid - mark as used
    await prisma.emailLoginOtp.update({
      where: { id: otp.id },
      data: { usedAt: new Date(), attempts },
    });

    const user = otp.user;

    // Apply same validation checks as password login
    // Portal restrictions
    if (portal === "CUSTOMER" && user.role !== "CUSTOMER") {
      logLoginAttempt({
        email,
        userId: user.id,
        status: "FAILED",
        failureReason: "ROLE_MISMATCH",
        failureDetail: "Admin attempted customer portal login via OTP",
        portal: portal || "customer",
        req,
      });
      return res.status(403).json({
        success: false,
        error:
          "Oops! Admins can't login to customer panel. Please use the Admin login.",
      });
    }
    if (portal === "ADMIN" && user.role === "CUSTOMER") {
      logLoginAttempt({
        email,
        userId: user.id,
        status: "FAILED",
        failureReason: "ROLE_MISMATCH",
        failureDetail: "Customer attempted admin portal login via OTP",
        portal: portal || "admin",
        req,
      });
      return res.status(403).json({
        success: false,
        error:
          "Oops! Customers can't login to admin panel. Please use the Customer login.",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      logLoginAttempt({
        email,
        userId: user.id,
        status: "FAILED",
        failureReason: "ACCOUNT_INACTIVE",
        failureDetail: "OTP login",
        portal: portal || "unknown",
        req,
      });
      return res.status(401).json({
        success: false,
        error: "Account is inactive",
      });
    }

    // Check customer-specific validations
    if (user.role === "CUSTOMER" && user.customerId) {
      const customer = user.customer;

      if (customer && !customer.emailVerified) {
        logLoginAttempt({
          email,
          userId: user.id,
          status: "FAILED",
          failureReason: "EMAIL_NOT_VERIFIED",
          failureDetail: "OTP login",
          portal: portal || "unknown",
          req,
        });
        return res.status(401).json({
          success: false,
          error: "Please verify your email address to continue.",
        });
      }

      if (customer && !customer.isApproved) {
        logLoginAttempt({
          email,
          userId: user.id,
          status: "FAILED",
          failureReason: "PENDING_APPROVAL",
          failureDetail: "OTP login",
          portal: portal || "unknown",
          req,
        });
        return res.status(401).json({
          success: false,
          error:
            "Your account is pending for approval. Please wait for approval before logging in.",
        });
      }
    }

    // Generate token (365 days expiry - same as regular login)
    const token = generateToken(user.id);
    setAuthCookie(res, token);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    logLoginAttempt({
      email,
      userId: user.id,
      status: "SUCCESS",
      failureDetail: "OTP login",
      portal: portal || "unknown",
      req,
    });

    res.json({
      success: true,
      message: "Login successful",
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  }),
);

// ===== Client-side login failure reporting =====
// Unauthenticated endpoint — lets the frontend report network/client errors
// that prevented the login request from reaching the server.
// Rate-limited per IP to prevent abuse.
const loginEventIpMap = new Map(); // simple in-memory rate limiter
const LOGIN_EVENT_RATE_LIMIT = 10; // max reports per minute per IP
const LOGIN_EVENT_WINDOW_MS = 60 * 1000;

const ALLOWED_CLIENT_REASONS = [
  "NETWORK_ERROR",
  "CLIENT_ERROR",
  "TIMEOUT",
  "OFFLINE",
];

router.post(
  "/login-event",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("portal").isString().withMessage("Portal is required"),
    body("failureReason").isString().withMessage("Failure reason is required"),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    // Simple IP rate limiter
    const ip = req.headers["x-forwarded-for"]
      ? String(req.headers["x-forwarded-for"]).split(",")[0].trim()
      : req.ip;
    const now = Date.now();
    const entry = loginEventIpMap.get(ip);
    if (entry && now - entry.start < LOGIN_EVENT_WINDOW_MS) {
      if (entry.count >= LOGIN_EVENT_RATE_LIMIT) {
        return res
          .status(429)
          .json({
            success: false,
            error: "Too many reports. Please try again later.",
          });
      }
      entry.count++;
    } else {
      loginEventIpMap.set(ip, { start: now, count: 1 });
    }
    // Cleanup old entries periodically
    if (loginEventIpMap.size > 10000) {
      for (const [key, val] of loginEventIpMap) {
        if (now - val.start > LOGIN_EVENT_WINDOW_MS)
          loginEventIpMap.delete(key);
      }
    }

    const { email, portal, failureReason, failureDetail, deviceInfo } =
      req.body;

    // Only allow known client-side failure reasons
    const reason = ALLOWED_CLIENT_REASONS.includes(failureReason)
      ? failureReason
      : "CLIENT_ERROR";

    logLoginAttempt({
      email,
      status: "FAILED",
      failureReason: reason,
      failureDetail:
        typeof failureDetail === "string" ? failureDetail.slice(0, 500) : null,
      portal: portal || "unknown",
      source: "client",
      deviceInfo:
        deviceInfo && typeof deviceInfo === "object" ? deviceInfo : null,
      req,
    });

    res.json({ success: true, message: "Login event recorded" });
  }),
);

module.exports = router;
