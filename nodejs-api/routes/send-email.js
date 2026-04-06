const express = require('express');
const router = express.Router();
const { sendRawEmail } = require('../utils/emailService');

// POST /api/send-email
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body || {};

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const subject = `New inquiry from ${name || email}`;

    const html = `
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f4;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; border: 1px solid #dddddd;">
    
    <!-- Header -->
    <tr>
      <td align="center" bgcolor="#ffffff" style="padding: 40px 0 30px 0; border-bottom: 1px solid #dddddd;">
        <h1 style="color: #333333; margin: 0; font-size: 28px; font-weight: bold;">Centre Labs</h1>
        <p style="color: #555555; font-size: 16px; margin-top: 10px;">New Inquiry</p>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td bgcolor="#ffffff" style="padding: 40px 30px 40px 30px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding-bottom: 20px;">
              <h2 style="color: #333333; margin: 0;">Submitted Details</h2>
            </td>
          </tr>
          
          <!-- Submitted Data Table -->
          <tr>
            <td>
              <table border="0" cellpadding="10" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #eeeeee;">
                ${name ? `
                <tr style="background-color: #f9f9f9;">
                  <td width="150" style="color: #555555; font-weight: bold; border-bottom: 1px solid #eeeeee;">Name</td>
                  <td style="color: #333333; border-bottom: 1px solid #eeeeee;">${name}</td>
                </tr>` : ""}
                ${email ? `
                <tr>
                  <td width="150" style="color: #555555; font-weight: bold; border-bottom: 1px solid #eeeeee;">Email</td>
                  <td style="color: #333333; border-bottom: 1px solid #eeeeee;">${email}</td>
                </tr>` : ""}
                ${phone ? `
                <tr style="background-color: #f9f9f9;">
                  <td width="150" style="color: #555555; font-weight: bold; border-bottom: 1px solid #eeeeee;">Phone</td>
                  <td style="color: #333333; border-bottom: 1px solid #eeeeee;">${phone}</td>
                </tr>` : ""}
                ${message ? `
                <tr>
                  <td width="150" style="color: #555555; font-weight: bold; vertical-align: top;">Message</td>
                  <td style="color: #333333; line-height: 1.5;">${message.replace(/\n/g, '<br>')}</td>
                </tr>` : ""}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
      `;

    // Send the email (queued)
    const result = await sendRawEmail(
      'info@centreresearch.org',
      subject,
      html,
      message // plain text fallback
    );

    return res.json({ success: true, message: 'Email queued successfully', jobId: result.jobId });
  } catch (error) {
    console.error('Send email failed:', error);
    return res.status(500).json({ success: false, error: 'Failed to send email' });
  }
});

module.exports = router;

// Optional test GET handler
router.get('/', (req, res) => {
  return res.json({ message: 'Email API is working', status: 'ready' });
});
