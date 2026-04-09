'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import dynamic from 'next/dynamic';

// Dynamic imports for heavy components
const PhoneInputWithFlag = dynamic(
    () => import('@/components/customers/phone-input-with-flag').then(mod => mod.PhoneInputWithFlag),
    {
        loading: () => <Input placeholder="Loading..." disabled className="bg-gray-50" />,
        ssr: false
    }
);

const CitySelector = dynamic(
    () => import('@/components/customers/city-selector').then(mod => mod.CitySelector),
    {
        loading: () => <Input placeholder="Loading..." disabled className="bg-gray-50" />,
        ssr: false
    }
);

interface SignUpFormProps {
    email: string;
    setEmail: (val: string) => void;
    password: string;
    setPassword: (val: string) => void;
    firstName: string;
    setFirstName: (val: string) => void;
    lastName: string;
    setLastName: (val: string) => void;
    mobile: string;
    setMobile: (val: string) => void;
    companyName: string;
    setCompanyName: (val: string) => void;
    licenseNumber: string;
    setLicenseNumber: (val: string) => void;
    city: string;
    setCity: (val: string) => void;
    zip: string;
    setZip: (val: string) => void;
    showPassword: boolean;
    setShowPassword: (val: boolean) => void;
    setShowPasswordValidation: (val: boolean) => void;
    errors: {
        email?: string;
        password?: string;
        firstName?: string;
        lastName?: string;
        mobile?: string;
        licenseNumber?: string;
    };
    isSubmitting: boolean;
    isLoading: boolean;
    mounted: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onSwitchToOtp: () => void;
}

export function SignUpForm({
    email,
    setEmail,
    password,
    setPassword,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    mobile,
    setMobile,
    companyName,
    setCompanyName,
    licenseNumber,
    setLicenseNumber,
    city,
    setCity,
    zip,
    setZip,
    showPassword,
    setShowPassword,
    setShowPasswordValidation,
    errors,
    isSubmitting,
    isLoading,
    mounted,
    onSubmit,
    onSwitchToOtp,
}: SignUpFormProps) {
    return (
        <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="email">Email address <span className="text-red-500">*</span></Label>
                <Input
                    id="email-signup"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                    placeholder="admin@example.com"
                />
                {errors.email && (<p className="mt-1 text-sm text-red-600">{errors.email}</p>)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="firstName">First name <span className="text-red-500">*</span></Label>
                    <Input
                        required
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className={errors.firstName ? 'border-red-500' : ''}
                    />
                    {errors.firstName && (<p className="mt-1 text-sm text-red-600">{errors.firstName}</p>)}
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="lastName">Last name <span className="text-red-500">*</span></Label>
                    <Input
                        required
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className={errors.lastName ? 'border-red-500' : ''}
                    />
                    {errors.lastName && (<p className="mt-1 text-sm text-red-600">{errors.lastName}</p>)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="companyName">Company</Label>
                    <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g., RefinedMD"
                    />
                </div>
                <div className="space-y-2 flex-1">
                    <Label htmlFor="licenseNumber" className="text-sm font-semibold text-gray-700 ml-1 block">NPI / License Number <span className="text-red-500">*</span></Label>
                    <Input
                        id="licenseNumber"
                        placeholder="e.g., 1234567890"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        className={`bg-gray-50 border-gray-200 focus:bg-white transition-all ${errors.licenseNumber ? 'border-red-500' : ''}`}
                    />
                    {errors.licenseNumber && (<p className="text-xs text-red-600 font-medium">{errors.licenseNumber}</p>)}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="mobile" className="text-sm font-semibold text-gray-700 ml-1 block">Mobile Number <span className="text-red-500">*</span></Label>
                <div className="relative group">
                    <PhoneInputWithFlag
                        id="mobile"
                        placeholder="e.g., +1 555 000 1111"
                        value={mobile}
                        onChange={(v) => setMobile(v)}
                        className={`transition-all ${errors.mobile ? 'border-red-500' : ''}`}
                    />
                </div>
                {errors.mobile && (<p className="text-xs text-red-600 font-medium">{errors.mobile}</p>)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="city">City</Label>
                    <CitySelector
                        id="city"
                        value={city}
                        onChange={setCity}
                        placeholder="Select city"
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="zip">ZIP Code</Label>
                    <Input
                        id="zip"
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                        placeholder="Enter ZIP code"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="password-signup">Password <span className="text-red-500">*</span></Label>
                <p className="text-xs text-gray-500 ml-1 mb-2 block">Minimum 4 characters, no spaces</p>
                <div className="relative">
                    <Input
                        id="password-signup"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            setShowPasswordValidation(e.target.value.length > 0);
                        }}
                        onFocus={() => setShowPasswordValidation(password.length > 0)}
                        onBlur={() => setShowPasswordValidation(false)}
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
                {errors.password && (<p className="mt-1 text-sm text-red-600">{errors.password}</p>)}
            </div>

            <Button type="submit" className="w-full h-11" disabled={isSubmitting || (mounted && isLoading)}>
                {isSubmitting ? (<><LoadingSpinner size={16} className="mr-2" />Creating account...</>) : ('Sign up')}
            </Button>

            <div className="mt-6 text-center">
                <button
                    type="button"
                    onClick={onSwitchToOtp}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                >
                    Already have an account? Login with email code
                </button>
            </div>

            <div className="mt-4">
                <Alert>
                    <AlertDescription className="text-sm">
                        <strong>Customer Account Approval:</strong><br />
                        After signing up, your account will be reviewed by our team.
                        You will receive an email notification once your account is approved.
                        Please wait for approval before attempting to log in.
                    </AlertDescription>
                </Alert>
            </div>
        </form>
    );
}
