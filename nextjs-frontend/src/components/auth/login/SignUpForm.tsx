'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
    smsTransactionalConsent: boolean;
    setSmsTransactionalConsent: (val: boolean) => void;
    smsMarketingConsent: boolean;
    setSmsMarketingConsent: (val: boolean) => void;
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
    smsTransactionalConsent,
    setSmsTransactionalConsent,
    smsMarketingConsent,
    setSmsMarketingConsent,
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
                    placeholder="you@example.com"
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
                        onChange={(e) => setLicenseNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        inputMode="numeric"
                        maxLength={10}
                        pattern="\d{10}"
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
                        placeholder="555 000 1111"
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
                        onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                        placeholder="5-digit ZIP"
                        inputMode="numeric"
                        maxLength={5}
                        pattern="\d{5}"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700 ml-1 block" htmlFor="password-signup">Password <span className="text-red-500">*</span></Label>
                <p className="text-xs text-gray-500 ml-1 mb-2 block">Minimum 8 characters</p>
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

            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
                <p className="text-sm font-semibold text-gray-700">Text message updates (optional)</p>
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="sms-transactional"
                        checked={smsTransactionalConsent}
                        onCheckedChange={(v) => setSmsTransactionalConsent(v === true)}
                        className="mt-0.5"
                    />
                    <Label htmlFor="sms-transactional" className="text-xs font-normal leading-snug text-gray-600 cursor-pointer">
                        I agree to receive account and order text messages (such as order confirmations, payment reminders and shipping updates) from Ascendra Bio at the mobile number provided. Message frequency varies. Message and data rates may apply.
                    </Label>
                </div>
                <div className="flex items-start gap-3">
                    <Checkbox
                        id="sms-marketing"
                        checked={smsMarketingConsent}
                        onCheckedChange={(v) => setSmsMarketingConsent(v === true)}
                        className="mt-0.5"
                    />
                    <Label htmlFor="sms-marketing" className="text-xs font-normal leading-snug text-gray-600 cursor-pointer">
                        I agree to receive marketing and promotional text messages from Ascendra Bio at the mobile number provided. Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply.
                    </Label>
                </div>
                <p className="text-[11px] leading-snug text-gray-500">
                    Reply HELP for help and STOP to unsubscribe at any time. See our{' '}
                    <a href="/landing/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Privacy Policy</a>{' '}and{' '}
                    <a href="/landing/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">Terms of Service</a>. We do not share your number with third parties except SMS providers.
                </p>
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
                    Already registered? Sign in instead
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
