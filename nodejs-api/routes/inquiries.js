const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const prisma = require("../prisma/client");

// POST /api/inquiries
router.post("/", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (
      !email ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Valid email is required" });
    }

    // Fetch store email from StoreInformation
    const storeInfo = await prisma.storeInformation.findFirst();
    const storeEmail = storeInfo?.email || process.env.ADMIN_EMAIL || "admin@centreresearch.com";

    // Hardcoded subject and HTML body (no templates)
    const subject = `New Inquiry Received - ${email}`;
    const html = `
      <h1>New Inquiry</h1>
      <p>You have received a new inquiry from: <strong>${email}</strong></p>
      <p>Message:</p>
      <p>I'm interested in Centre Physician Directed. Please contact me with more information about your products and pricing. Thank you.</p>
    `;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || "noreply@centreresearch.com",
      to: storeEmail,
      subject,
      html,
    });

    return res.json({ success: true, message: "Inquiry sent successfully" });
  } catch (error) {
    console.error("Inquiry email failed:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to send inquiry" });
  }
});

module.exports = router;
