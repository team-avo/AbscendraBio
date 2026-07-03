import Script from "next/script";

// GoHighLevel / LeadConnector chat widget. Embedded site-wide so it is live on
// the public site, which the GHL "Quick" A2P 10DLC registration validates.
// Widget id comes from the Ascendra GHL account (Settings -> A2P quick setup).
const WIDGET_ID = "6a46bf1beacf7e67b994a190";

export default function LeadConnectorChat() {
  return (
    <Script
      src="https://widgets.leadconnectorhq.com/loader.js"
      data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
      data-widget-id={WIDGET_ID}
      data-source="WEB_USER"
      strategy="afterInteractive"
    />
  );
}
