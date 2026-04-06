"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { PhoneInputWithFlag } from "@/components/customers/phone-input-with-flag";
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { PasswordValidationTooltip } from '@/components/ui/password-validation-tooltip';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export function AuthModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { login, register, requestEmailOtp, loginWithEmailOtp } = useAuth();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  // Email OTP state
  const [otpMode, setOtpMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Reset OTP state when modal closes or tab changes
  useEffect(() => {
    if (!open) {
      setOtpMode(false);
      setOtpSent(false);
      setOtpCode("");
      setResendCountdown(0);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    setOtpMode(false);
    setOtpSent(false);
    setOtpCode("");
    setResendCountdown(0);
    setError(null);
  }, [tab]);

  const validateSignupForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = 'Password must contain at least one uppercase letter';
    } else if (!/[@$!%*?&]/.test(password)) {
      newErrors.password = 'Password must contain at least one special character';
    }

    if (!licenseNumber.trim()) {
      newErrors.licenseNumber = 'NPI / License number is required';
    }

    if (!firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // mobile is optional
    if (mobile) {
      const digitsOnly = mobile.replace(/\D/g, '');
      const localTen = digitsOnly.slice(-10);
      if (localTen.length !== 10) {
        newErrors.mobile = 'Mobile number must be exactly 10 digits';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isSignupFormValid = () => {
    const hasValidEmail = email && /\S+@\S+\.\S+/.test(email);
    const hasValidPassword = password && password.length >= 8 && /[A-Z]/.test(password) && /[@$!%*?&]/.test(password);
    const hasValidFirstName = firstName.trim();
    const hasValidLastName = lastName.trim();
    const hasValidLicense = licenseNumber.trim();

    return hasValidEmail && hasValidPassword && hasValidFirstName && hasValidLastName && hasValidLicense;
  };

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    const ok = await login(email, password);
    if (!ok) setError("Login failed"); else onOpenChange(false);
    setLoading(false);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});

    if (!validateSignupForm()) {
      return;
    }

    setLoading(true);
    const ok = await register({
      email,
      password,
      firstName,
      lastName,
      mobile,
      companyName: companyName.trim() || undefined,
      licenseNumber: licenseNumber.trim() || undefined,
    });
    if (!ok) setError("Registration failed"); else setTab("signin");
    setLoading(false);
  }

  // Handle switching to OTP mode
  const handleSwitchToOtpMode = () => {
    setError(null);
    setOtpMode(true);
  };

  // Handle requesting OTP
  async function handleRequestOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setError(null);
    setLoading(true);

    const result = await requestEmailOtp(email);

    if (result.success) {
      toast.success("Verification code sent to your email.");
      setOtpSent(true);
      setResendCountdown(120); // 2 minutes countdown
    } else {
      setError(result.error || "Failed to send code");
    }

    setLoading(false);
  }

  // Handle verifying OTP
  async function handleVerifyOtp(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (otpCode.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    setError(null);
    setLoading(true);

    const ok = await loginWithEmailOtp(email, otpCode, {
      onError: (err) => setError(err),
    });

    if (ok) {
      onOpenChange(false);
    }

    setLoading(false);
  }

  // Handle resending OTP
  async function handleResendOtp() {
    if (resendCountdown > 0) return;

    setError(null);
    setLoading(true);
    setOtpCode("");

    const result = await requestEmailOtp(email);

    if (result.success) {
      setResendCountdown(120);
    } else {
      setError(result.error || "Failed to resend code");
    }

    setLoading(false);
  }

  // Handle going back to password login
  const handleBackToPassword = () => {
    setOtpMode(false);
    setOtpSent(false);
    setOtpCode("");
    setResendCountdown(0);
    setError(null);
  };

  // Render OTP verification screen
  const renderOtpVerification = () => (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleBackToPassword}
        className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to password login
      </button>

      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Check your email</h3>
        <p className="text-sm text-gray-600 mt-1">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>
      </div>

      <form onSubmit={handleVerifyOtp} className="space-y-4">
        <div className="flex justify-center py-2">
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
            Please wait 2 minutes before regenerating a code
          </p>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendCountdown > 0 || loading}
            className="text-sm text-primary hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            {resendCountdown > 0
              ? `Resend code in ${Math.floor(resendCountdown / 60)}:${(resendCountdown % 60).toString().padStart(2, '0')}`
              : 'Resend code'}
          </button>
        </div>

        <Button type="submit" className="w-full" disabled={loading || otpCode.length !== 6}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Verify & Sign In'
          )}
        </Button>
      </form>
    </div>
  );

  // Render OTP request screen (when email not yet submitted)
  const renderOtpRequest = () => (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleBackToPassword}
        className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to password login
      </button>

      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mb-3">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Login with email code</h3>
        <p className="text-sm text-gray-600 mt-1">
          We'll send a one-time verification code to your email
        </p>
      </div>

      <form onSubmit={handleRequestOtp} className="space-y-4">
        <div>
          <Label htmlFor="otp-email">Email address</Label>
          <Input
            id="otp-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading || !email}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending code...
            </>
          ) : (
            'Send verification code'
          )}
        </Button>
      </form>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[92vw] p-0 overflow-hidden">
        <div className="p-6">
          <div className="text-center mb-4 flex justify-center">
            <Image src="/logo.png" alt="Logo" width={140} height={140} />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            {error && (
              <Alert variant="destructive" className="mb-3">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <TabsContent value="signin">
              {otpMode ? (
                otpSent ? renderOtpVerification() : renderOtpRequest()
              ) : (
                <>
                  <form onSubmit={handleSignin} className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email address</Label>
                      <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                        <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? (<EyeOff className="h-4 w-4 text-gray-400" />) : (<Eye className="h-4 w-4 text-gray-400" />)}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>{loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : 'Sign In'}</Button>
                  </form>
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={handleSwitchToOtpMode}
                      className="text-sm text-primary hover:underline"
                    >
                      Login using email one-time verification code
                    </button>
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>First name <span className="text-red-500">*</span></Label>
                    <Input placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={errors.firstName ? 'border-red-500' : ''} />
                    {errors.firstName && (<p className="text-sm text-red-600">{errors.firstName}</p>)}
                  </div>
                  <div>
                    <Label>Last name <span className="text-red-500">*</span></Label>
                    <Input placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required className={errors.lastName ? 'border-red-500' : ''} />
                    {errors.lastName && (<p className="text-sm text-red-600">{errors.lastName}</p>)}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Company</Label>
                    <Input
                      placeholder="RefinedMD"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>NPI / License Number <span className="text-red-500">*</span></Label>
                    <Input
                      placeholder="e.g., 1234567890"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className={errors.licenseNumber ? 'border-red-500' : ''}
                    />
                    {errors.licenseNumber && (<p className="text-sm text-red-600">{errors.licenseNumber}</p>)}
                  </div>
                </div>
                <div>
                  <Label>Email address <span className="text-red-500">*</span></Label>
                  <Input type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={errors.email ? 'border-red-500' : ''} />
                  {errors.email && (<p className="text-sm text-red-600">{errors.email}</p>)}
                </div>
                <div>
                  <Label>Mobile <span className="text-red-500">*</span></Label>
                  <PhoneInputWithFlag value={mobile} onChange={(v) => setMobile(v)} placeholder="e.g., +1 555 000 1111" className={errors.mobile ? 'border-red-500' : ''} />
                  {errors.mobile && (<p className="text-sm text-red-600">{errors.mobile}</p>)}
                </div>
                <div>
                  <Label>Password <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setShowPasswordValidation(e.target.value.length > 0);
                      }}
                      onFocus={() => setShowPasswordValidation(password.length > 0)}
                      onBlur={() => setShowPasswordValidation(false)}
                      required
                      className={`pr-10 ${errors.password ? 'border-red-500' : ''}`}
                    />
                    <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? (<EyeOff className="h-4 w-4 text-gray-400" />) : (<Eye className="h-4 w-4 text-gray-400" />)}
                    </button>
                    <PasswordValidationTooltip password={password} show={showPasswordValidation} />
                  </div>
                  {errors.password && (<p className="text-sm text-red-600">{errors.password}</p>)}
                </div>
                <Button type="submit" className="w-full" disabled={loading || !isSignupFormValid()}>{loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>) : 'Create Account'}</Button>
              </form>
              <div className="mt-4">
                {/* <Alert>
                  <AlertDescription className="text-sm">
                    <strong>Customer Account Approval:</strong><br />
                    After signing up, your account will be reviewed by our team.
                  </AlertDescription>
                </Alert> */}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
