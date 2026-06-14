export const API_BASE_URL =
    typeof window === "undefined"
        ? process.env.SERVER_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://api:3001/api" // SSR: internal Docker network, else public URL (e.g. Vercel)
        : process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api"; // Browser: public URL
