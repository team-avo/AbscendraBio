'use client';

import { useState, useEffect, useCallback } from 'react';
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

export default function LandingPage() {
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
    <div className={`flex flex-col min-h-screen bg-white text-[#070B14] relative overflow-hidden ${barlow.className}`}>

      {/* ═══════════════════════════════════════════ */}
      {/* HERO                                        */}
      {/* ═══════════════════════════════════════════ */}
      <main className="relative z-20 flex items-center min-h-[85vh] w-full px-8 lg:px-20 pt-28 pb-16 bg-white overflow-hidden">

        {/* Ambient Background */}
        <div className="absolute inset-0 z-0 pointer-events-none bg-[#F9FBFF]">
          <motion.div
            animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 opacity-25 blur-[120px]"
            style={{
              background: "radial-gradient(circle at 10% 20%, #4D7DF2 0%, transparent 50%), radial-gradient(circle at 90% 80%, #7EB3D8 0%, transparent 50%)",
              backgroundSize: "150% 150%"
            }}
          />

          {/* Subtle Molecular Particles */}
          {isMounted && [...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              initial={{
                x: Math.random() * 100 + "%",
                y: Math.random() * 100 + "%",
                opacity: 0
              }}
              animate={{
                x: [null, Math.random() * 100 + "%"],
                y: [null, Math.random() * 100 + "%"],
                opacity: [0, 0.12, 0],
                rotate: [0, 360],
                scale: [0.5, 1.5, 0.5]
              }}
              transition={{
                duration: 30 + Math.random() * 20,
                repeat: Infinity,
                ease: "linear",
                delay: i * 1.5
              }}
              className="absolute w-24 h-24 sm:w-48 sm:h-48"
            >
              <svg viewBox="0 0 100 100" className="w-full h-full text-blue-500/10 fill-current">
                <circle cx="50" cy="30" r="8" />
                <circle cx="30" cy="70" r="8" />
                <circle cx="70" cy="70" r="8" />
                <path d="M50 30 L30 70 M50 30 L70 70 M30 70 L70 70" stroke="currentColor" strokeWidth="1" fill="none" />
              </svg>
            </motion.div>
          ))}
        </div>

        <div className="max-w-7xl mx-auto w-full flex flex-col lg:flex-row items-center gap-16 relative z-10">

          <div className="flex-1 flex flex-col items-start text-left order-2 lg:order-1">
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="flex items-center gap-4 mb-8"
            >
              <span className="w-12 h-[1px] bg-[#4D7DF2]/40" />
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.4em] text-[#4D7DF2] uppercase">
                {branding.eyebrow}
              </span>
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tighter text-[#070B14]">
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.1 }}
                className="block"
              >
                Advanced
              </motion.span>
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="block text-[#4D7DF2]"
              >
                Bio-Research
              </motion.span>
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.3 }}
                className="block font-extralight text-gray-300"
              >
                Purity Redefined.
              </motion.span>
            </h1>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-8 text-base sm:text-lg text-gray-500 max-w-lg leading-relaxed font-medium"
            >
              Industry-leading synthesis protocols ensuring 99.9% purity for clinical and academic research standards.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="mt-10 flex flex-col sm:flex-row items-center gap-8"
            >
              <motion.button
                whileHover={{ scale: 1.05, x: 5 }}
                onClick={() => setIsContactOpen(true)}
                className="flex items-center gap-4 text-base font-bold text-[#070B14] group"
              >
                <span className="w-14 h-14 rounded-full border-2 border-[#4D7DF2] bg-[#4D7DF2]/5 flex items-center justify-center transition-all shadow-md group-hover:bg-[#4D7DF2] group-hover:text-white">
                  <ArrowRight className="w-5 h-5" />
                </span>
                Start Research
              </motion.button>

              <Link
                href="/landing/third-party-testing"
                className="text-base font-bold text-gray-400 hover:text-[#070B14] transition-colors border-b-2 border-transparent hover:border-[#4D7DF2] pb-1"
              >
                Review Lab Reports
              </Link>
            </motion.div>
          </div>

          {/* Product Visualization */}
          <div className="flex-1 relative order-1 lg:order-2 flex justify-center items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-[700px] mix-blend-multiply filter saturate-[1.2]"
            >
              <Image
                src="/vials-row.png"
                alt="Ascendra Bio Research Grade Peptides"
                width={700}
                height={525}
                className="object-contain"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-transparent pointer-events-none" />
            </motion.div>

            {/* Floating Badges */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              <motion.div
                animate={{ y: [-15, 15, -15] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[20%] right-[10%] bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-blue-100/60 shadow-md"
              >
                <p className="text-[9px] font-bold text-[#4D7DF2] uppercase tracking-widest">Purity Matrix</p>
                <h3 className="text-lg font-black text-[#070B14]">99.8%+</h3>
              </motion.div>

              <motion.div
                animate={{ y: [15, -15, 15] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-[20%] left-[10%] bg-[#070B14]/80 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[9px] font-bold text-white uppercase tracking-widest">GMP Certified</p>
                </div>
              </motion.div>
            </div>
          </div>

        </div>
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
                <span className="w-8 h-[1px] bg-[#4D7DF2]/40" />
                <span className="text-[10px] font-bold tracking-[0.4em] text-[#4D7DF2] uppercase">
                  Catalog
                </span>
              </div>
              <h2 className={`text-3xl sm:text-4xl font-bold text-[#070B14] tracking-tight ${barlow.className}`}>
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
              <span className="w-8 h-[1px] bg-[#4D7DF2]/40" />
              <span className="text-[10px] font-bold tracking-[0.4em] text-[#4D7DF2] uppercase">
                Why Ascendra
              </span>
            </div>
            <h2 className={`text-3xl sm:text-4xl font-bold text-[#070B14] tracking-tight ${barlow.className}`}>
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
                  <div className="mb-5 w-12 h-12 rounded-xl bg-[#4D7DF2]/5 border border-[#4D7DF2]/10 flex items-center justify-center group-hover:bg-[#4D7DF2]/10 transition-colors duration-300">
                    <item.icon className="w-5 h-5 text-[#4D7DF2]" strokeWidth={1.5} />
                  </div>
                  <h3 className={`text-lg font-bold text-[#070B14] tracking-tight mb-2 ${barlow.className}`}>
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
              className="absolute inset-0 bg-[#070B14]/80 backdrop-blur-xl"
              onClick={() => setIsContactOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[500px] bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-start px-8 pt-8 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Inquire Now</h2>
                  <p className="text-sm text-gray-400 mt-1.5">We&apos;ll get back to you within 24 hours.</p>
                </div>
                <button
                  onClick={() => setIsContactOpen(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="px-8 pb-8 pt-2">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider ml-1">Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.08] rounded-xl
                        text-white placeholder-gray-600 text-sm
                        focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider ml-1">
                        Email <span className="text-[#3A6FA0]">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="email@clinic.com"
                        required
                        className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.08] rounded-xl
                          text-white placeholder-gray-600 text-sm
                          focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider ml-1">Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+1 (555) 000-0000"
                        className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.08] rounded-xl
                          text-white placeholder-gray-600 text-sm
                          focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider ml-1">
                      Message <span className="text-[#3A6FA0]">*</span>
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      placeholder="Tell us about your practice and peptide needs..."
                      required
                      rows={3}
                      className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.08] rounded-xl
                        text-white placeholder-gray-600 text-sm resize-none
                        focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 rounded-xl text-sm font-bold text-[#070B14]
                      bg-white hover:bg-gray-100 disabled:opacity-50
                      transition-all duration-300 mt-4 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
                  </button>

                  {submissionStatus === 'success' && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-emerald-400 text-center text-sm font-medium pt-2">
                      Thank you — we&apos;ll be in touch shortly.
                    </motion.p>
                  )}
                  {submissionStatus === 'error' && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 text-center text-sm font-medium pt-2">
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
