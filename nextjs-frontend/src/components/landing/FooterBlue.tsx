"use client";

import { ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Barlow } from "next/font/google";
import { usePathname } from "next/navigation";
import logger from '@/lib/logger';

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export function FooterBlue() {
  const pathname = usePathname();
  const isDashboardRoute = pathname?.startsWith('/admin') ||
                          pathname?.startsWith('/dashboard') ||
                          pathname?.startsWith('/account') ||
                          pathname?.startsWith('/inventory') ||
                          pathname?.startsWith('/orders') ||
                          (pathname?.startsWith('/products') && !pathname?.startsWith('/landing/products')) ||
                          pathname?.startsWith('/customers') ||
                          pathname?.startsWith('/analytics') ||
                          pathname?.startsWith('/marketing') ||
                          pathname?.startsWith('/content') ||
                          pathname?.startsWith('/payments') ||
                          pathname?.startsWith('/shipping') ||
                          pathname?.startsWith('/settings');

  if (isDashboardRoute) return null;

  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [footerSettings, setFooterSettings] = useState<any | null>(null);
  const [inquiryEmail, setInquiryEmail] = useState<string>("");
  const [isSendingInquiry, setIsSendingInquiry] = useState<boolean>(false);

  useEffect(() => {
    const fetchTopProducts = async () => {
      try {
        const response = await api.getStorefrontProducts({ page: 1, limit: 4 });
        if (response.success && response.data?.products) {
          setTopProducts(response.data.products.slice(0, 4));
        }
      } catch (error) {
        logger.error("Failed to fetch top products for footer:", { error: error });
      }
    };
    const fetchFooterSettings = async () => {
      try {
        const r = await api.getPublicFooter();
        if (r.success) setFooterSettings(r.data || null);
      } catch { }
    };

    fetchTopProducts();
    fetchFooterSettings();
  }, []);

  const handleInquiry = async () => {
    const email = (inquiryEmail || "").trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      try { (await import("sonner")).toast?.error?.("Please enter a valid email"); } catch { }
      return;
    }
    try {
      setIsSendingInquiry(true);
      const r = await api.sendInquiry(email);
      if (r.success) {
        try { (await import("sonner")).toast?.success?.("Inquiry sent. We will contact you soon."); } catch { }
        setInquiryEmail("");
      } else {
        try { (await import("sonner")).toast?.error?.(r.error || "Failed to send inquiry"); } catch { }
      }
    } catch (e: any) {
      try { (await import("sonner")).toast?.error?.(e?.message || "Failed to send inquiry"); } catch { }
    } finally {
      setIsSendingInquiry(false);
    }
  };

  return (
    <footer className={`relative bg-[#5A9ADA] text-white overflow-hidden ${barlow.className}`}>

      {/* ── CTA Banner ── */}
      <div className="relative border-b border-white/[0.15]">
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="max-w-lg text-center lg:text-left">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
                Ready to elevate your research?
              </h2>
              <p className="text-sm text-white/80 font-medium leading-relaxed">
                Join leading clinics and research facilities partnering with Ascendra Bio for superior outcomes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto max-w-md">
              <Input
                placeholder="Enter your email"
                className="bg-white/[0.12] border-white/[0.20] text-white placeholder:text-white/50 rounded-xl px-5 h-12 text-sm focus:ring-1 focus:ring-white/40 focus:border-white/40"
                value={inquiryEmail}
                onChange={(e) => setInquiryEmail(e.target.value)}
                type="email"
              />
              <Button
                onClick={handleInquiry}
                disabled={isSendingInquiry}
                className="bg-white hover:bg-gray-100 text-[#5A9ADA] border-0 rounded-xl px-6 h-12 text-sm font-bold tracking-wide transition-all duration-200 shrink-0"
              >
                {isSendingInquiry ? 'Sending...' : 'Get Started'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">{footerSettings?.siteTitle || 'ASCENDRA BIO'}</span>
            </div>
            <p className="text-sm text-white/85 leading-relaxed max-w-[260px]">
              {footerSettings?.siteDescription || '99%+ purity research peptides. COA-verified, GMP manufactured, trusted by researchers nationwide.'}
            </p>
          </div>

          {/* Products */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70 mb-5">
              {footerSettings?.sections?.[0]?.title || 'Products'}
            </h4>
            <ul className="space-y-3">
              {topProducts.length > 0 ? (
                topProducts.map((product) => (
                  <li key={product.id}>
                    <Link href={`/landing/products/${product.id}`} className="text-sm text-white/80 hover:text-white transition-colors duration-200">
                      {product.name}
                    </Link>
                  </li>
                ))
              ) : (
                ['BPC-157', 'Semaglutide', 'Tirzepatide', 'AOD-9604'].map((name) => (
                  <li key={name}>
                    <Link href="/landing/products" className="text-sm text-white/80 hover:text-white transition-colors duration-200">
                      {name}
                    </Link>
                  </li>
                ))
              )}
              <li>
                <Link href="/landing/products" className="text-sm text-white font-semibold hover:text-white/80 transition-colors duration-200">
                  View All &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70 mb-5">Resources</h4>
            <ul className="space-y-3">
              {[
                { title: 'Lab Reports', href: '/landing/third-party-testing' },
                { title: 'Quality Analysis', href: '/landing/third-party-testing' },
                { title: 'Clinical Inquiry', href: '/landing/contact' },
                { title: 'About Us', href: '/landing/about' },
              ].map((lnk, i) => (
                <li key={i}>
                  <Link href={lnk.href} className="text-sm text-white/80 hover:text-white transition-colors duration-200">{lnk.title}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Regulatory */}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/70 mb-5">Regulatory</h4>
            <div className="bg-white/[0.10] border border-white/[0.18] rounded-xl p-5">
              <p className="text-sm text-white/90 leading-relaxed">
                Products are intended for <strong className="text-white">professional use only</strong>. Not for human consumption. Use exclusively in laboratory or clinical research settings by licensed researchers.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="border-t border-white/[0.15]">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-[11px] text-white/70 tracking-wide">
            &copy; {new Date().getFullYear()} Ascendra Bio Sciences. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/landing/privacy" className="text-[11px] text-white/70 hover:text-white transition-colors">Privacy</Link>
            <Link href="/landing/terms" className="text-[11px] text-white/70 hover:text-white transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default FooterBlue;
