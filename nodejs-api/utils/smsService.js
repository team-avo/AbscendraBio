const twilio = require('twilio');

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  try {
    return twilio(accountSid, authToken);
  } catch {
    return null;
  }
}

async function sendSms(to, body) {
  const client = getTwilioClient();
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!client) throw new Error('SMS provider not configured');
  if (!from && !messagingServiceSid) throw new Error('Missing TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID');

  const createPayload = messagingServiceSid
    ? { messagingServiceSid, to, body }
    : { from, to, body };

  try {
    const res = await client.messages.create(createPayload);
    return res?.sid;
  } catch (e) {
    // Surface Twilio error message for easier debugging
    const msg = e?.message || String(e);
    throw new Error(msg);
  }
}

module.exports = { sendSms };


