"use client";

import { motion } from "motion/react";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { api, resolveImageUrl } from "@/lib/api";
import Link from "next/link";
import { Barlow } from "next/font/google";
import logger from '@/lib/logger';

const barlow = Barlow({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });

export function Footer() {
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [footerLinks, setFooterLinks] = useState<Array<{ title: string; href: string; target?: string }>>([]);
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
    const fetchFooterNav = async () => {
      try {
        const m = await api.getPublicNavigationMenus({ location: 'footer' });
        if (m.success && m.data) {
          const menus = m.data.menus || [];
          const footer = menus[0];
          if (footer) {
            const r = await api.getPublicNavigationItems(footer.id);
            if (r.success && r.data) {
              const resolved: Array<{ title: string; href: string; target?: string }> = [];
              for (const it of (r.data.items || []).filter((i: any) => i.isActive)) {
                const href = it.href || it.url || "";
                if (!href) continue;
                resolved.push({ title: it.title || href, href, target: it.target || "_self" });
              }
              setFooterLinks(resolved);
            }
          }
        }
      } catch (e) {
        // ignore
      }
    };
    const fetchFooterSettings = async () => {
      try {
        const r = await api.getPublicFooter();
        if (r.success) setFooterSettings(r.data || null);
      } catch { }
    };

    fetchTopProducts();
    fetchFooterNav();
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
    <footer className="relative bg-background overflow-hidden">
      <section className="relative py-20">
        <motion.div className="absolute inset-0 opacity-0" />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="text-center">
            <div className="backdrop-blur-2xl bg-card/50 border border-border rounded-3xl p-12 mb-12">
              <motion.h2 className={`text-6xl font-bold text-foreground mb-6 ${barlow.className}`}>Contact Us - Inquire Today</motion.h2>
              <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">Join countless Medspa's and clinics across the country.</p>
              <motion.div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto mb-8" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}>
                <Input
                  placeholder="Enter your email"
                  className="bg-input-background border-border text-foreground placeholder:text-muted-foreground rounded-full px-6 py-3 backdrop-blur-sm"
                  value={inquiryEmail}
                  onChange={(e) => setInquiryEmail(e.target.value)}
                  type="email"
                  inputMode="email"
                />
                <Button
                  size="lg"
                  className="bg-foreground text-background border-0 rounded-full px-8 py-3 shadow-xl transition-all duration-300 group relative overflow-hidden hover:opacity-90"
                  onClick={handleInquiry}
                  disabled={isSendingInquiry}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isSendingInquiry ? 'Sending...' : 'Get Started'}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Store overview (title/description + socials) - match original sizing/styles */}
            <div>
              <h3 className={`text-2xl font-bold text-foreground mb-4 ${barlow.className}`}>{footerSettings?.siteTitle || 'Centre Labs'}</h3>
              <p className="text-muted-foreground mb-4 max-w-xs">
                {footerSettings?.siteDescription || 'Leading supplier of physician grade peptides with uncompromising quality standards.'}
              </p>
              {/* <div className="flex gap-4">
                {(footerSettings?.facebookUrl) && (
                  <a href={footerSettings.facebookUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-card hover:bg-accent rounded-full flex items-center justify-center backdrop-blur-sm border border-border transition-all duration-300" aria-label="Facebook">
                    <Facebook className="w-5 h-5 text-muted-foreground" />
                  </a>
                )}
                {(footerSettings?.twitterUrl) && (
                  <a href={footerSettings.twitterUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-card hover:bg-accent rounded-full flex items-center justify-center backdrop-blur-sm border border-border transition-all duration-300" aria-label="Twitter">
                    <Twitter className="w-5 h-5 text-muted-foreground" />
                  </a>
                )}
                {(footerSettings?.instagramUrl) && (
                  <a href={footerSettings.instagramUrl} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-card hover:bg-accent rounded-full flex items-center justify-center backdrop-blur-sm border border-border transition-all duration-300" aria-label="Instagram">
                    <Instagram className="w-5 h-5 text-muted-foreground" />
                  </a>
                )}
                {(!footerSettings?.facebookUrl && !footerSettings?.twitterUrl && !footerSettings?.instagramUrl) && (
                  <>
                    {[Facebook, Twitter, Instagram].map((Icon, i) => (
                      <span key={i} className="w-10 h-10 bg-card rounded-full flex items-center justify-center backdrop-blur-sm border border-border opacity-60">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </span>
                    ))}
                  </>
                )}
              </div> */}
            </div>

            {/* Remove duplicate hardcoded store block; dynamic block above handles DB + fallback */}

            <div>
              <h4 className={`text-lg font-semibold text-foreground mb-4 ${barlow.className}`}>{footerSettings?.sections?.[0]?.title || 'Products'}</h4>
              <ul className="space-y-2">
                {topProducts.length > 0 ? (
                  topProducts.map((product) => {
                    // Use product ID directly for fast lookup
                    return (
                      <li key={product.id}>
                        <Link
                          href={`/landing/products/${product.id}`}
                          className="text-muted-foreground hover:text-foreground transition-colors duration-300 hover:underline"
                        >
                          {product.name}
                        </Link>
                      </li>
                    );
                  })
                ) : (
                  // Fallback product list
                  [
                    { title: 'Peptide Complex A', href: '/landing/products' },
                    { title: 'Collagen Peptide Blend', href: '/landing/products' },
                    { title: 'BPC-157', href: '/landing/products' },
                  ].map((item, i) => (
                    <li key={i}><Link href={item.href} className="text-muted-foreground hover:text-foreground transition-colors duration-300 hover:underline">{item.title}</Link></li>
                  ))
                )}
                <li>
                  <Link
                    href="/landing/products"
                    className="text-muted-foreground hover:text-foreground transition-colors duration-300 hover:underline"
                  >
                    All Products
                  </Link>
                </li>
              </ul>
            </div>

            {/* Dynamic footer sections from settings (title + list). Exclude the first section if used to label Products. */}
            {(() => {
              const sections = Array.isArray(footerSettings?.sections) ? footerSettings!.sections : [];
              const firstTitle = sections?.[0]?.title || '';
              const renderSections = sections.filter((s: any) => (s.title || '') !== firstTitle);
              // if (renderSections.length === 0) {
              //   return (
              //     <div>
              //       <h4 className={`text-lg font-semibold text-foreground mb-4 ${barlow.className}`}>Support</h4>
              //       <ul className="space-y-2">
              //         {(
              //           (footerLinks.length > 0 ? footerLinks : [
              //             { title: 'About Us', href: '/p/about-us' },
              //             { title: 'Contact', href: '/p/contact-us' },
              //           ])
              //         ).map((lnk: any, i: number) => (
              //           <li key={`${lnk.title}-${i}`}>
              //             <Link href={lnk.href} target={lnk.target} rel={lnk.target === "_blank" ? "noopener noreferrer" : undefined} className="text-muted-foreground hover:text-foreground transition-colors duration-300 hover:underline">{lnk.title}</Link>
              //           </li>
              //         ))}
              //       </ul>
              //     </div>
              //   );
              // }
              return renderSections.map((sec: any, idx: number) => (
                <div key={`footer-sec-${idx}`}>
                  <h4 className={`text-lg font-semibold text-foreground mb-4 ${barlow.className}`}>{sec.title}</h4>
                  <ul className="space-y-2">
                    {(sec.links || []).map((lnk: any, i: number) => (
                      <li key={`${lnk.title}-${i}`}>
                        <Link href={lnk.href} target={lnk.target || '_self'} rel={(lnk.target || '_self') === "_blank" ? "noopener noreferrer" : undefined} className="text-muted-foreground hover:text-foreground transition-colors duration-300 hover:underline">{lnk.title}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ));
            })()}

            {/* Contact section */}
            {(() => {
              const sections = Array.isArray(footerSettings?.sections) ? footerSettings!.sections : [];
              const hasContactSection = sections.some((s: any) => String(s.title || '').trim().toLowerCase() === 'contact');
              if (hasContactSection) return null;
              const contact = footerSettings?.FooterContact;
              const title = (contact?.title || 'Contact');
              const email = (contact?.email || 'info@centreresearch.org');
              const phone = (contact?.phone || '+1 (555) 123-4567');
              const address = (contact?.address || 'Los Angeles, CA');
              return (
                <div>
                  <h4 className={`text-lg font-semibold text-foreground mb-4 ${barlow.className}`}>{title}</h4>
                  <div className="space-y-3 text-muted-foreground">
                    <div className="flex items-center gap-3"><Mail className="w-5 h-5" /><span>{email}</span></div>
                    {/* <div className="flex items-center gap-3"><Phone className="w-5 h-5" /><span>{phone}</span></div> */}
                    <div className="flex items-center gap-3"><MapPin className="w-5 h-5" /><span>{address}</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Important Note Section */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <h4 className={`text-lg font-semibold text-red-600 mb-3 ${barlow.className}`}>Important Note</h4>
              <p className="text-sm text-gray-900 leading-relaxed">
                Products sold on this website are intended for <strong>PROFESSIONAL USE ONLY</strong> and are only to be sold to a licensed healthcare provider to be utilized at their discretion in accordance with applicable law.
              </p>
            </div>

            {/* Remove duplicate hardcoded contact block; conditional contact block above handles DB + fallback without duplicates */}
          </div>
        </div>
      </div>

      <div className="border-t border-border py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} Centre Labs. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;


