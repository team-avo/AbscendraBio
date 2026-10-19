"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/cart-context";
import { useAuth } from "@/contexts/auth-context";

/* /landing/checkout/guest — GUEST checkout (no account). The storefront is open (Phase A); this is
   the no-account ordering path (Phase B). Collects email + name + shipping address + payment method
   and posts to /api/guest-order (server route → backend secret-gated /api/orders/guest). A signed-in
   customer is redirected to the normal account checkout. The backend is price-authoritative. */

type Payment = "zelle" | "wire";

const money = (n: number) => `$${n.toFixed(2)}`;

export default function GuestCheckoutPage() {
  const router = useRouter();
  const { items, total, clear } = useCart();
  const { isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [institution, setInstitution] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [statev, setStatev] = useState("");
  const [zip, setZip] = useState("");
  const [payment, setPayment] = useState<Payment>("zelle");
  const [ack, setAck] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: string | null; payment: Payment } | null>(null);

  // A signed-in customer should use the normal (account) checkout.
  useEffect(() => {
    if (isAuthenticated && user?.role === "CUSTOMER" && user?.customerId) {
      router.replace("/landing/checkout");
    }
  }, [isAuthenticated, user, router]);

  const canSubmit = useMemo(
    () =>
      !!email.trim() &&
      !!firstName.trim() &&
      !!lastName.trim() &&
      !!street.trim() &&
      !!city.trim() &&
      !!statev.trim() &&
      !!zip.trim() &&
      ack &&
      items.length > 0 &&
      !submitting,
    [email, firstName, lastName, street, city, statev, zip, ack, items.length, submitting],
  );

  async function placeOrder() {
    if (!canSubmit) return;
    setSubmitting(true);
    setMsg(null);
    setAccountExists(false);
    try {
      const res = await fetch("/api/guest-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          shipping: { institution: institution.trim(), street: street.trim(), city: city.trim(), state: statev.trim(), zip: zip.trim() },
          items: items.map((it) => ({
            variantId: it.variantId,
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice ?? (it as any)?.variant?.salePrice ?? (it as any)?.variant?.regularPrice ?? 0),
          })),
          payment,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        await clear().catch(() => {});
        setPlaced({ orderNumber: data.data?.orderNumber ?? null, payment });
        return;
      }
      if (res.status === 409 || data?.code === "ACCOUNT_EXISTS") {
        setAccountExists(true);
        setMsg(data?.message ?? "You already have an account for this email. Please sign in to place your order.");
      } else {
        setMsg(data?.message ?? "We couldn't place your order. Please try again.");
      }
    } catch {
      setMsg("Could not reach the order service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success view ──
  if (placed) {
    return (
      <div className="force-light min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 py-14">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5A9ADA] mb-3">Order placed</p>
          <h1 className="text-3xl font-black text-[#043061] tracking-tight">Thank you — your order is in.</h1>
          {placed.orderNumber ? (
            <p className="mt-3 text-gray-600">
              Your order number is <b className="text-[#043061]">{placed.orderNumber}</b>. Keep it handy for your payment.
            </p>
          ) : (
            <p className="mt-3 text-gray-600">Your order has been placed. A confirmation with your order number is on its way to your email.</p>
          )}

          <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            {placed.payment === "zelle" ? (
              <>
                <h2 className="text-sm font-black uppercase tracking-widest text-[#043061]">Zelle Payment Instructions</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Recipient</dt><dd className="font-semibold text-right">ASCENDRA BIO, LLC</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Zelle handle</dt><dd className="font-semibold text-right">ascendrabio</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Email</dt><dd className="font-semibold text-right">accounts@ascendrabio.com</dd></div>
                </dl>
                <p className="mt-4 text-xs text-gray-500">Order processing begins once your payment confirmation is received.</p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-black uppercase tracking-widest text-[#043061]">ACH / Wire Transfer Instructions</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Company</dt><dd className="font-semibold text-right">ASCENDRA BIO, LLC</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Account #</dt><dd className="font-semibold text-right tabular-nums">2909225805</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Routing #</dt><dd className="font-semibold text-right tabular-nums">322271627</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-gray-500">Email</dt><dd className="font-semibold text-right">accounts@ascendrabio.com</dd></div>
                </dl>
                <p className="mt-4 text-xs text-gray-500">Once the transfer is confirmed, email a screenshot to accounts@ascendrabio.com.</p>
              </>
            )}
          </div>

          <p className="mt-6 text-sm text-gray-500">We've also emailed these details to you.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/landing/products" className="inline-flex items-center rounded-xl bg-[#043061] hover:bg-[#0b4f96] text-white px-6 py-3 text-sm font-bold transition-colors">
              Continue browsing
            </Link>
            <Link href="/login?create=1" className="inline-flex items-center rounded-xl border border-gray-200 hover:bg-gray-50 text-[#043061] px-6 py-3 text-sm font-semibold transition-colors">
              Create an account to track this order
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty cart ──
  if (items.length === 0) {
    return (
      <div className="force-light min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-5 sm:px-6 py-16 text-center">
          <h1 className="text-2xl font-black text-[#043061]">Your cart is empty</h1>
          <p className="mt-3 text-gray-500">Add research materials from the catalogue to check out.</p>
          <Link href="/landing/products" className="mt-6 inline-flex items-center rounded-xl bg-[#043061] hover:bg-[#0b4f96] text-white px-6 py-3 text-sm font-bold transition-colors">
            Browse the catalogue
          </Link>
        </div>
      </div>
    );
  }

  const field = "w-full h-11 rounded-xl border border-gray-200 px-3.5 text-sm text-[#0b233b] outline-none focus:border-[#5A9ADA] focus:ring-2 focus:ring-[#5A9ADA]/20 transition";
  const label = "block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5";

  return (
    <div className="force-light min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5A9ADA] mb-2">Checkout</p>
          <h1 className="text-3xl font-black text-[#043061] tracking-tight">Guest checkout</h1>
          <p className="mt-2 text-sm text-gray-500">
            Checking out as a guest. Already have an account?{" "}
            <Link href="/login?next=/landing/checkout" className="text-[#5A9ADA] font-semibold hover:underline">Sign in</Link>.
          </p>

          <section className="mt-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#043061] mb-4">Your details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className={label}>Email (for order updates)</label><input type="email" autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className={label}>First name</label><input type="text" autoComplete="given-name" className={field} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div><label className={label}>Last name</label><input type="text" autoComplete="family-name" className={field} value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#043061] mb-4">Shipping address</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className={label}>Institution / recipient (optional)</label><input type="text" autoComplete="organization" className={field} value={institution} onChange={(e) => setInstitution(e.target.value)} /></div>
              <div className="sm:col-span-2"><label className={label}>Street address (no PO boxes)</label><input type="text" autoComplete="address-line1" className={field} value={street} onChange={(e) => setStreet(e.target.value)} /></div>
              <div><label className={label}>City</label><input type="text" autoComplete="address-level2" className={field} value={city} onChange={(e) => setCity(e.target.value)} /></div>
              <div><label className={label}>State</label><input type="text" autoComplete="address-level1" className={field} value={statev} onChange={(e) => setStatev(e.target.value)} /></div>
              <div><label className={label}>ZIP</label><input type="text" autoComplete="postal-code" className={field} value={zip} onChange={(e) => setZip(e.target.value)} /></div>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-[#043061] mb-4">Payment method</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {([["zelle", "Zelle", "Same-day · pay after you order"], ["wire", "Bank / ACH wire", "1–2 business days · pay after you order"]] as const).map(([val, title, note]) => (
                <label key={val} className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${payment === val ? "border-[#5A9ADA] bg-[#5A9ADA]/5" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="pay" className="mt-1" checked={payment === val} onChange={() => setPayment(val)} />
                  <span><span className="block font-bold text-[#043061] text-sm">{title}</span><span className="block text-xs text-gray-500">{note}</span></span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">Payment is confirmed manually. Your order is placed now; the payment instructions appear on the next screen and are emailed to you.</p>
          </section>

          <label className="mt-8 flex items-start gap-3 text-sm text-gray-600">
            <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            I confirm this order is acquired solely for lawful laboratory research — not for human or veterinary use.
          </label>

          {msg ? (
            <p className="mt-5 text-sm font-semibold text-red-600" role="status">
              {msg}
              {accountExists ? (<> {" "}<Link href="/login?next=/landing/checkout" className="text-[#5A9ADA] underline">Sign in →</Link></>) : null}
            </p>
          ) : null}

          <button
            type="button"
            onClick={placeOrder}
            disabled={!canSubmit}
            className="mt-6 w-full h-12 rounded-2xl bg-[#043061] hover:bg-[#0b4f96] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[11px] transition-colors"
          >
            {submitting ? "Placing order…" : "Place order →"}
          </button>
        </div>

        {/* Order summary */}
        <aside className="lg:sticky lg:top-24 h-fit rounded-2xl border border-gray-200 bg-gray-50 p-5">
          <h2 className="text-sm font-black uppercase tracking-widest text-[#043061] mb-4">Order summary</h2>
          <ul className="space-y-3">
            {items.map((it) => {
              const v: any = (it as any).variant;
              const name = v?.product?.name || "Item";
              const size = v?.name || v?.size || "";
              return (
                <li key={it.variantId} className="flex justify-between gap-3 text-sm">
                  <span className="text-gray-700"><b className="text-[#043061]">{name}</b>{size ? <span className="text-gray-400"> · {size}</span> : null}<span className="text-gray-400"> × {it.quantity}</span></span>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 pt-4 border-t border-gray-200 flex justify-between items-baseline">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Total</span>
            <span className="text-xl font-black text-[#043061] tabular-nums">{money(total)}</span>
          </div>
          <p className="mt-2 text-[11px] text-gray-400">Shipping calculated after your order. Final total is confirmed on your order.</p>
        </aside>
      </div>
    </div>
  );
}
