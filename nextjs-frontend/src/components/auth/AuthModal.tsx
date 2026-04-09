'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { CustomerAuthModule } from './modules/CustomerAuthModule';
import { AdminAuthModule } from './modules/AdminAuthModule';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultView?: 'customer' | 'admin';
}

function LogoLoader() {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-12">
      <div className="relative">
        <motion.div
          className="absolute -inset-8 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20 
          }}
        >
          <Image 
            src="/logo.png" 
            alt="Abscendra Bio" 
            width={350} 
            height={120} 
            className="h-24 w-auto relative z-10" 
            priority
          />
        </motion.div>
      </div>
      
      <div className="flex flex-col items-center space-y-4">
        <motion.p 
          className="text-[#1B2D4F] font-semibold text-lg tracking-[0.2em] uppercase"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          Authenticating
        </motion.p>
        <div className="w-64 h-1 bg-gray-100 rounded-full overflow-hidden relative">
          <motion.div 
            className="absolute top-0 left-0 h-full bg-[#3A6FA0]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ 
              duration: 2,
              ease: "easeInOut"
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function AuthModal({ isOpen, onOpenChange, defaultView = 'customer' }: AuthModalProps) {
  const [view, setView] = useState<'customer' | 'admin'>(defaultView);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView(defaultView);
      setIsSuccess(false);
    }
  }, [isOpen, defaultView]);

  const handleLoginSuccess = () => {
    setIsSuccess(true);
    setTimeout(() => {
      onOpenChange(false);
      // Wait for modal exit animation before resetting success state
      setTimeout(() => setIsSuccess(false), 500);
    }, 2200);
  };

  // When modal closes, reset to default view after a delay so it doesn't flip visually while closing
  const handleOpenChange = (open: boolean) => {
    if (isSuccess && !open) return; // Prevent closing via backdrop/escape during success animation
    onOpenChange(open);
    if (!open) {
      setTimeout(() => setView(defaultView), 300);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 bg-transparent border-none shadow-none overflow-hidden [&>button]:right-6 [&>button]:top-6 [&>button]:text-gray-500 [&>button]:hover:text-gray-900 [&>button]:z-50 [&>button]:bg-white/80 [&>button]:rounded-full [&>button]:p-1 [&>button]:backdrop-blur-md">
        <VisuallyHidden>
          <DialogTitle>Authentication</DialogTitle>
        </VisuallyHidden>

        <div className="relative w-full max-h-[85vh] overflow-y-auto bg-white/95 backdrop-blur-3xl border border-white/20 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.3)] rounded-[2.5rem] p-6 sm:p-12 scrollbar-none">
          <div className="py-4">
            <AnimatePresence mode="wait" initial={false}>
            {isSuccess ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                <LogoLoader />
              </motion.div>
            ) : view === 'customer' ? (
              <motion.div
                key="customer"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <CustomerAuthModule 
                  isModal={true}
                  onSwitchToAdmin={() => setView('admin')} 
                  onSuccess={handleLoginSuccess} 
                />
              </motion.div>
            ) : (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <AdminAuthModule 
                  isModal={true}
                  onSwitchToCustomer={() => setView('customer')} 
                  onSuccess={handleLoginSuccess} 
                />
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

