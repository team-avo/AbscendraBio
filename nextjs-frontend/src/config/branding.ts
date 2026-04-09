/**
 * Centralized branding configuration.
 * Swap this file to rebrand the entire frontend for a different company.
 */
export const branding = {
  name: "Ascendra Bio",
  logoSrc: "/logo.png",
  tagline: "Providing science backed solutions for medical providers.",
  headline: "Physician-Grade Peptides, Delivered Next Day.",
  subheadline:
    "99%+ purity, COA-verified peptides manufactured in America — trusted by physicians, medspas, and clinics nationwide.",
  eyebrow: "PEPTIDE SUPPLIER FOR PHYSICIANS",

  // Colors extracted from the actual logo (/public/logo.png)
  colors: {
    navy: "#1B2D4F",
    steelBlue: "#3A6FA0",
    lightSteel: "#7EB3D8",
    dark: "#070B14",
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
