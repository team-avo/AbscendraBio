const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
    console.warn('[ResendConfig] Warning: RESEND_API_KEY is not set. Email services will be limited.');
}

const resend = new Resend(apiKey || 'placeholder_for_type_safety');

module.exports = resend;
