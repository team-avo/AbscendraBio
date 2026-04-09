'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
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
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    errors,
    isSubmitting,
    isLoading,
    mounted,
    portalMismatch,
    setPortalMismatch,
    onSubmit,
    onForgotPassword,
    onSwitchToOtp,
    clearErrors,
}: SignInFormProps) {
    return (
        <div>
            <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="email-signin">Email address <span className="text-red-500">*</span></Label>
                    <Input
                        id="email-signin"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            clearErrors('email');
                            if (portalMismatch) setPortalMismatch(null);
                        }}
                        className={errors.email ? 'border-red-500' : ''}
                        placeholder="admin@example.com"
                    />
                    {errors.email && (<p className="mt-1 text-sm text-red-600">{errors.email}</p>)}
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="password">Password <span className="text-red-500">*</span></Label>
                    <div className="relative">
                        <Input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                clearErrors('password');
                                if (portalMismatch) setPortalMismatch(null);
                            }}
                            className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                            placeholder="Enter your password"
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? (<EyeOff className="h-4 w-4 text-gray-400" />) : (<Eye className="h-4 w-4 text-gray-400" />)}
                        </button>
                    </div>
                    {errors.password && !portalMismatch && (
                        <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                    )}
                    {portalMismatch === 'ADMIN_ON_CUSTOMER' && (
                        <p className="mt-1 text-sm text-red-600">
                            Oops! Admins can’t login to customer panel, please <a href="/admin/login" className="underline text-blue-600">click here</a> to login via Admin login.
                        </p>
                    )}
                </div>
                <div className="flex items-center justify-between">
                    <div className="text-sm">
                        <a
                            href="#"
                            className="font-medium text-blue-600 hover:text-blue-500"
                            onClick={onForgotPassword}
                        >Forgot your password?</a>
                    </div>
                </div>
                <Button type="submit" className="w-full h-11" disabled={isSubmitting || (mounted && isLoading)}>
                    {isSubmitting ? (<><LoadingSpinner size={16} className="mr-2" />Signing in...</>) : ('Sign in')}
                </Button>
            </form>

            <div className="mt-8 border-t border-gray-100 pt-6">
                <p className="text-xs text-center text-gray-500 mb-4 font-medium uppercase tracking-wider">Demo Credentials</p>
                <div className="grid grid-cols-2 gap-2">
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-9 rounded-full bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        onClick={() => { setEmail('admin@example.com'); setPassword('SecurePass123!'); clearErrors('email'); clearErrors('password'); }}
                    >
                        Admin (Dashboard)
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-9 rounded-full bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        onClick={() => { setEmail('manager@example.com'); setPassword('SecurePass123!'); clearErrors('email'); clearErrors('password'); }}
                    >
                        Manager (Dashboard)
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-9 rounded-full bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        onClick={() => { setEmail('staff@example.com'); setPassword('SecurePass123!'); clearErrors('email'); clearErrors('password'); }}
                    >
                        Staff (Dashboard)
                    </Button>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        className="text-xs h-9 rounded-full bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        onClick={() => { setEmail('john.doe@example.com'); setPassword('SecurePass123!'); clearErrors('email'); clearErrors('password'); }}
                    >
                        Customer (Store)
                    </Button>
                </div>
            </div>

            <div className="mt-6 text-center">
                <button
                    type="button"
                    onClick={onSwitchToOtp}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                >
                    Login using email one-time verification code
                </button>
            </div>
        </div>
    );
}
