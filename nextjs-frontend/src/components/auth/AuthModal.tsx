'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogOverlay, DialogTitle } from '@/components/ui/dialog';
import { CustomerAuthModule } from './modules/CustomerAuthModule';
import { AdminAuthModule } from './modules/AdminAuthModule';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { AnimatePresence, motion } from 'framer-motion';

interface AuthModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultView?: 'customer' | 'admin';
}

export function AuthModal({ isOpen, onOpenChange, defaultView = 'customer' }: AuthModalProps) {
  const [view, setView] = useState<'customer' | 'admin'>(defaultView);

  useEffect(() => {
    if (isOpen) {
      setView(defaultView);
    }
  }, [isOpen, defaultView]);

  // When modal closes, reset to default view after a delay so it doesn't flip visually while closing
  const handleOpenChange = (open: boolean) => {
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
            {view === 'customer' ? (
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
                  onSuccess={() => handleOpenChange(false)} 
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
                  onSuccess={() => handleOpenChange(false)} 
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
