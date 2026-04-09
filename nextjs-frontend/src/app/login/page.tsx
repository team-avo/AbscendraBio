import { HeroBackground } from '@/components/ui/HeroBackground';
import { CustomerAuthModule } from '@/components/auth/modules/CustomerAuthModule';
import { Suspense } from 'react';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <HeroBackground />
      <div className="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <Suspense fallback={<div className="min-h-[400px] flex items-center justify-center">Loading...</div>}>
             <CustomerAuthModule isModal={false} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
