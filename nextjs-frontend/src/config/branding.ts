/**
 * Centralized branding configuration.
 * Swap this file to rebrand the entire frontend for a different company.
 */
export const branding = {
  name: "Ascendra Bio",
  logoSrc: "/logo.png",
  tagline: "Precision-grade research solutions for professional environments.",
  headline: "99% Purity Peptides, Delivered Next Day.",
  subheadline:
    "COA-verified peptides manufactured in America — trusted by researchers, practitioners, and clinics nationwide.",
  eyebrow: "PREMIUM PEPTIDES FOR RESEARCH",

  // Colors extracted from the actual logo (/public/logo.png)
  colors: {
    navy: "#043061",
    steelBlue: "#5A9ADA",
    lightSteel: "#a9cbeb",
    dark: "#043061",
    darkCard: "#0D1320",
  },

  // Trust metrics shown on the landing page
  stats: [
    { value: "99%+", label: "Purity" },
    { value: "24hr", label: "Shipping" },
    { value: "30+", label: "Peptides" },
    { value: "100+", label: "Providers" },
  ],

  // Navigation links for the landing page
  navLinks: [
    { label: "Products", href: "/landing/products" },
    { label: "3rd Party Testing", href: "/landing/third-party-testing" },
  ],
};
