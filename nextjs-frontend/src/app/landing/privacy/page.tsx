import Link from "next/link";
import { Barlow } from "next/font/google";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata = { title: "Privacy Policy | Ascendra Bio" };

export default function PrivacyPage() {
  return (
    <div className={`min-h-screen bg-white ${barlow.className}`}>
      <div className="max-w-3xl mx-auto px-6 py-20">
        <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-[#4D7DF2] hover:underline mb-8 block">
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-black tracking-tight text-[#070B14] mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: June 26, 2026</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-8">
          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">1. Information We Collect</h2>
            <p className="leading-relaxed">
              Ascendra Bio Sciences collects information you provide directly, including name, email address, shipping
              address, phone number, and payment information when you place an order. We also automatically collect
              certain technical information such as IP address, browser type, and pages visited when you use our website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">2. How We Use Your Information</h2>
            <p className="leading-relaxed">We use the information we collect to:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Respond to inquiries and provide customer support</li>
              <li>Improve our website and services</li>
              <li>Comply with applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">3. SMS / Text Message Communications</h2>
            <p className="leading-relaxed">
              If you opt in, Ascendra Bio Sciences may send text (SMS) messages to the mobile number you provide. We
              collect this consent through a clear opt in on our account signup form and on your customer profile, with
              separate consent for two message types:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li><strong>Account and order messages</strong>, such as order confirmations, payment reminders, and shipping updates.</li>
              <li><strong>Marketing and promotional messages.</strong> Consent to marketing messages is never a condition of any purchase.</li>
            </ul>
            <p className="leading-relaxed mt-3">
              Message frequency varies. Message and data rates may apply. You can reply <strong>HELP</strong> for help and
              <strong> STOP</strong> to unsubscribe at any time; replying STOP opts you out and we will not send you further
              messages.
            </p>
            <p className="leading-relaxed mt-3">
              We do not share your mobile number or your SMS consent with any third parties or affiliates for their own
              marketing or promotional purposes. Mobile information is shared only with the messaging providers that help us
              deliver these texts. See our{" "}
              <Link href="/landing/terms" className="text-[#4D7DF2] hover:underline">Terms of Service</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">4. Information Sharing</h2>
            <p className="leading-relaxed">
              We do not sell, trade, or rent your personal information to third parties. We may share information with
              trusted service providers who assist us in operating our website and conducting our business, provided they
              agree to keep this information confidential. We may also disclose information when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">5. Data Security</h2>
            <p className="leading-relaxed">
              We implement industry-standard security measures to protect your personal information. All payment
              transactions are encrypted using SSL technology. However, no method of internet transmission is 100%
              secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">6. Cookies</h2>
            <p className="leading-relaxed">
              Our website uses cookies to enhance your browsing experience and analyze website traffic. You can instruct
              your browser to refuse cookies, but some portions of our site may not function properly without them.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">7. Your Rights</h2>
            <p className="leading-relaxed">
              You have the right to access, correct, or delete the personal information we hold about you. To exercise
              these rights, please contact us at{" "}
              <a href="mailto:privacy@ascendrabio.com" className="text-[#4D7DF2] hover:underline">
                privacy@ascendrabio.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#070B14] mb-3">8. Contact Us</h2>
            <p className="leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at{" "}
              <a href="mailto:privacy@ascendrabio.com" className="text-[#4D7DF2] hover:underline">
                privacy@ascendrabio.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
