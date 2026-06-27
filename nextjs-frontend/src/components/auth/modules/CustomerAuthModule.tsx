'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

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
  const [smsTransactionalConsent, setSmsTransactionalConsent] = useState(false);
  const [smsMarketingConsent, setSmsMarketingConsent] = useState(false);

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; firstName?: string; lastName?: string; mobile?: string; licenseNumber?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portalMismatch, setPortalMismatch] = useState<null | 'ADMIN_ON_CUSTOMER'>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [emailSentOk, setEmailSentOk] = useState(true);
  const [resendingVerification, setResendingVerification] = useState(false);
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
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (/\s/.test(password)) {
      newErrors.password = 'Password cannot contain spaces';
    }

    if (tab === 'signup') {
      if (password && password.length < 8) newErrors.password = 'Password must be at least 8 characters';
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
          smsTransactionalConsent,
          smsMarketingConsent,
        });
        if (registered) {
          // registered is the full API response — check if email was actually sent
          const sent = (registered as any)?.emailSent !== false;
          setEmailSentOk(sent);
          setShowApprovalModal(true);
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
        const lower = errorMessage.toLowerCase();
        if (lower.includes('email or mobile') || lower.includes('email and mobile')) {
          setErrors(prev => ({ ...prev, email: 'Email already registered', mobile: 'Mobile already registered' }));
        } else if (lower.includes('email') && lower.includes('already')) {
          setErrors(prev => ({ ...prev, email: 'Email already taken' }));
        } else if (lower.includes('mobile') && lower.includes('already')) {
          setErrors(prev => ({ ...prev, mobile: 'Mobile number already taken' }));
        } else {
          toast.error(errorMessage);
        }
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
      {/* Approval modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-lg">
              {emailSentOk ? 'Account created — 2 steps to go' : 'Account created'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-5 pb-2">
            {emailSentOk ? (
              <div className="w-full space-y-3">
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                  <span className="text-blue-500 font-black text-base shrink-0">1</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Verify your email</p>
                    <p className="text-xs text-gray-500 mt-0.5">We sent a link to <strong>{email}</strong>. Click it to confirm your address. The link expires in 24 hours.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <span className="text-amber-500 font-black text-base shrink-0">2</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Wait for admin approval</p>
                    <p className="text-xs text-gray-500 mt-0.5">After verification, our team will review your account. You'll receive an email once approved — then you can log in.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full space-y-3">
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4">
                  <span className="text-red-500 font-black text-base shrink-0">!</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Verification email could not be sent</p>
                    <p className="text-xs text-gray-500 mt-0.5">Your account was created but we couldn't send the verification email to <strong>{email}</strong>. Use the button below to try again.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <span className="text-amber-500 font-black text-base shrink-0">2</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Wait for admin approval</p>
                    <p className="text-xs text-gray-500 mt-0.5">Once your email is verified, our team will review your account and email you when approved.</p>
                  </div>
                </div>
              </div>
            )}
            {!emailSentOk && (
              <Button
                variant="outline"
                className="w-full rounded-2xl h-10 text-sm"
                disabled={resendingVerification}
                onClick={async () => {
                  setResendingVerification(true);
                  try {
                    await api.resendVerification(email);
                    setEmailSentOk(true);
                    toast.success('Verification email sent — check your inbox.');
                  } catch {
                    toast.error('Failed to resend. Please try again shortly.');
                  } finally {
                    setResendingVerification(false);
                  }
                }}
              >
                {resendingVerification ? 'Sending…' : 'Resend verification email'}
              </Button>
            )}
            <Button className="w-full rounded-2xl h-11 bg-[#070B14]" onClick={() => setShowApprovalModal(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email verification modal (shown when trying to log in before verifying) */}
      <Dialog open={showEmailVerificationModal} onOpenChange={setShowEmailVerificationModal}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl">
          <DialogHeader><DialogTitle className="text-center">Email not yet verified</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center space-y-4 pb-2">
            <p className="text-center text-sm text-gray-500">
              Your account requires email verification before you can sign in. Check your inbox for the verification link, or request a new one below.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-2xl h-10 text-sm"
              disabled={resendingVerification}
              onClick={async () => {
                if (!email) { toast.error('Enter your email in the sign-in form first'); return; }
                setResendingVerification(true);
                try {
                  await api.resendVerification(email);
                  toast.success('Verification email sent — check your inbox.');
                } catch {
                  toast.error('Failed to resend. Please try again shortly.');
                } finally {
                  setResendingVerification(false);
                }
              }}
            >
              {resendingVerification ? 'Sending…' : 'Resend verification email'}
            </Button>
            <Button className="w-full rounded-2xl h-11 bg-[#070B14]" onClick={() => setShowEmailVerificationModal(false)}>Got it</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign in / Sign up pill tabs */}
      <div className="flex items-center gap-1.5 bg-gray-100 rounded-2xl p-1.5 mb-8">
        <button
          onClick={() => { setTab('signin'); setErrors({}); if (portalMismatch) setPortalMismatch(null); }}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tab === 'signin' ? 'bg-white text-[#070B14] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Sign In
        </button>
        <button
          onClick={() => { setTab('signup'); setErrors({}); if (portalMismatch) setPortalMismatch(null); }}
          className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${tab === 'signup' ? 'bg-white text-[#070B14] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Create Account
        </button>
      </div>

      {tab === 'signin' ? (
        otpMode ? (
          <OtpVerification email={email} setEmail={setEmail} otpSent={otpSent} otpCode={otpCode} setOtpCode={setOtpCode} resendCountdown={resendCountdown} isSubmitting={isSubmitting} errors={errors} onBackToPassword={handleBackToPassword} onRequestOtp={handleRequestOtp} onVerifyOtp={handleVerifyOtp} onResendOtp={handleResendOtp} />
        ) : (
          <SignInForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} showPassword={showPassword} setShowPassword={setShowPassword} errors={errors} isSubmitting={isSubmitting} isLoading={isLoading} mounted={mounted} portalMismatch={portalMismatch} setPortalMismatch={setPortalMismatch} onSubmit={handleSubmit} onForgotPassword={handleForgotPassword} onSwitchToOtp={handleSwitchToOtpMode} clearErrors={(field) => setErrors(prev => ({ ...prev, [field]: undefined }))} />
        )
      ) : (
        <SignUpForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} firstName={firstName} setFirstName={setFirstName} lastName={lastName} setLastName={setLastName} mobile={mobile} setMobile={setMobile} companyName={companyName} setCompanyName={setCompanyName} licenseNumber={licenseNumber} setLicenseNumber={setLicenseNumber} city={city} setCity={setCity} zip={zip} setZip={setZip} smsTransactionalConsent={smsTransactionalConsent} setSmsTransactionalConsent={setSmsTransactionalConsent} smsMarketingConsent={smsMarketingConsent} setSmsMarketingConsent={setSmsMarketingConsent} showPassword={showPassword} setShowPassword={setShowPassword} setShowPasswordValidation={setShowPasswordValidation} errors={errors} isSubmitting={isSubmitting} isLoading={isLoading} mounted={mounted} onSubmit={handleSubmit} onSwitchToOtp={() => { setTab('signin'); handleSwitchToOtpMode(); }} />
      )}

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} email={forgotEmail} setEmail={setForgotEmail} loading={forgotLoading} onReset={handlePasswordReset} />

      {!isModal && (
        <p className="text-center text-xs text-gray-400 mt-8">© {new Date().getFullYear()} Ascendra Bio. All rights reserved.</p>
      )}
    </div>
  );
}
