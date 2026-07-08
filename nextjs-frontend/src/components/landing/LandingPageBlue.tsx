'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/contexts/auth-context';
import { API_BASE_URL } from '@/lib/env';
import logger from '@/lib/logger';
import { branding } from '@/config/branding';
import { motion, AnimatePresence } from 'motion/react';
import { Barlow } from 'next/font/google';
import { Award, Zap, FlaskConical, ShieldCheck, ArrowRight, X } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProductCarousel } from '@/components/landing/ProductCarousel';
const barlow = Barlow({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800', '900'] });

export default function LandingPageBlue() {
  const { isAuthenticated } = useAuth?.() || ({} as any);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'customer' | 'admin'>('customer');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'success' | 'error' | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionStatus(null);

    try {
      const response = await fetch(`${API_BASE_URL}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to send message');

      setSubmissionStatus('success');
      setTimeout(() => {
        setIsContactOpen(false);
        setFormData({ name: '', email: '', phone: '', message: '' });
        setSubmissionStatus(null);
      }, 2000);
    } catch (error) {
      logger.error('Failed to send message', { error });
      setSubmissionStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const trustFeatures = [
    { icon: Award, label: '99%+ Purity', description: 'Every batch COA-verified with full analytical reports.' },
    { icon: Zap, label: '24hr Shipping', description: 'Overnight delivery available on every order, nationwide.' },
    { icon: FlaskConical, label: 'Tested & Verified', description: 'Endotoxicity, net peptide content, and sterility tested.' },
    { icon: ShieldCheck, label: 'Made in USA', description: 'Manufactured under GMP standards in American facilities.' },
  ];

  return (
    <div className={`flex flex-col min-h-screen bg-white text-[#043061] relative overflow-hidden ${barlow.className}`}>

      {/* ═══════════════════════════════════════════ */}
      {/* HERO — FULL-WIDTH PRODUCT BANNER            */}
      {/* ═══════════════════════════════════════════ */}
      <main className="relative z-20 min-h-[92vh] w-full overflow-hidden bg-[#5A9ADA]">

        {/* Background: product image fills the right / bottom */}
        <div className="absolute inset-0 z-0">
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#5A9ADA] via-[#5A9ADA] to-transparent" style={{ backgroundSize: '100% 100%', backgroundImage: 'linear-gradient(to right, #5A9ADA 0%, #5A9ADA 42%, transparent 72%)' }} />
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#5A9ADA] via-transparent to-[#5A9ADA]/40 lg:hidden" />

          {/* Product image */}
          <motion.div
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-0 h-full w-full lg:w-[60%]"
          >
            <Image
              src="/hero-vials.png"
              alt="Ascendra Bio Research Grade Peptides"
              fill
              className="object-cover object-center lg:object-right"
              priority
            />
          </motion.div>

          {/* Subtle ambient glow */}
          <div
            className="absolute inset-0 z-[5] opacity-30 blur-[100px] pointer-events-none"
            style={{
              background: "radial-gradient(circle at 20% 50%, #ffffff 0%, transparent 50%), radial-gradient(circle at 80% 30%, #A8D4F0 0%, transparent 40%)",
            }}
          />
        </div>

        {/* Content */}
        <div className="relative z-20 max-w-7xl mx-auto px-6 lg:px-16 h-full flex items-center pt-36 sm:pt-40 pb-20 min-h-[92vh]">
          <div className="max-w-lg lg:max-w-[40%]">
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-3 mb-6"
            >
              <span className="w-8 h-[1px] bg-white" />
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.3em] text-white uppercase">
                {branding.eyebrow}
              </span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tighter text-white">
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="block"
              >
                Advanced
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="block text-white"
              >
                Bio-Research
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="block font-extralight text-white/40"
              >
                Purity Redefined.
              </motion.span>
            </h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-6 text-base sm:text-lg text-white/80 max-w-md leading-relaxed font-medium"
            >
              Industry-leading synthesis protocols ensuring 99.9% purity for clinical and academic research.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="mt-10 flex flex-col sm:flex-row items-start gap-4"
            >
              <button
                onClick={() => setIsContactOpen(true)}
                className="flex items-center gap-3 bg-white hover:bg-gray-100 text-[#5A9ADA] px-7 py-4 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 shadow-lg shadow-black/20"
              >
                Start Research
                <ArrowRight className="w-4 h-4" />
              </button>

              <Link
                href="/landing/coas"
                className="flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white px-7 py-4 rounded-xl border border-white/30 hover:border-white/50 transition-all duration-200"
              >
                Review Lab Reports
              </Link>
            </motion.div>

            {/* Inline trust stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="mt-14 flex flex-wrap gap-8"
            >
              {[
                { value: '99%+', label: 'Purity' },
                { value: '24hr', label: 'Shipping' },
                { value: '30+', label: 'Peptides' },
              ].map((stat, i) => (
                <div key={i} className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-white tracking-tight">{stat.value}</span>
                  <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{stat.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Bottom fade to white for seamless transition */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent z-30" />
      </main>

      {/* ═══════════════════════════════════════════ */}
      {/* PRODUCTS SECTION (authenticated only)       */}
      {/* ═══════════════════════════════════════════ */}
      {isAuthenticated && (
        <section className="py-16 bg-white relative">
          <div className="max-w-7xl mx-auto px-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-4 mb-4">
                <span className="w-8 h-[1px] bg-[#5A9ADA]/40" />
                <span className="text-[10px] font-bold tracking-[0.4em] text-[#5A9ADA] uppercase">
                  Catalog
                </span>
              </div>
              <h2 className={`text-3xl sm:text-4xl font-bold text-[#043061] tracking-tight ${barlow.className}`}>
                Popular Peptides
              </h2>
              <p className="mt-3 text-base text-gray-500 font-medium max-w-lg">
                Browse our most requested compounds for clinical research.
              </p>
            </motion.div>
          </div>
          <ProductCarousel />
        </section>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* UNIFIED TRUST SECTION                      */}
      {/* ═══════════════════════════════════════════ */}
      <section className="py-20 bg-[#F9FBFF] relative">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-14"
          >
            <div className="flex items-center gap-4 mb-4">
              <span className="w-8 h-[1px] bg-[#5A9ADA]/40" />
              <span className="text-[10px] font-bold tracking-[0.4em] text-[#5A9ADA] uppercase">
                Why Ascendra
              </span>
            </div>
            <h2 className={`text-3xl sm:text-4xl font-bold text-[#043061] tracking-tight ${barlow.className}`}>
              Built for Research Excellence
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustFeatures.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group"
              >
                <div className="bg-white border border-gray-100 rounded-2xl p-7 h-full transition-all duration-300 hover:shadow-md hover:border-blue-100">
                  <div className="mb-5 w-12 h-12 rounded-xl bg-[#5A9ADA]/5 border border-[#5A9ADA]/10 flex items-center justify-center group-hover:bg-[#5A9ADA]/10 transition-colors duration-300">
                    <item.icon className="w-5 h-5 text-[#5A9ADA]" strokeWidth={1.5} />
                  </div>
                  <h3 className={`text-lg font-bold text-[#043061] tracking-tight mb-2 ${barlow.className}`}>
                    {item.label}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════ */}
      {/* CONTACT / INQUIRE MODAL                    */}
      {/* ═══════════════════════════════════════════ */}
      <AnimatePresence>
        {isContactOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#5A9ADA]/80 backdrop-blur-xl"
              onClick={() => setIsContactOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[500px] bg-white/[0.06] backdrop-blur-2xl border border-white/[0.15] rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-start px-8 pt-8 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Inquire Now</h2>
                  <p className="text-sm text-white/70 mt-1.5">We&apos;ll get back to you within 24 hours.</p>
                </div>
                <button
                  onClick={() => setIsContactOpen(false)}
                  className="p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="px-8 pb-8 pt-2">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-2 uppercase tracking-wider ml-1">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-5 py-4 bg-white/[0.06] border border-white/[0.15] rounded-xl
                        text-white placeholder-white/40 text-sm
                        focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 transition-all font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-2 uppercase tracking-wider ml-1">
                        Email <span className="text-white">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="email@clinic.com"
                        required
                        className="w-full px-5 py-4 bg-white/[0.06] border border-white/[0.15] rounded-xl
                          text-white placeholder-white/40 text-sm
                          focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/70 mb-2 uppercase tracking-wider ml-1">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-5 py-4 bg-white/[0.06] border border-white/[0.15] rounded-xl
                          text-white placeholder-white/40 text-sm
                          focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-2 uppercase tracking-wider ml-1">
                      Message <span className="text-white">*</span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Tell us about your practice and peptide needs..."
                      required
                      rows={3}
                      className="w-full px-5 py-4 bg-white/[0.06] border border-white/[0.15] rounded-xl
                        text-white placeholder-white/40 text-sm resize-none
                        focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40 transition-all font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 rounded-xl text-sm font-bold text-[#5A9ADA]
                      bg-white hover:bg-gray-100 disabled:opacity-50
                      transition-all duration-300 mt-4 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
                  </button>

                  {submissionStatus === 'success' && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-300 text-center text-sm font-medium pt-2">
                      Thank you — we&apos;ll be in touch shortly.
                    </motion.p>
                  )}
                  {submissionStatus === 'error' && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-300 text-center text-sm font-medium pt-2">
                      Failed to send message. Please try again.
                    </motion.p>
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AuthModal isOpen={authModalOpen} onOpenChange={setAuthModalOpen} defaultView={authModalView} />
    </div>
  );
}
