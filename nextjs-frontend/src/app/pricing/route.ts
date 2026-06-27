import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Public wholesale pricing page (prospect facing, no login).
// We serve the self-contained page as is, but inject the prices live from the
// backend in place of the hardcoded DATA array, so prices are always current
// and managed in the admin, never in code. If the backend is unreachable, the
// page still renders with the prices baked into the template as a fallback.
export const dynamic = "force-dynamic";

// Read the template once at module load.
const TEMPLATE = readFileSync(
  join(process.cwd(), "src/app/pricing/template.html"),
  "utf8",
);

const API_BASE =
  process.env.SERVER_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001/api";

export async function GET() {
  let html = TEMPLATE;
  try {
    const res = await fetch(`${API_BASE}/public-pricing/wholesale`, {
      cache: "no-store",
    });
    const json = await res.json();
    if (json?.success && Array.isArray(json.data) && json.data.length) {
      const payload = JSON.stringify(json.data);
      // Replace the single-line `const DATA = [...]` with the live data.
      html = TEMPLATE.replace(
        /const DATA = \[[\s\S]*?\];/,
        () => `const DATA = ${payload};`,
      );
    }
  } catch {
    // Backend unreachable: fall back to the template's baked-in prices.
  }
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
