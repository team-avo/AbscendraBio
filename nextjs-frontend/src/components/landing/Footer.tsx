"use client";

import { motion } from "motion/react";
import { Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { Barlow } from "next/font/google";
import { usePathname } from "next/navigation";
import logger from '@/lib/logger';

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export function Footer() {
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
    <footer className="relative bg-[#F9FBFF] overflow-hidden border-t border-blue-50">
      <section className="relative py-20">
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="text-center">
            <div className="bg-white border border-blue-50 shadow-[0_8px_30px_rgba(27,45,79,0.04)] rounded-[3rem] p-12 mb-12">
              <motion.h2 className={`text-5xl sm:text-6xl font-black text-[#070B14] tracking-tight mb-6 ${barlow.className}`}>Contact Us - Inquire Today</motion.h2>
              <p className="text-xl text-gray-500 font-medium mb-8 max-w-2xl mx-auto">Join leading research facilities and clinics across the country partnering for superior outcomes.</p>
              <motion.div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto mb-8" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
                <Input
                  placeholder="Enter your email"
                  className="bg-white border border-blue-100 text-[#070B14] placeholder:text-gray-400 rounded-2xl px-6 py-3 backdrop-blur-sm shadow-sm h-14"
                  value={inquiryEmail}
                  onChange={(e) => setInquiryEmail(e.target.value)}
                  type="email"
                />
                <Button
                  size="lg"
                  className="bg-[#1B2D4F] text-white hover:bg-primary border-0 rounded-2xl px-8 h-14 shadow-xl shadow-primary/10 transition-all duration-300 group"
                  onClick={handleInquiry}
                  disabled={isSendingInquiry}
                >
                  <span className="flex items-center gap-2 font-bold uppercase tracking-widest text-xs">
                    {isSendingInquiry ? 'Sending...' : 'Get Started'}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="border-t border-blue-100/30 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
            <div className="space-y-6">
              <h3 className={`text-2xl font-black text-[#070B14] tracking-tighter ${barlow.className}`}>{footerSettings?.siteTitle || 'ASCENDRA BIO'}</h3>
              <p className="text-gray-500 font-medium text-sm leading-relaxed max-w-xs">
                {footerSettings?.siteDescription || 'Uncompromising standards for 99%+ pure research peptides. Supporting cutting-edge clinical discovery nationwide.'}
              </p>
            </div>

            <div>
              <h4 className={`text-sm font-black uppercase tracking-[0.2em] text-[#070B14] mb-6 ${barlow.className}`}>{footerSettings?.sections?.[0]?.title || 'Products'}</h4>
              <ul className="space-y-4">
                {topProducts.length > 0 ? (
                  topProducts.map((product) => (
                    <li key={product.id}>
                      <Link href={`/landing/products/${product.id}`} className="text-gray-500 font-bold text-sm hover:text-primary transition-colors">
                        {product.name}
                      </Link>
                    </li>
                  ))
                ) : (
                  ['BPC-157', 'Semaglutide', 'Tirzepatide', 'AOD-9604'].map((name) => (
                    <li key={name}>
                      <Link href="/landing/products" className="text-gray-500 font-bold text-sm hover:text-primary transition-colors">
                        {name}
                      </Link>
                    </li>
                  ))
                )}
                <li>
                  <Link href="/landing/products" className="text-primary font-black text-sm uppercase tracking-widest hover:underline decoration-2 underline-offset-4">
                    View Catalog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className={`text-sm font-black uppercase tracking-[0.2em] text-[#070B14] mb-6 ${barlow.className}`}>Support</h4>
              <ul className="space-y-3">
                {[
                  { title: 'Research Hub', href: '/landing/third-party-testing' },
                  { title: 'Quality Analysis', href: '/landing/third-party-testing' },
                  { title: 'Clinical Inquiry', href: '#' },
                  { title: 'About Our Lab', href: '#' },
                ].map((lnk, i) => (
                  <li key={i}>
                    <Link href={lnk.href} className="text-gray-500 font-bold text-sm hover:text-primary transition-colors">{lnk.title}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-primary/[0.03] border-l-4 border-primary p-6 rounded-2xl">
              <h4 className={`text-sm font-black uppercase tracking-[0.2em] text-primary mb-3 ${barlow.className}`}>Regulatory Notice</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-medium italic">
                Products sold on this website are intended for <strong>PROFESSIONAL USE ONLY</strong>. Not for human consumption. Use exclusively in a laboratory or clinical research setting by licensed researchers.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-blue-100/20 py-8 bg-white/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">
              © {new Date().getFullYear()} ASCENDRA BIO SCIENCES. ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;


