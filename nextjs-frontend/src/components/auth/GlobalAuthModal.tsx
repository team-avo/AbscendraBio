'use client';

import { useAuth } from '@/contexts/auth-context';
import { AuthModal } from './AuthModal';

export function GlobalAuthModal() {
  const { showAuthModal, setShowAuthModal, authModalView } = useAuth();

  return (
    <AuthModal 
      isOpen={showAuthModal} 
      onOpenChange={setShowAuthModal} 
      defaultView={authModalView} 
    />
  );
}
