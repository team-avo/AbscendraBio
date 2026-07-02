import Link from "next/link";
import { Barlow } from "next/font/google";
import { Award, Zap, FlaskConical, ShieldCheck } from "lucide-react";

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export const metadata = { title: "About Us | Ascendra Bio" };

const pillars = [
  { icon: FlaskConical, title: "99%+ Purity", desc: "Every batch undergoes rigorous COA verification with full analytical reports available to all customers." },
  { icon: ShieldCheck, title: "GMP Manufactured", desc: "Manufactured under strict Good Manufacturing Practice standards in American facilities." },
  { icon: Award, title: "Third-Party Tested", desc: "Endotoxicity, net peptide content, and sterility tested by independent laboratories." },
  { icon: Zap, title: "24hr Shipping", desc: "Overnight delivery available on every order. Nationwide coverage with cold-chain logistics." },
];

export default function AboutPage() {
  return (
    <div className={`min-h-screen bg-white ${barlow.className}`}>
      {/* Hero */}
      <div className="bg-[#043061] text-white py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-[11px] font-bold uppercase tracking-widest text-[#5A9ADA] hover:underline mb-8 block">
            ← Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <span className="w-8 h-[1px] bg-[#5A9ADA]" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-[#5A9ADA] uppercase">Our Mission</span>
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-6">About Ascendra Bio</h1>
          <p className="text-lg text-gray-300 leading-relaxed max-w-2xl">
            Ascendra Bio Sciences is a leading supplier of research-grade peptides and biological compounds for
            clinical and academic research. We are committed to delivering the highest purity compounds with
            complete traceability and transparency.
          </p>
        </div>
      </div>

      {/* Mission */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-black text-[#043061] tracking-tight mb-4">Who We Are</h2>
        <p className="text-gray-600 leading-relaxed mb-6">
          Founded by researchers for researchers, Ascendra Bio Sciences was built on a simple principle: the scientific
          community deserves access to the purest, most reliable research compounds available. We partner with GMP-certified
          synthesis labs and subject every batch to comprehensive third-party testing before it reaches our customers.
        </p>
        <p className="text-gray-600 leading-relaxed">
          Our customer base includes licensed physicians, academic research institutions, compounding pharmacies, and clinical
          labs across the United States. We are proud to be a trusted partner in advancing peptide-based research and
          therapeutic development.
        </p>
      </div>

      {/* Pillars */}
      <div className="bg-[#F9FBFF] py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-black text-[#043061] tracking-tight mb-10 text-center">Our Standards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {pillars.map((p, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-7">
                <div className="mb-4 w-11 h-11 rounded-xl bg-[#5A9ADA]/5 border border-[#5A9ADA]/10 flex items-center justify-center">
                  <p.icon className="w-5 h-5 text-[#5A9ADA]" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-[#043061] mb-2">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-black text-[#043061] mb-4">Ready to Partner With Us?</h2>
        <p className="text-gray-500 mb-8">Contact our team to learn more about our products and institutional pricing.</p>
        <Link
          href="/landing/contact"
          className="inline-flex items-center gap-2 bg-[#5A9ADA] hover:bg-[#3f7fc4] text-white px-8 py-4 rounded-xl text-sm font-bold tracking-wide transition-all"
        >
          Get in Touch
        </Link>
      </div>
    </div>
  );
}
