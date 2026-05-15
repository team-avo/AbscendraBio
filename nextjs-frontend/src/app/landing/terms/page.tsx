import Link from "next/link";
import { Barlow } from "next/font/google";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata = { title: "Terms of Service | Ascendra Bio" };

export default function TermsPage() {
  return (
    <div className={`min-h-screen bg-white ${barlow.className}`}>
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-[#4D7DF2] hover:underline mb-8 block">
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-black tracking-tight text-[#070B14] mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: January 1, 2025</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-8">
          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing or using the Ascendra Bio Sciences website and purchasing our products, you agree to be bound
              by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">2. Professional Use Only</h2>
            <p className="leading-relaxed font-semibold text-[#070B14]">
              ALL PRODUCTS SOLD BY ASCENDRA BIO SCIENCES ARE INTENDED FOR PROFESSIONAL USE ONLY.
            </p>
            <p className="leading-relaxed mt-2">
              Products are only to be sold to licensed healthcare providers to be utilized at their discretion in
              accordance with applicable law. These products are not FDA approved and are not intended to diagnose, treat,
              cure, or prevent any medical disease or condition. Not for human consumption except as directed by a
              licensed healthcare professional in a clinical setting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">3. Account Registration</h2>
            <p className="leading-relaxed">
              Access to purchase products requires account registration and verification of professional credentials.
              You are responsible for maintaining the confidentiality of your account credentials and for all activities
              that occur under your account. You must immediately notify us of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">4. Orders and Payment</h2>
            <p className="leading-relaxed">
              All orders are subject to acceptance and availability. We reserve the right to refuse or cancel any order.
              Prices are subject to change without notice. Payment is due at time of order. We accept ACH/bank transfer,
              Zelle, and major credit cards.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">5. Shipping and Returns</h2>
            <p className="leading-relaxed">
              We aim to process and ship all orders within 1–2 business days. Due to the nature of research peptides and
              biological products, all sales are final. Returns are only accepted for products damaged during shipping.
              Contact us within 48 hours of delivery to report damaged items.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">6. Intellectual Property</h2>
            <p className="leading-relaxed">
              All content on this website, including text, images, graphics, and logos, is the property of Ascendra Bio
              Sciences and is protected by applicable intellectual property laws. You may not reproduce, distribute, or
              create derivative works without our express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">7. Limitation of Liability</h2>
            <p className="leading-relaxed">
              Ascendra Bio Sciences shall not be liable for any indirect, incidental, special, or consequential damages
              arising from the use or inability to use our products or services. Our maximum liability is limited to the
              amount paid for the specific product giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">8. Contact</h2>
            <p className="leading-relaxed">
              Questions about these Terms of Service may be directed to{" "}
              <a href="mailto:legal@ascendrabio.com" className="text-[#4D7DF2] hover:underline">
                legal@ascendrabio.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
