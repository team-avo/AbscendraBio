const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

// POST /api/customer-signup-confirmation
router.post('/', async (req, res) => {
  console.log('[customer-signup-confirmation] received', {
    email: req.body?.email,
    firstName: req.body?.firstName,
    lastName: req.body?.lastName,
  });
  try {
    const { email, firstName, middleName, lastName, mobile, companyName, licenseNumber } = req.body || {};

    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Valid customer email is required' });
    }

    const safe = (v) => (typeof v === 'string' ? v : '');

    const html = `
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f7f7f7;">
  <table align="center" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;border:1px solid #eee;margin-top:24px;margin-bottom:24px;">
    <tr>
      <td style="padding:24px;border-bottom:1px solid #eee;text-align:center;">
        <h1 style="margin:0;font-size:22px;color:#111;">Welcome to Centre Labs</h1>
        <p style="margin:8px 0 0;color:#555;">Your account is pending approval</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 12px;color:#111;">Hi ${safe(firstName) || 'Customer'},</p>
        <p style="margin:0 0 16px;color:#333;line-height:1.5;">
          Thank you for creating an account with Centre Labs. Your account is currently pending approval.
          Once approved, you will be able to sign in and access your account. Please keep this email for your records.
        </p>
        <h3 style="margin:0 0 8px;color:#111;">Submitted details</h3>
        <table cellpadding="8" cellspacing="0" width="100%" style="border:1px solid #eee;border-collapse:collapse;">
          ${safe(firstName) ? `<tr style=\"background:#fafafa;\"><td width=\"160\" style=\"font-weight:600;color:#555;border-bottom:1px solid #eee;\">First name</td><td style=\"color:#111;border-bottom:1px solid #eee;\">${safe(firstName)}</td></tr>` : ''}
          ${safe(middleName) ? `<tr><td width=\"160\" style=\"font-weight:600;color:#555;border-bottom:1px solid #eee;\">Middle name</td><td style=\"color:#111;border-bottom:1px solid #eee;\">${safe(middleName)}</td></tr>` : ''}
          ${safe(lastName) ? `<tr style=\"background:#fafafa;\"><td width=\"160\" style=\"font-weight:600;color:#555;border-bottom:1px solid #eee;\">Last name</td><td style=\"color:#111;border-bottom:1px solid #eee;\">${safe(lastName)}</td></tr>` : ''}
          <tr>
            <td width="160" style="font-weight:600;color:#555;border-bottom:1px solid #eee;">Email</td>
            <td style="color:#111;border-bottom:1px solid #eee;">${safe(email)}</td>
          </tr>
          ${safe(companyName) ? `<tr style=\"background:#fafafa;\"><td width=\"160\" style=\"font-weight:600;color:#555;border-bottom:1px solid #eee;\">Company / Practice</td><td style=\"color:#111;border-bottom:1px solid #eee;\">${safe(companyName)}</td></tr>` : ''}
          ${safe(licenseNumber) ? `<tr><td width=\"160\" style=\"font-weight:600;color:#555;border-bottom:1px solid #eee;\">NPI / License</td><td style=\"color:#111;border-bottom:1px solid #eee;\">${safe(licenseNumber)}</td></tr>` : ''}
          ${safe(mobile) ? `<tr${safe(companyName) || safe(licenseNumber) ? '' : ' style="background:#fafafa;"'}><td width=\"160\" style=\"font-weight:600;color:#555;\">Mobile</td><td style=\"color:#111;\">${safe(mobile)}</td></tr>` : ''}
        </table>
        <p style="margin:16px 0 0;color:#333;line-height:1.5;">
          We appreciate your patience. If you have any questions, please reply to this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:16px;text-align:center;color:#888;border-top:1px solid #eee;font-size:12px;">
        © ${new Date().getFullYear()} Centre Labs. All rights reserved.
      </td>
    </tr>
  </table>
</body>`;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: String(process.env.EMAIL_SECURE).toLowerCase() === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@centreresearch.com',
      to: email,
      subject: 'Your Centre Labs account is pending approval',
      html,
    });
    console.log('[customer-signup-confirmation] sent', info?.messageId);
    return res.json({ success: true, message: 'Confirmation email sent', messageId: info?.messageId });
  } catch (error) {
    console.error('Customer signup confirmation failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to send confirmation email' });
  }
});

module.exports = router;
