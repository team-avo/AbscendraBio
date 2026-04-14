'use client';

import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface SignInFormProps {
    email: string;
    setEmail: (email: string) => void;
    password: string;
    setPassword: (password: string) => void;
    showPassword: boolean;
    setShowPassword: (show: boolean) => void;
    errors: { email?: string; password?: string };
    isSubmitting: boolean;
    isLoading: boolean;
    mounted: boolean;
    portalMismatch: 'ADMIN_ON_CUSTOMER' | null;
    setPortalMismatch: (val: 'ADMIN_ON_CUSTOMER' | null) => void;
    onSubmit: (e: React.FormEvent) => void;
    onForgotPassword: (e: React.MouseEvent) => void;
    onSwitchToOtp: () => void;
    clearErrors: (field: 'email' | 'password') => void;
}

export function SignInForm({
    email, setEmail, password, setPassword,
    showPassword, setShowPassword,
    errors, isSubmitting, isLoading, mounted,
    portalMismatch, setPortalMismatch,
    onSubmit, onForgotPassword, onSwitchToOtp, clearErrors,
}: SignInFormProps) {
    const [showDemo, setShowDemo] = useState(false);

    const demoAccounts = [
        { label: 'Admin', email: 'admin@example.com', pass: 'SecurePass123!' },
        { label: 'Manager', email: 'manager@example.com', pass: 'SecurePass123!' },
        { label: 'Staff', email: 'staff@example.com', pass: 'SecurePass123!' },
        { label: 'Customer', email: 'john.doe@example.com', pass: 'SecurePass123!' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-black text-[#070B14] tracking-tight">Welcome back</h3>
                <p className="text-sm text-gray-400 mt-1.5">Sign in to your account to continue</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
                {/* Email */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            id="email-signin"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); clearErrors('email'); if (portalMismatch) setPortalMismatch(null); }}
                            placeholder="you@example.com"
                            className={`w-full h-12 pl-11 pr-4 rounded-2xl text-sm font-medium transition-all outline-none border ${
                                errors.email
                                    ? 'bg-red-50 border-red-200 text-red-800 placeholder:text-red-300'
                                    : 'bg-gray-50 border-gray-100 text-[#070B14] placeholder:text-gray-400 focus:bg-white focus:border-[#4D7DF2]/40 focus:ring-4 focus:ring-[#4D7DF2]/5'
                            }`}
                        />
                    </div>
                    {errors.email && (
                        <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errors.email}
                        </p>
                    )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-600 uppercase tracking-widest">Password</label>
                        <button type="button" onClick={onForgotPassword} className="text-xs text-[#4D7DF2] font-semibold hover:underline">
                            Forgot password?
                        </button>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); clearErrors('password'); if (portalMismatch) setPortalMismatch(null); }}
                            placeholder="Enter your password"
                            className={`w-full h-12 pl-11 pr-12 rounded-2xl text-sm font-medium transition-all outline-none border ${
                                errors.password || portalMismatch
                                    ? 'bg-red-50 border-red-200 text-red-800 placeholder:text-red-300'
                                    : 'bg-gray-50 border-gray-100 text-[#070B14] placeholder:text-gray-400 focus:bg-white focus:border-[#4D7DF2]/40 focus:ring-4 focus:ring-[#4D7DF2]/5'
                            }`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {(errors.password && !portalMismatch) && (
                        <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errors.password}
                        </p>
                    )}
                    {portalMismatch === 'ADMIN_ON_CUSTOMER' && (
                        <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Admin accounts must use the{' '}
                            <a href="/admin/login" className="underline text-[#4D7DF2]">Admin login</a>
                        </p>
                    )}
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isSubmitting || (mounted && isLoading)}
                    className="w-full h-13 py-3.5 rounded-2xl bg-[#070B14] text-white text-xs font-black uppercase tracking-widest transition-all hover:bg-[#1a2540] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                >
                    {isSubmitting ? (
                        <><LoadingSpinner size={14} className="text-white" />Signing in…</>
                    ) : 'Sign In'}
                </button>
            </form>

            {/* OTP link */}
            <div className="text-center">
                <button type="button" onClick={onSwitchToOtp} className="text-xs text-gray-400 hover:text-[#4D7DF2] transition-colors font-medium">
                    Sign in with a one-time code instead →
                </button>
            </div>

            {/* Demo accounts */}
            <div className="border-t border-gray-100 pt-4">
                <button
                    type="button"
                    onClick={() => setShowDemo(v => !v)}
                    className="flex items-center justify-between w-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <span>Demo Accounts</span>
                    {showDemo ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showDemo && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        {demoAccounts.map(({ label, email: e, pass }) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => { setEmail(e); setPassword(pass); clearErrors('email'); clearErrors('password'); }}
                                className="px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-xs font-bold text-gray-600 transition-colors text-left"
                            >
                                {label}
                                <span className="block text-[9px] text-gray-400 font-normal truncate mt-0.5">{e}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
