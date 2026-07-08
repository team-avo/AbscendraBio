"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import GlobalHeader from "@/components/ui/GlobalHeader";
import Footer from "@/components/landing/Footer";
import FooterBlue from "@/components/landing/FooterBlue";

/**
 * Routes that use DashboardLayout (admin sidebar).
 * The GlobalHeader and Footer should NOT render on these pages.
 */
const ADMIN_ROUTE_PREFIXES = [
  "/admin",
  "/admin-dashboard",
  "/lot-management",
  "/margin-forecaster",
  "/orders",
  "/products",
  "/wholesale-pricing",
  "/customers",
  "/analytics",
  "/settings",
  "/users",
  "/coupons",
  "/payments",
  "/sales-manager",
  "/sales-managers",
  "/assign-customers",
  "/inventory",
  "/third-party-testing",
  "/content",
  "/shipping",
  "/marketing",
  "/bulk-quotes",
  "/tier-upgrades",
  "/debug",
];

function useIsAdminPage() {
  const pathname = usePathname();
  return ADMIN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

/** Renders GlobalHeader only on non-admin (storefront) pages. */
export function ConditionalStorefrontHeader() {
  const isAdmin = useIsAdminPage();
  if (isAdmin) return null;
  return (
    <Suspense fallback={null}>
      <GlobalHeader />
    </Suspense>
  );
}

/** Renders Footer only on non-admin (storefront) pages. */
export function ConditionalStorefrontFooter() {
  const isAdmin = useIsAdminPage();
  const pathname = usePathname();
  if (isAdmin) return null;
  if (pathname === "/bluelanding") return <FooterBlue />;
  return <Footer />;
}
