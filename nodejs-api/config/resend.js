const { Resend } = require('resend');

// Brand-aware Resend clients. Each Resend account verifies exactly ONE domain on the free tier, so
// the two storefronts use two separate accounts/keys:
//   - Ascendra Bio  -> RESEND_API_KEY          (ascendrabio.com verified)   [default]
//   - Lineará       -> RESEND_API_KEY_LINEARA  (lineara.co verified)
// Sending FROM a domain requires the key of the account that verified it, so we cannot just swap the
// `from` address on one client — we must pick the client that owns the domain.

const ascendraKey = process.env.RESEND_API_KEY;
const linearaKey = process.env.RESEND_API_KEY_LINEARA;

if (!ascendraKey) {
    console.warn('[ResendConfig] Warning: RESEND_API_KEY is not set. Email services will be limited.');
}
if (!linearaKey) {
    console.warn('[ResendConfig] Warning: RESEND_API_KEY_LINEARA is not set. Lineará-brand email will fall back to the Ascendra sender.');
}

const ascendra = new Resend(ascendraKey || 'placeholder_for_type_safety');
const lineara = linearaKey ? new Resend(linearaKey) : null;

// Pick the Resend client for a brand. Unknown/absent brand -> Ascendra (the default). Lineará falls
// back to the Ascendra client only if its key is missing, so email keeps flowing (just Ascendra-sent).
function getClient(brand) {
    if (brand === 'lineara' && lineara) return lineara;
    return ascendra;
}

// Backward compatible: the module is still the Ascendra client (existing `resend.emails.send(...)`
// callers are unchanged). Brand-aware callers use `require('../config/resend').getClient(brand)`.
module.exports = ascendra;
module.exports.getClient = getClient;
module.exports.ascendra = ascendra;
module.exports.lineara = lineara;
