/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["country-state-city"],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "centre-research.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "kosmetista.in",
      },
      {
        protocol: "https",
        hostname: "via.placeholder.com",
      },
      {
        protocol: "https",
        hostname: "peptide.stmin.dev",
      },
      {
        protocol: "https",
        hostname: "peptide-bucket.s3.ap-south-1.amazonaws.com",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api",
  },
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
};

module.exports = nextConfig;
