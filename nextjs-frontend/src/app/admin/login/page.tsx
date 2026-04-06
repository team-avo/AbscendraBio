'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { getDeviceInfo, queueLoginFailure, getQueuedLoginFailures, clearLoginFailureQueue } from '@/utils/deviceInfo';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, EyeOff, ArrowLeft, Mail } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import Image from 'next/image';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [portalMismatch, setPortalMismatch] = useState<null | 'CUSTOMER_ON_ADMIN'>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Email OTP state
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  const { login, isAuthenticated, isLoading, hasRole, logout, user, requestEmailOtp, loginWithEmailOtp } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // For admins/managers/staff, go to admin dashboard; customers show inline message
      if (user.role === 'CUSTOMER') {
        (async () => { try { await logout({ suppressToasts: true, noRedirect: true }); } catch { } })();
        setPortalMismatch('CUSTOMER_ON_ADMIN');
      } else if (user.role === 'SALES_MANAGER') {
        // Sales managers go to their team page
        router.push('/sales-manager/my-team');
      } else if (user.role === 'SALES_REP') {
        // Sales reps go to orders
        router.push('/orders');
      } else {
        router.push('/admin-dashboard');
      }
    }
  }, [isAuthenticated, isLoading, router, hasRole, logout, user]);

  // Flush any queued offline login failures when back online
  useEffect(() => {
    const flushQueue = () => {
      const queued = getQueuedLoginFailures();
      if (queued.length === 0) return;
      clearLoginFailureQueue();
      queued.forEach((evt) => {
        api.reportLoginFailure(evt).catch(() => { });
      });
    };
    if (typeof navigator !== 'undefined' && navigator.onLine) flushQueue();
    window.addEventListener('online', flushQueue);
    return () => window.removeEventListener('online', flushQueue);
  }, []);

  // OTP flow effects
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email is invalid';
    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 4) newErrors.password = 'Password must be at least 4 characters';
    else if (/\s/.test(password)) newErrors.password = 'Password cannot contain spaces';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuthError = (message: string | undefined) => {
    const lower = (message || '').toLowerCase();
    const nextErrors: { email?: string; password?: string } = {};

    if (lower.includes('email')) {
      nextErrors.email = message || 'Email is invalid';
    }
    if (lower.includes('password')) {
      nextErrors.password = message || 'Password is invalid';
    }

    if (!nextErrors.email && !nextErrors.password) {
      nextErrors.password = message || 'Invalid email or password';
      nextErrors.email = message?.toLowerCase().includes('credentials') ? message : undefined;
    }

    setErrors(prev => ({ ...prev, ...nextErrors }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (portalMismatch) setPortalMismatch(null);
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      setErrors({});
      let portalMismatchDetected = false;
      const success = await login(email, password, {
        suppressToasts: true, portal: 'ADMIN', onError: (err) => {
          const errorMsg = err || 'Login failed';
          if (errorMsg.toLowerCase().includes('customers can’t login') || errorMsg.toLowerCase().includes("customers can't login")) {
            portalMismatchDetected = true;
            setPortalMismatch('CUSTOMER_ON_ADMIN');
          } else {
            handleAuthError(errorMsg);
          }
        }
      });
      if (success && user) {
        if (user.role === 'CUSTOMER') {
          try { await logout({ suppressToasts: true, noRedirect: true }); } catch { }
          setPortalMismatch('CUSTOMER_ON_ADMIN');
        } else if (user.role === 'SALES_MANAGER') {
          router.push('/sales-manager/my-team');
        } else if (user.role === 'SALES_REP') {
          router.push('/orders');
        } else {
          router.push('/admin-dashboard');
        }
      } else if (!portalMismatchDetected) {
        handleAuthError('Invalid email or password');
      }
    } catch (err) {
      handleAuthError('Login failed');
      toast.error('Login failed');
      // Report client-side errors for audit trail (fire-and-forget)
      const deviceInfo = getDeviceInfo();
      const failurePayload = { email, portal: 'admin', failureReason: 'NETWORK_ERROR' as const, failureDetail: (err as Error)?.message || 'Unknown error in catch block', deviceInfo, timestamp: new Date().toISOString() };
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        queueLoginFailure(failurePayload);
      } else {
        api.reportLoginFailure(failurePayload).catch(() => { });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle switching to OTP mode
  const handleSwitchToOtpMode = () => {
    setErrors({});
    setOtpMode(true);
  };

  // Handle requesting OTP
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
        setResendCountdown(120); // 2 minutes countdown
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

  // Handle verifying OTP
  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const ok = await loginWithEmailOtp(email, otpCode, {
        portal: 'ADMIN',
        onError: (err) => {
          toast.error(err);
        },
      });

      if (ok) {
        // Successful login - AuthContext will handle state, then AdminLoginPage redirect effect will kick in
      }
    } catch (err) {
      toast.error("An unexpected error occurred during verification");
    }

    setIsSubmitting(false);
  }

  // Handle resending OTP
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

  // Handle going back to password login
  const handleBackToPassword = () => {
    setOtpMode(false);
    setOtpSent(false);
    setOtpCode("");
    setResendCountdown(0);
    setErrors({});
  };

  // Render OTP verification screen
  const renderOtpVerification = () => (
    <div className="space-y-6 py-2">
      <button
        type="button"
        onClick={handleBackToPassword}
        className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to password login
      </button>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Check your email</h3>
        <p className="text-sm text-gray-600 mt-2">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>
      </div>

      <form onSubmit={handleVerifyOtp} className="space-y-6">
        <div className="flex justify-center py-4">
          <div className="flex gap-2">
            <InputOTP
              maxLength={6}
              value={otpCode}
              onChange={(value) => setOtpCode(value)}
              autoFocus
            >
              <InputOTPGroup className="gap-2">
                <InputOTPSlot className="h-12 w-12 text-lg border-2" index={0} />
                <InputOTPSlot className="h-12 w-12 text-lg border-2" index={1} />
                <InputOTPSlot className="h-12 w-12 text-lg border-2" index={2} />
                <InputOTPSlot className="h-12 w-12 text-lg border-2" index={3} />
                <InputOTPSlot className="h-12 w-12 text-lg border-2" index={4} />
                <InputOTPSlot className="h-12 w-12 text-lg border-2" index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">
            Didn't receive the code?
          </p>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCountdown > 0 || isSubmitting}
            className="text-sm font-semibold text-blue-600 hover:text-blue-500 disabled:text-gray-400 disabled:no-underline"
          >
            {resendCountdown > 0
              ? `Resend code in ${Math.floor(resendCountdown / 60)}:${(resendCountdown % 60).toString().padStart(2, '0')}`
              : 'Resend code'}
          </button>
        </div>

        <Button type="submit" className="w-full h-11" disabled={isSubmitting || otpCode.length !== 6}>
          {isSubmitting ? (
            <>
              <LoadingSpinner size={16} className="mr-2" />
              Verifying...
            </>
          ) : (
            'Verify & Sign In'
          )}
        </Button>
      </form>
    </div>
  );

  // Render OTP request screen
  const renderOtpRequest = () => (
    <div className="space-y-6 py-2">
      <button
        type="button"
        onClick={handleBackToPassword}
        className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to password login
      </button>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
          <Mail className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Admin Login Code</h3>
        <p className="text-sm text-gray-600 mt-2">
          We'll send a one-time verification code to your email for passwordless admin access.
        </p>
      </div>

      <form onSubmit={handleRequestOtp} className="space-y-6">
        <div>
          <Label className="mb-1 block" htmlFor="otp-email">Email address <span className="text-red-500">*</span></Label>
          <Input
            id="otp-email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (<p className="mt-1 text-sm text-red-600">{errors.email}</p>)}
        </div>

        <Button type="submit" className="w-full h-11" disabled={isSubmitting || !email}>
          {isSubmitting ? (
            <>
              <LoadingSpinner size={16} className="mr-2" />
              Sending code...
            </>
          ) : (
            'Send verification code'
          )}
        </Button>
      </form>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size={32} />
      </div>
    );
  }
  if (isAuthenticated) return null;

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex items-center justify-center mt-6">
              <Image src="/Centre-Labs-logo.png" alt="Logo" width={160} height={160} priority />
            </div>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-center">Admin Sign In</CardTitle>
            </CardHeader>
            <CardContent>
              {otpMode ? (
                otpSent ? renderOtpVerification() : renderOtpRequest()
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <Label htmlFor="email">Email address</Label>
                      <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={errors.email ? 'border-red-500' : ''} placeholder="admin@example.com" />
                      {errors.email && (<p className="mt-1 text-sm text-red-600">{errors.email}</p>)}
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={errors.password ? 'border-red-500 pr-10' : 'pr-10'} placeholder="Enter your password" />
                        <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? (<EyeOff className="h-4 w-4 text-gray-400" />) : (<Eye className="h-4 w-4 text-gray-400" />)}
                        </button>
                      </div>
                      {errors.password && (<p className="mt-1 text-sm text-red-600">{errors.password}</p>)}
                      {portalMismatch === 'CUSTOMER_ON_ADMIN' && (
                        <p className="mt-1 text-sm text-red-600">
                          Oops! Customers can’t login to admin panel, please <a href="/login" className="underline text-blue-600">click here</a> to login via Customer login.
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <button
                          type="button"
                          className="font-medium text-blue-600 hover:text-blue-500 underline-offset-2 hover:underline"
                          onClick={() => {
                            setForgotEmail(email);
                            setForgotOpen(true);
                          }}
                        >
                          Forgot your password?
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (<><LoadingSpinner size={16} className="mr-2" />Signing in...</>) : ('Sign in')}
                    </Button>
                  </form>

                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={handleSwitchToOtpMode}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      Login using email one-time verification code
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} Centre Labs. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="forgotEmail">Email address</Label>
            <Input
              id="forgotEmail"
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setForgotOpen(false)}>Cancel</Button>
            <Button
              disabled={forgotLoading}
              onClick={async () => {
                const entered = (forgotEmail || '').trim().toLowerCase();
                if (!entered || !/\S+@\S+\.\S+/.test(entered)) {
                  toast.error('Please enter a valid email');
                  return;
                }
                try {
                  setForgotLoading(true);
                  const resp = await api.requestPasswordReset(entered);
                  if (resp.success) {
                    toast.success('Password reset email sent successfully');
                    setForgotOpen(false);
                    setForgotEmail('');
                  } else {
                    toast.error(resp.error || 'Failed to request password reset');
                  }
                } catch (error: any) {
                  toast.error(error?.message || 'Failed to request password reset');
                } finally {
                  setForgotLoading(false);
                }
              }}
            >
              {forgotLoading ? (<><LoadingSpinner size={16} className="mr-2" />Sending...</>) : 'Send Reset Link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
