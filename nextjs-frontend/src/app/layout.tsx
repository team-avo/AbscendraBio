import type { Metadata } from "next";
import { buildMetadataForWebPage } from "@/lib/seo";
import { Geist, Geist_Mono, Barlow } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { Toaster } from "@/components/ui/sonner";
import SeoScripts from "@/components/seo/scripts";
import { CartProvider } from "@/contexts/cart-context";
import { GooglePlacesProvider } from "@/contexts/google-places-context";
import { Suspense } from "react";
import GlobalFallback from "@/components/ui/global-fallback";
import { PendingApprovalModal } from "@/components/auth/PendingApprovalModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-barlow",
});

export async function generateMetadata(): Promise<Metadata> {
  const base = await buildMetadataForWebPage({});
  return {
    ...base,
    icons: {
      icon: "/favicon.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} antialiased`}
      >
        {/* SEO/Analytics scripts pulled from DB settings */}
        <SeoScripts />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <CartProvider>
              <GooglePlacesProvider>
                <Suspense fallback={<GlobalFallback />}>{children}</Suspense>
              </GooglePlacesProvider>
              <Toaster />
              <PendingApprovalModal />
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
