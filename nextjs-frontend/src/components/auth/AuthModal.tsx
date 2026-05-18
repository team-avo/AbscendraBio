'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CustomerAuthModule } from './modules/CustomerAuthModule';
import { AdminAuthModule } from './modules/AdminAuthModule';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { ShieldCheck, FlaskConical, Award, Check } from 'lucide-react';
import { Barlow } from 'next/font/google';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'] });

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultView?: 'customer' | 'admin';
}

const trustPoints = [
  { icon: ShieldCheck, text: 'COA verified every batch' },
  { icon: FlaskConical, text: '99%+ purity, HPLC tested' },
  { icon: Award, text: 'GMP certified facilities' },
];

function SuccessScreen() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-xl shadow-emerald-500/20"
      >
        <Check className="w-8 h-8 text-white stroke-[3px]" />
      </motion.div>
      <div className="text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-lg font-black text-[#070B14] tracking-tight"
        >
          Signed in successfully
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-gray-400 mt-1"
        >
          Redirecting you now…
        </motion.p>
      </div>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '100%' }}
        transition={{ duration: 2, ease: 'easeInOut', delay: 0.2 }}
        className="h-0.5 bg-emerald-500 rounded-full max-w-[120px]"
      />
    </div>
  );
}

export function AuthModal({ isOpen, onOpenChange, defaultView = 'customer' }: AuthModalProps) {
  const [view, setView] = useState<'customer' | 'admin'>(defaultView);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) { setView(defaultView); setIsSuccess(false); }
  }, [isOpen, defaultView]);

  const handleLoginSuccess = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onOpenChange(false);
      setTimeout(() => setIsSuccess(false), 500);
    }, 2400);
  };

  const handleOpenChange = (open: boolean) => {
    if (isSuccess && !open) return;
    onOpenChange(open);
    if (!open) setTimeout(() => setView(defaultView), 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={`p-0 border-0 shadow-2xl overflow-hidden rounded-3xl !max-w-[1020px] w-[95vw] max-h-[90vh] gap-0 [&>button]:z-50 [&>button]:top-4 [&>button]:right-4 [&>button]:rounded-full [&>button]:bg-white/10 [&>button]:backdrop-blur-md [&>button]:text-white [&>button]:hover:bg-white/20 [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center ${barlow.className}`}>
        <VisuallyHidden><DialogTitle>Sign in to your account</DialogTitle></VisuallyHidden>

        <div className="flex h-full" style={{ maxHeight: '90vh' }}>

          {/* ── Left Dark Panel ── */}
          <div className="hidden md:flex w-[38%] bg-[#070B14] flex-col justify-between p-10 relative overflow-y-auto shrink-0">
            {/* Grid texture */}
            <div className="absolute inset-0 opacity-[0.04]"
              style={{ backgroundImage: 'linear-gradient(rgba(77,125,242,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(77,125,242,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            {/* Blue glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-[#4D7DF2]/20 rounded-full blur-[80px] pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[#4D7DF2]/10 rounded-full blur-[60px] pointer-events-none" />

            <div className="relative z-10">
              <Image src="/logo.png" alt="Ascendra Bio" width={140} height={32} className="h-7 w-auto brightness-0 invert" priority />
            </div>

            <div className="relative z-10 space-y-8">
              <div>
                <h2 className="text-2xl font-black text-white leading-tight tracking-tight">
                  Research-grade<br />
                  <span className="text-gray-400 font-light">peptides for professionals</span>
                </h2>
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                  Sign in to access pricing, place orders, and view your certificates of analysis.
                </p>
              </div>

              <div className="space-y-3">
                {trustPoints.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#4D7DF2]/15 border border-[#4D7DF2]/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-[#4D7DF2]" />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="relative z-10 text-[10px] text-gray-600">
              © {new Date().getFullYear()} Ascendra Bio. All rights reserved.
            </p>
          </div>

          {/* ── Right White Panel ── */}
          <div className="flex-1 bg-white flex flex-col overflow-hidden min-h-0">
            {/* Tab switcher — admin login is at /admin/login (not exposed here) */}

            {/* Form area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-10 py-8">
              <AnimatePresence mode="wait" initial={false}>
                {isSuccess ? (
                  <motion.div key="success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
                    <SuccessScreen />
                  </motion.div>
                ) : view === 'customer' ? (
                  <motion.div key="customer" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                    <CustomerAuthModule isModal onSwitchToAdmin={() => setView('admin')} onSuccess={handleLoginSuccess} />
                  </motion.div>
                ) : (
                  <motion.div key="admin" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
                    <AdminAuthModule isModal onSwitchToCustomer={() => setView('customer')} onSuccess={handleLoginSuccess} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
