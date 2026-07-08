import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

// Serves Peter's self-contained "Margin & Markup Forecaster" tool. It is a
// standalone HTML app (its own styles, scripts and localStorage), rendered in
// an iframe on /margin-forecaster, which is gated to ADMIN / SUPER_ADMIN by
// ProtectedRoute. The file lives outside /public so it is not trivially
// discoverable, and we mark it noindex. (For a hard server-side lock we would
// serve it from the authenticated backend; noted as a follow-up.)
export const dynamic = "force-dynamic";

const HTML = readFileSync(
  join(process.cwd(), "src/app/margin-forecaster/tool/forecaster.html"),
  "utf8",
);

export async function GET() {
  return new NextResponse(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
    },
  });
}
