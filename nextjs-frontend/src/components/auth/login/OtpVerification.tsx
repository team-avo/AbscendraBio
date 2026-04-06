'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Mail } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface OtpVerificationProps {
    email: string;
    setEmail: (email: string) => void;
    otpSent: boolean;
    otpCode: string;
    setOtpCode: (code: string) => void;
    resendCountdown: number;
    isSubmitting: boolean;
    errors: { email?: string };
    onBackToPassword: () => void;
    onRequestOtp: (e?: React.FormEvent) => void;
    onVerifyOtp: (e?: React.FormEvent) => void;
    onResendOtp: () => void;
}

export function OtpVerification({
    email,
    setEmail,
    otpSent,
    otpCode,
    setOtpCode,
    resendCountdown,
    isSubmitting,
    errors,
    onBackToPassword,
    onRequestOtp,
    onVerifyOtp,
    onResendOtp,
}: OtpVerificationProps) {
    if (otpSent) {
        return (
            <div className="space-y-6 py-2">
                <button
                    type="button"
                    onClick={onBackToPassword}
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

                <form onSubmit={onVerifyOtp} className="space-y-6">
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
                            onClick={onResendOtp}
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
    }

    return (
        <div className="space-y-6 py-2">
            <button
                type="button"
                onClick={onBackToPassword}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to password login
            </button>

            <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                    <Mail className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Login with email code</h3>
                <p className="text-sm text-gray-600 mt-2">
                    We'll send a one-time verification code to your email for passwordless access.
                </p>
            </div>

            <form onSubmit={onRequestOtp} className="space-y-6">
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
}
