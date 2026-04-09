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
import { Award, Zap, FlaskConical, ShieldCheck, ArrowRight, Menu, X, ChevronDown } from 'lucide-react';
import { AuthModal } from '@/components/auth/AuthModal';

const barlow = Barlow({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800', '900'] });

/** Hook: returns true once user has scrolled past `threshold` pixels */
function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > threshold);
  }, [threshold]);
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  return scrolled;
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth?.() || ({} as any);
  const scrolled = useScrolled(30);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'customer' | 'admin'>('customer');

  const handleOpenAuthModal = (view: 'customer' | 'admin') => {
    setAuthModalView(view);
    setAuthModalOpen(true);
  };

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

  const trustItems = [
    { icon: Award, label: '99%+ Purity', sublabel: 'COA Verified' },
    { icon: Zap, label: '24hr Shipping', sublabel: 'Nationwide' },
    { icon: FlaskConical, label: '30+ Peptides', sublabel: 'Full Catalog' },
    { icon: ShieldCheck, label: 'Made in USA', sublabel: 'GMP Standards' },
  ];

  return (
    <div className={`flex flex-col min-h-screen bg-white text-[#070B14] relative overflow-hidden ${barlow.className}`}>

      {/* ═══════════════════════════════════════════ */}
      {/* STICKY GLASSMORPHIC NAVBAR                  */}
      {/* ═══════════════════════════════════════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500">
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 transition-all duration-500 ${scrolled ? 'pt-2' : 'pt-4 sm:pt-6'}`}>
          <nav
            className={`flex items-center justify-between rounded-full px-5 sm:px-6 transition-all duration-500
              backdrop-blur-xl border
              ${scrolled
                ? 'h-14 bg-white/80 border-[#070B14]/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.05)]'
                : 'h-16 bg-white/[0.05] border-[#070B14]/[0.03]'
              }`}
          >
            {/* Logo */}
            <Link href="/" className="flex-shrink-0 flex items-center group">
              <Image
                src={branding.logoSrc}
                alt={branding.name}
                width={140}
                height={32}
                className={`w-auto group-hover:opacity-80 transition-all duration-300
                  ${scrolled ? 'h-6 sm:h-7' : 'h-7 sm:h-8'}`}
                priority
              />
            </Link>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {branding.navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:text-[#4D7DF2] rounded-full hover:bg-gray-50 transition-all duration-300"
                >
                  {link.label}
                </Link>
              ))}
              <button
                onClick={() => setIsContactOpen(true)}
                className="px-4 py-2 text-[13px] font-semibold text-gray-600 hover:text-[#4D7DF2] rounded-full hover:bg-gray-50 transition-all duration-300"
              >
                Contact
              </button>

              <div className="w-px h-4 bg-gray-200 mx-3" />

              {isAuthenticated ? (
                <Link
                  href="/landing/products"
                  className="px-6 py-2.5 text-[13px] font-bold rounded-full bg-[#4D7DF2] text-white hover:bg-[#3b66d1] transition-all duration-300 shadow-[0_10px_30px_rgba(77,125,242,0.3)]"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => handleOpenAuthModal('customer')}
                    className="px-4 py-2 text-[13px] font-semibold text-gray-500 hover:text-[#070B14] rounded-full hover:bg-gray-50 transition-all duration-300"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setIsContactOpen(true)}
                    className="px-6 py-2.5 text-[13px] font-bold rounded-full bg-[#070B14] text-white hover:bg-gray-800 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
                  >
                    Inquire Now
                  </button>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </nav>
        </div>

        {/* Mobile dropdown menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="mx-4 sm:mx-6 mt-2 bg-[#0D1320]/95 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden md:hidden"
            >
              <div className="flex flex-col p-4 space-y-1">
                {branding.navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <button
                  onClick={() => { setIsContactOpen(true); setMobileMenuOpen(false); }}
                  className="px-4 py-3 text-left text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  Contact
                </button>
                <div className="h-px bg-white/10 mx-4 my-2" />
                {!isAuthenticated ? (
                  <>
                    <button
                      className="text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                      onClick={() => { setMobileMenuOpen(false); handleOpenAuthModal('customer'); }}
                    >
                      Login
                    </button>
                    <button
                      className="text-left px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                      onClick={() => { setMobileMenuOpen(false); handleOpenAuthModal('admin'); }}
                    >
                      Admin Login
                    </button>
                    <button
                      onClick={() => { setIsContactOpen(true); setMobileMenuOpen(false); }}
                      className="mt-2 w-full py-3.5 text-sm font-semibold rounded-xl bg-white text-[#070B14] hover:bg-gray-200 transition-colors"
                    >
                      Inquire Now
                    </button>
                  </>
                ) : (
                  <Link
                    href="/landing/products"
                    className="mt-2 w-full block text-center py-3.5 text-sm font-semibold rounded-xl bg-white text-[#070B14] hover:bg-gray-200 transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════════════════════════════════════════ */}
      {/* THE ASCENDRA SIGNATURE HERO — MINIMAL TECH */}
      {/* ═══════════════════════════════════════════ */}
      <main className="relative z-20 flex items-center min-h-[95vh] w-full px-8 lg:px-20 pt-28 pb-20 bg-white overflow-hidden">
        
        {/* Cinematic Background Layer (Peptide/Molecular Video Simulation) */}
        <div className="absolute inset-0 z-0 pointer-events-none bg-[#F9FBFF]">
          {/* Moving Gradient Video-Effect */}
          <motion.div 
            animate={{ 
              backgroundPosition: ["0% 0%", "100% 100%"]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 opacity-40 blur-[120px]"
            style={{ 
              background: "radial-gradient(circle at 10% 20%, #4D7DF2 0%, transparent 50%), radial-gradient(circle at 90% 80%, #7EB3D8 0%, transparent 50%)",
              backgroundSize: "150% 150%"
            }}
          />

          {/* Dynamic Molecular Particles */}
          {[...Array(8)].map((_, i) => (
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
                opacity: [0, 0.2, 0],
                rotate: [0, 360],
                scale: [0.5, 1.5, 0.5]
              }}
              transition={{ 
                duration: 25 + Math.random() * 15, 
                repeat: Infinity, 
                ease: "linear",
                delay: i * 1.5
              }}
              className="absolute w-32 h-32 sm:w-64 sm:h-64"
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
            {/* Minimalist Floating Label */}
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

            {/* Signature Mixed-Weight Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-[#070B14]">
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
                className="block font-light text-gray-400"
              >
                Purity Redefined.
              </motion.span>
            </h1>

            {/* Tech Brief */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="mt-8 text-base sm:text-lg text-gray-500 max-w-lg leading-relaxed font-medium"
            >
              Industry-leading synthesis protocols ensuring 99.9% purity for clinical and academic research standards.
            </motion.p>

            {/* Unique Interaction Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="mt-12 flex flex-col sm:flex-row items-center gap-8"
            >
              <motion.button
                whileHover={{ scale: 1.05, x: 5 }}
                onClick={() => setIsContactOpen(true)}
                className="flex items-center gap-4 text-base font-bold text-[#070B14] group"
              >
                <span className="w-12 h-12 rounded-full border-2 border-[#4D7DF2] flex items-center justify-center transition-all group-hover:bg-[#4D7DF2] group-hover:text-white">
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

          {/* Merged Product Visualization (Blending over Video) */}
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
              
              {/* Subtle Gradient Fade to Merge into Background */}
              <div className="absolute inset-0 bg-gradient-to-t from-white/30 via-transparent to-transparent pointer-events-none" />
            </motion.div>

            {/* Floating Intelligence Elements */}
            <div className="absolute inset-0 z-20 pointer-events-none">
              <motion.div 
                animate={{ y: [-15, 15, -15] }} 
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[20%] right-[10%] bg-white/60 backdrop-blur-sm p-3 rounded-lg border border-blue-100 shadow-sm"
              >
                <p className="text-[9px] font-bold text-[#4D7DF2] uppercase tracking-widest">Purity Matrix</p>
                <h3 className="text-lg font-black text-[#070B14]">99.8%+</h3>
              </motion.div>

              <motion.div 
                animate={{ y: [15, -15, 15] }} 
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-[20%] left-[10%] bg-[#070B14]/90 p-3 rounded-lg shadow-xl"
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
      {/* FLOATING TRUST METRICS                       */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-30 w-full pb-16 bg-gray-50/50"
      >
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-10 md:gap-16 lg:gap-24 opacity-80">
            {trustItems.map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center group flex-1">
                <div className="mb-6 text-[#4D7DF2] group-hover:scale-110 transition-all duration-500">
                  <item.icon className="w-8 h-8 md:w-10 md:h-10" strokeWidth={1.2} />
                </div>
                <p className="text-lg md:text-xl font-black text-[#070B14] tracking-tight">{item.label}</p>
                <p className="text-xs md:text-sm text-gray-400 mt-2 uppercase font-bold tracking-[0.15em]">{item.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

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

            {/* Modal Glass Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[500px] bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden"
              style={{ boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 100px 0 rgba(58, 111, 160, 0.15)" }}
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
                      className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl
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
                        className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl
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
                        className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl
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
                      className="w-full px-5 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl
                        text-white placeholder-gray-600 text-sm resize-none
                        focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/20 transition-all font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-[#070B14]
                      bg-white hover:bg-gray-200 disabled:opacity-50
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
