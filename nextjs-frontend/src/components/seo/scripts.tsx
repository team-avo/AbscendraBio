import Script from "next/script";
import { getSiteConfig } from "@/lib/seo";
import { sanitizeHtml } from "@/lib/sanitize";

export default async function SeoScripts() {
  const cfg = await getSiteConfig();
  const gaId = (typeof (cfg as any).googleAnalyticsId !== 'undefined' ? (cfg as any).googleAnalyticsId : undefined) as string | undefined;
  const gtmId = (typeof (cfg as any).googleTagManagerId !== 'undefined' ? (cfg as any).googleTagManagerId : undefined) as string | undefined;
  const fbPixelId = (typeof (cfg as any).facebookPixelId !== 'undefined' ? (cfg as any).facebookPixelId : undefined) as string | undefined;

  return (
    <>
      {gtmId ? (
        <>
          <Script id="gtm-script" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${gtmId}');
            `}
          </Script>
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(`
                <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
                height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
              `),
            }}
          />
        </>
      ) : null}

      {gaId ? (
        <>
          <Script
            id="ga-lib"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-config" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}');
            `}
          </Script>
        </>
      ) : null}

      {fbPixelId ? (
        <>
          <Script id="fb-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${fbPixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeHtml(`
                <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${fbPixelId}&ev=PageView&noscript=1" /></noscript>
              `),
            }}
          />
        </>
      ) : null}
    </>
  );
}


