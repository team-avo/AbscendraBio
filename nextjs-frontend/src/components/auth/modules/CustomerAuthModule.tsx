'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';

// Import refactored components
import { SignInForm } from '@/components/auth/login/SignInForm';
import { SignUpForm } from '@/components/auth/login/SignUpForm';
import { OtpVerification } from '@/components/auth/login/OtpVerification';
import { ForgotPasswordDialog } from '@/components/auth/login/ForgotPasswordDialog';
import logger from '@/lib/logger';
import { getDeviceInfo, queueLoginFailure, getQueuedLoginFailures, clearLoginFailureQueue } from '@/utils/deviceInfo';

interface CustomerAuthModuleProps {
  onSwitchToAdmin?: () => void;
  onSuccess?: () => void;
  isModal?: boolean;
}

export function CustomerAuthModule({ onSwitchToAdmin, onSuccess, isModal = false }: CustomerAuthModuleProps) {
  const [mounted, setMounted] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; firstName?: string; lastName?: string; mobile?: string; licenseNumber?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portalMismatch, setPortalMismatch] = useState<null | 'ADMIN_ON_CUSTOMER'>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const {
    login,
    register,
    isAuthenticated,
    isLoading,
    showEmailVerificationModal,
    setShowEmailVerificationModal,
    user,
    requestEmailOtp,
    loginWithEmailOtp
  } = useAuth();
  
  const router = useRouter();
  
  let searchParams: any = null;
  try {
    searchParams = useSearchParams();
  } catch (e) {
  }

  useEffect(() => {
    if (searchParams) {
      const tabParam = searchParams.get('tab');
      if (tabParam === 'signup') {
        setTab('signup');
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  useEffect(() => {
    setOtpMode(false);
    setOtpSent(false);
    setOtpCode("");
    setResendCountdown(0);
    setErrors({});
  }, [tab]);

  const handleSwitchToOtpMode = () => {
    setErrors({});
    setOtpMode(true);
  };

  async function handleRequestOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setErrors(prev => ({ ...prev, email: "Please enter a valid email address" }));
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const result = await requestEmailOtp(email);
      if (result.success) {
        toast.success("Verification code sent to your email.");
        setOtpSent(true);
        setResendCountdown(120);
      } else {
        const error = result.error || "Failed to send code";
        if (error.toLowerCase().includes("does not exist") || error.toLowerCase().includes("not found")) {
          setErrors(prev => ({ ...prev, email: error }));
        } else {
          toast.error(error);
        }
      }
    } catch (err) {
      toast.error("Failed to send verification code");
    }
    setIsSubmitting(false);
  }

  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      const loggedInUser = await loginWithEmailOtp(email, otpCode, {
        portal: 'CUSTOMER',
        onError: (err) => { toast.error(err); },
      });
      if (loggedInUser) {
        if (onSuccess) onSuccess();
        if (loggedInUser.role === 'CUSTOMER') router.push('/landing');
        else router.push('/admin-dashboard');
      }
    } catch (err) {
      toast.error("An unexpected error occurred during verification");
    }
    setIsSubmitting(false);
  }

  async function handleResendOtp() {
    if (resendCountdown > 0) return;
    setErrors({});
    setIsSubmitting(true);
    setOtpCode("");
    try {
      const result = await requestEmailOtp(email);
      if (result.success) {
        setResendCountdown(120);
        toast.success("A new verification code has been sent");
      } else {
        toast.error(result.error || "Failed to resend code");
      }
    } catch (err) {
      toast.error("Failed to resend verification code");
    }
    setIsSubmitting(false);
  }

  const handleBackToPassword = () => {
    setOtpMode(false);
    setOtpSent(false);
    setOtpCode("");
    setResendCountdown(0);
    setErrors({});
  };

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; firstName?: string; lastName?: string; mobile?: string; licenseNumber?: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    } else if (/\s/.test(password)) {
      newErrors.password = 'Password cannot contain spaces';
    }

    if (tab === 'signup') {
      if (password && password.length < 4) newErrors.password = 'Password must be at least 4 characters';
      else if (password && /\s/.test(password)) newErrors.password = 'Password cannot contain spaces';
      
      if (!licenseNumber || !licenseNumber.trim()) newErrors.licenseNumber = 'NPI / License number is required';
      if (!firstName) newErrors.firstName = 'First name is required';
      if (!lastName) newErrors.lastName = 'Last name is required';

      if (!mobile || !mobile.trim()) {
        newErrors.mobile = 'Mobile number is required';
      } else {
        const digitsOnly = mobile.replace(/\D/g, '');
        if (digitsOnly.slice(-10).length !== 10) newErrors.mobile = 'Mobile number must be exactly 10 digits';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setForgotEmail((email || '').trim().toLowerCase());
    setForgotOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (portalMismatch) setPortalMismatch(null);
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      if (tab === 'signup') {
        const loggedInUser = await login(email, password, {
          suppressToasts: true, portal: 'CUSTOMER', onError: (err) => {
            if ((err || '').toLowerCase().includes("admins can't login")) setPortalMismatch('ADMIN_ON_CUSTOMER');
          }
        });
        if (loggedInUser) {
          setPortalMismatch(null);
          if (onSuccess) onSuccess();
          if (loggedInUser.role === 'CUSTOMER') router.push('/landing');
          else router.push('/admin-dashboard');
          return;
        }

        if (!firstName || !lastName || !licenseNumber) {
          validateForm();
          setIsSubmitting(false);
          return;
        }
        
        const registered = await register({
          email, password, firstName, lastName, role: 'CUSTOMER', mobile,
          companyName: companyName.trim() || undefined,
          licenseNumber: licenseNumber.trim() || undefined,
          city: city.trim() || undefined,
          zip: zip.trim() || undefined,
        });
        if (registered) {
          setShowApprovalModal(true);
          try { (await import('sonner')).toast?.info?.('We sent a verification email. Please verify your email.'); } catch { }
          return;
        }
      } else {
        let loginErrorMessage: string | null = null;
        const loggedInUser = await login(email, password, {
          suppressToasts: true, portal: 'CUSTOMER', onError: (err) => {
            loginErrorMessage = err;
            if ((err || '').toLowerCase().includes("admins can't login")) setPortalMismatch('ADMIN_ON_CUSTOMER');
          }
        });
        
        if (loggedInUser) {
          setPortalMismatch(null);
          if (onSuccess) onSuccess();
          if (loggedInUser.role === 'CUSTOMER') router.push('/landing');
          else router.push('/admin-dashboard');
        } else if (loginErrorMessage) {
          const msg = (loginErrorMessage as string).toLowerCase();
          if (msg.includes('user not found')) setErrors(prev => ({ ...prev, email: 'Email address not found' }));
          else if (msg.includes('invalid password')) setErrors(prev => ({ ...prev, password: 'Password is incorrect' }));
          else if (msg.includes('network error') || msg.includes('failed to fetch')) {
            toast.error("Network error: Unable to connect to site.");
            const deviceInfo = getDeviceInfo();
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              queueLoginFailure({ email, portal: 'customer', failureReason: 'NETWORK_ERROR', failureDetail: msg, deviceInfo, timestamp: new Date().toISOString() });
            } else {
              api.reportLoginFailure({ email, portal: 'customer', failureReason: 'NETWORK_ERROR', failureDetail: msg, deviceInfo }).catch(() => { });
            }
          } else {
            setErrors(prev => ({ ...prev, password: 'Email or password is incorrect' }));
          }
        }
      }
    } catch (error: any) {
      logger.error('Login error:', { error });
      if (tab === 'signup' && error?.response?.data?.error) {
        const errorMessage = error.response.data.error;
        if (errorMessage.includes('email') && errorMessage.includes('already')) setErrors(prev => ({ ...prev, email: 'Email already taken' }));
        else if (errorMessage.includes('mobile') && errorMessage.includes('already')) setErrors(prev => ({ ...prev, mobile: 'Mobile number already taken' }));
        else toast.error(errorMessage);
      } else if (tab === 'signin') {
        const errorMessage = (error?.response?.data?.error || error?.response?.data?.message || error?.message || '').toLowerCase();
        if (errorMessage.includes('verification') || errorMessage.includes('pending') || errorMessage.includes('approval') || errorMessage.includes('inactive')) return toast.error(error?.response?.data?.error || 'Account status issue');
        if (errorMessage.includes('not found') || errorMessage.includes('user does not exist') || errorMessage.includes('email does not exist')) setErrors(prev => ({ ...prev, email: 'Email is not valid' }));
        else if (errorMessage.includes('password mismatch') || errorMessage.includes('wrong password') || errorMessage.includes('incorrect password') || errorMessage.includes('invalid password')) setErrors(prev => ({ ...prev, password: 'Password is invalid' }));
        else if (errorMessage.includes('failed') || errorMessage.includes('invalid credentials') || errorMessage.includes('unauthorized')) {
            if (!/\S+@\S+\.\S+/.test(email)) setErrors(prev => ({ ...prev, email: 'Email is not valid' }));
            else setErrors(prev => ({ ...prev, password: 'Email or password is incorrect' }));
        }
        else if (errorMessage.includes('email')) setErrors(prev => ({ ...prev, email: 'Email is not valid' }));
        else if (errorMessage.includes('password')) setErrors(prev => ({ ...prev, password: 'Password is invalid' }));
        else if (errorMessage) toast.error(error?.response?.data?.error || error?.response?.data?.message || errorMessage);
        else toast.error('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    const entered = (forgotEmail || "").trim().toLowerCase();
    if (!entered || !/\S+@\S+\.\S+/.test(entered)) {
      toast.error("Please enter a valid email");
      return;
    }
    try {
      setForgotLoading(true);
      const resp = await api.requestPasswordReset(entered);
      if (resp.success) {
        toast.success("Password reset email sent successfully");
        setForgotOpen(false);
      } else toast.error(resp.error || "Failed to request password reset");
    } catch (err: any) {
      toast.error(err?.message || "Failed to request password reset");
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const flushQueue = () => {
      const queued = getQueuedLoginFailures();
      if (queued.length === 0) return;
      clearLoginFailureQueue();
      queued.forEach((evt) => { api.reportLoginFailure(evt).catch(() => { }); });
    };
    if (typeof navigator !== 'undefined' && navigator.onLine) flushQueue();
    window.addEventListener('online', flushQueue);
    return () => window.removeEventListener('online', flushQueue);
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full">
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="text-center">Email Verification Required</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <p className="text-center text-sm text-gray-600">A verification email has been sent to your registered email address. Please verify your email to continue.</p>
            <Button className="w-full" onClick={() => setShowApprovalModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmailVerificationModal} onOpenChange={setShowEmailVerificationModal}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="text-center">Verify Your Email</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <p className="text-center text-sm text-gray-600">A verification email has been sent to your registered email address. Please check your inbox and verify to continue.</p>
            <Button className="w-full" onClick={() => setShowEmailVerificationModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!isModal && (
        <div className="text-center mb-8">
          <div className="flex items-center justify-center">
            <Image src="/Centre-Labs-logo-sm.png" alt="Logo" width={160} height={160} priority />
          </div>
        </div>
      )}

      <Card className={`border-none shadow-none bg-transparent  ${!isModal ? 'bg-white/80 backdrop-blur-2xl border-white/40 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-4 sm:p-6 rounded-[2rem]' : ''}`}>
        <CardHeader className={isModal ? "px-0 pt-0" : ""}>
          <CardTitle className="text-center text-2xl mb-2">Sign in or create an account</CardTitle>
        </CardHeader>
        <CardContent className={isModal ? "px-0 pb-0" : ""}>
          <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setErrors({}); if (portalMismatch) setPortalMismatch(null); }}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {otpMode ? (
                <OtpVerification email={email} setEmail={setEmail} otpSent={otpSent} otpCode={otpCode} setOtpCode={setOtpCode} resendCountdown={resendCountdown} isSubmitting={isSubmitting} errors={errors} onBackToPassword={handleBackToPassword} onRequestOtp={handleRequestOtp} onVerifyOtp={handleVerifyOtp} onResendOtp={handleResendOtp} />
              ) : (
                <SignInForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} errors={errors} isSubmitting={isSubmitting} isLoading={isLoading} mounted={mounted} portalMismatch={portalMismatch} setPortalMismatch={setPortalMismatch} onSubmit={handleSubmit} onForgotPassword={handleForgotPassword} onSwitchToOtp={handleSwitchToOtpMode} clearErrors={(field) => setErrors(prev => ({ ...prev, [field]: undefined }))} />
              )}
            </TabsContent>

            <TabsContent value="signup">
              <SignUpForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} mobile={mobile} setMobile={setMobile} companyName={companyName} setCompanyName={setCompanyName} licenseNumber={licenseNumber} setLicenseNumber={setLicenseNumber} city={city} setCity={setCity} zip={zip} setZip={setZip} showPassword={showPassword} setShowPassword={setShowPassword} setShowPasswordValidation={setShowPasswordValidation} errors={errors} isSubmitting={isSubmitting} isLoading={isLoading} mounted={mounted} onSubmit={handleSubmit} onSwitchToOtp={() => { setTab('signin'); handleSwitchToOtpMode(); }} />
            </TabsContent>
          </Tabs>

          <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} email={forgotEmail} setEmail={setForgotEmail} loading={forgotLoading} onReset={handlePasswordReset} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 mt-6">
        <div className="text-center text-sm font-medium">
          {onSwitchToAdmin ? (
            <button type="button" onClick={onSwitchToAdmin} className="text-gray-500 hover:text-[#070B14] transition-colors">
              Are you an administrator? <span className="text-[#3A6FA0] underline-offset-4 hover:underline ml-1">Admin Login &rarr;</span>
            </button>
          ) : (
            <a href="/admin/login" className="text-gray-500 hover:text-[#070B14] transition-colors">
              Are you an administrator? <span className="text-[#3A6FA0] underline-offset-4 hover:underline ml-1">Admin Login &rarr;</span>
            </a>
          )}
        </div>
        {!isModal && (
          <div className="text-center">
            <p className="text-xs text-gray-500">© {new Date().getFullYear()} Ascendra Bio. All rights reserved.</p>
          </div>
        )}
      </div>
    </div>
  );
}
