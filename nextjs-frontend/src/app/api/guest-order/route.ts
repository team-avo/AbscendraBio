import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

/* POST /api/guest-order — server-side proxy for GUEST checkout on the Ascendra storefront.

   The Ascendra frontend is a client-side SPA, so it cannot hold the backend's guest-order secret.
   This Next.js route runs server-side: it holds GUEST_ORDER_API_SECRET and forwards to the backend's
   secret-gated POST /api/orders/guest. The backend is PRICE-AUTHORITATIVE (recomputes from the
   variant) and creates a guest Customer + order. Rate-limited per IP as a basic abuse guard; a
   Turnstile check is added once a site key is configured (TODO(ASCENDRA-TURNSTILE)). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAYMENT_MAP: Record<string, "ZELLE" | "BANK_WIRE"> = { zelle: "ZELLE", wire: "BANK_WIRE" };

// Best-effort in-memory per-IP rate limit (the backend endpoint is also secret-gated).
const HITS = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string, max = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const e = HITS.get(ip);
  if (!e || now - e.t > windowMs) {
    HITS.set(ip, { n: 1, t: now });
    return false;
  }
  e.n += 1;
  return e.n > max;
}

type Body = {
  email?: string;
  firstName?: string;
  lastName?: string;
  shipping?: { institution?: string; street?: string; city?: string; state?: string; zip?: string };
  items?: { variantId: string; quantity: number; unitPrice?: number | string }[];
  payment?: "zelle" | "wire";
};

export async function POST(req: Request) {
  const secret = process.env.GUEST_ORDER_API_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, message: "Guest checkout isn't available right now." }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ success: false, message: "Too many attempts. Please wait a moment and try again." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const s = body?.shipping;
  if (
    !body ||
    !body.email ||
    !body.firstName ||
    !body.lastName ||
    !s?.street ||
    !s.city ||
    !s.state ||
    !s.zip ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    !body.payment
  ) {
    return NextResponse.json({ success: false, message: "Some checkout details are missing or invalid." }, { status: 400 });
  }

  const address = {
    firstName: body.firstName,
    lastName: body.lastName,
    company: s.institution || null,
    address1: s.street,
    address2: null,
    city: s.city,
    state: s.state,
    postalCode: s.zip,
    country: "US",
    phone: null,
  };

  // Backend guest-order payload (brand omitted → Ascendra default). Backend recomputes prices.
  const payload = {
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
    billingAddress: address,
    shippingAddress: address,
    items: body.items.map((it) => ({
      variantId: it.variantId,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice || 0).toFixed(2),
    })),
    selectedPaymentType: PAYMENT_MAP[body.payment] || "ZELLE",
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/orders/guest`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-guest-order-secret": secret },
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json({ success: false, message: "Could not reach the order service. Please try again." }, { status: 502 });
  }

  const data = (await res.json().catch(() => null)) as any;

  // Email already belongs to an account → steer them to sign in (no order placed).
  if (res.status === 409 || data?.code === "ACCOUNT_EXISTS") {
    return NextResponse.json(
      { success: false, code: "ACCOUNT_EXISTS", message: "You already have an account for this email. Please sign in to place your order." },
      { status: 409 },
    );
  }
  if (!res.ok || !data?.success) {
    return NextResponse.json(
      { success: false, message: "We couldn't place your order just now. Please try again, or contact us if it keeps happening." },
      { status: res.status >= 400 && res.status < 500 ? res.status : 502 },
    );
  }

  const d = data.data ?? data;
  const orderObj = d?.order ?? d;
  const orderNumber = orderObj?.orderNumber ?? d?.orderNumber ?? null;
  return NextResponse.json({ success: true, data: { orderNumber, paymentType: body.payment } });
}
