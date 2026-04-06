const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const prisma = require('../prisma/client');
const logger = require('../utils/logger');

// POST /api/contact-lab
router.post('/', async (req, res) => {
  try {
    const { email, message } = req.body || {};
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Fetch store email from StoreInformation
    const storeInfo = await prisma.storeInformation.findFirst();
    const storeEmail = storeInfo?.email || process.env.ADMIN_EMAIL || 'admin@centreresearch.com';

    const subject = `Lab Contact Request - ${email}`;
    const html = `
      <h1>Lab Contact Request</h1>
      <p><strong>From:</strong> ${email}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space:pre-line;">${message}</p>
    `;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@centreresearch.com',
      to: storeEmail,
      subject,
      html,
    });

    return res.json({ success: true, message: 'Contact request sent successfully' });
  } catch (error) {
    logger.error('Contact Lab send failed', error);
    return res.status(500).json({ success: false, error: 'Failed to send contact request' });
  }
});

module.exports = router;


