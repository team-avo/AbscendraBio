const express = require('express');
const { body } = require('express-validator');
const prisma = require('../prisma/client');
const validateRequest = require('../middleware/validateRequest');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission, optionalAuth } = require('../middleware/auth');
const { sendSms } = require('../utils/smsService');

const router = express.Router();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

// Request OTP to verify a customer's mobile number
router.post(
  '/request',
  optionalAuth,
  [
    body('customerId').notEmpty().withMessage('customerId is required'),
    body('mobile').optional().isString(),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customerId, mobile } = req.body;

    // Only the customer themself or staff with CUSTOMERS:UPDATE can request
    const user = req.user;
    if (!user || (user.role === 'CUSTOMER' && user.customerId !== customerId)) {
      try {
        await requirePermission('CUSTOMERS', 'UPDATE')(req, res, () => { });
      } catch {
        return; // responded already
      }
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const targetMobile = mobile || customer.mobile;
    if (!targetMobile) {
      return res.status(400).json({ success: false, error: 'Mobile number is required' });
    }

    // Basic rate limit per customer: allow once per 60 seconds
    const existing = await prisma.mobileVerificationCode.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      const nextAllowed = new Date(existing.lastSentAt.getTime() + 60 * 1000);
      if (nextAllowed > new Date()) {
        return res.status(429).json({ success: false, error: 'Please wait before requesting another code' });
      }
    }

    const code = generateCode();
    const expiresAt = addMinutes(new Date(), 10);

    // Store OTP record
    await prisma.mobileVerificationCode.create({
      data: {
        customerId,
        mobile: targetMobile,
        code,
        expiresAt,
        lastSentAt: new Date(),
      },
    });

    // Send SMS via Twilio
    const smsBody = `Your Centre Labs verification code is ${code}. It expires in 10 minutes.`;
    try {
      await sendSms(targetMobile, smsBody);
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Failed to send SMS', details: String(e?.message || e) });
    }

    res.json({ success: true, message: 'Code sent successfully' });
  })
);

// Verify Code for customer's mobile number
router.post(
  '/verify',
  optionalAuth,
  [
    body('customerId').notEmpty().withMessage('customerId is required'),
    body('code').notEmpty().withMessage('code is required'),
    validateRequest,
  ],
  asyncHandler(async (req, res) => {
    const { customerId, code } = req.body;

    // Only the customer themself or staff with CUSTOMERS:UPDATE can verify
    const user = req.user;
    if (!user || (user.role === 'CUSTOMER' && user.customerId !== customerId)) {
      try {
        await requirePermission('CUSTOMERS', 'UPDATE')(req, res, () => { });
      } catch {
        return;
      }
    }

    const otp = await prisma.mobileVerificationCode.findFirst({
      where: { customerId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) {
      return res.status(400).json({ success: false, error: 'No active code. Please request a new one.' });
    }

    if (otp.expiresAt <= new Date()) {
      return res.status(400).json({ success: false, error: 'Code expired. Please request a new one.' });
    }

    // Increment attempts and verify
    const attempts = (otp.attempts || 0) + 1;
    if (attempts > 5) {
      await prisma.mobileVerificationCode.update({ where: { id: otp.id }, data: { attempts } });
      return res.status(429).json({ success: false, error: 'Too many attempts. Please request a new code.' });
    }

    if (otp.code !== String(code).trim()) {
      await prisma.mobileVerificationCode.update({ where: { id: otp.id }, data: { attempts } });
      return res.status(400).json({ success: false, error: 'Invalid code. Please try again.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.mobileVerificationCode.update({ where: { id: otp.id }, data: { usedAt: new Date(), attempts } });
      await tx.customer.update({ where: { id: customerId }, data: { mobileVerified: true } });
    });

    res.json({ success: true, message: 'Mobile number verified successfully' });
  })
);

module.exports = router;


