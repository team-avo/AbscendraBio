/**
 * Register (or list) the ShipStation webhook that points at our verified
 * public receiver: POST /api/webhooks/shipstation
 *
 * ShipStation must reach the URL over public HTTPS, so this is a go-live step
 * (use your production domain, or an ngrok https tunnel for local testing —
 * localhost is NOT reachable by ShipStation).
 *
 *   List:     node scripts/shipstation-register-webhook.js
 *   Register: node scripts/shipstation-register-webhook.js https://yourdomain.com/api/webhooks/shipstation [event]
 *
 * event defaults to "track" (tracking updates). Other values: rate, batch,
 * carrier_connected, report_complete, order_source_refresh_complete.
 */
require("dotenv").config();
const { ssRequest } = require("../utils/shipstationClient");

(async () => {
  const url = process.argv[2];
  const event = process.argv[3] || "track";

  const list = await ssRequest("GET", "/v2/environment/webhooks");
  console.log("Existing webhooks:", JSON.stringify(list.data, null, 2));

  if (!url) {
    console.log("\nNo URL given — list only. Pass an https URL to register.");
    return;
  }
  if (!url.startsWith("https://")) {
    console.error("❌ URL must be https:// (ShipStation requires TLS).");
    process.exit(1);
  }

  const res = await ssRequest("POST", "/v2/environment/webhooks", { url, event });
  console.log("\n✅ Registered webhook:", JSON.stringify(res.data, null, 2));
})().catch((e) => {
  console.error("❌ Failed:", e.message, e.data || "");
  process.exit(1);
});
