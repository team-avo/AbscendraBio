'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { getCountryCallingCode, parsePhoneNumber } from 'react-phone-number-input';

interface PhoneInputWithFlagProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

// US-only — product ships within the United States only
const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
];

export function PhoneInputWithFlag({ value, onChange, placeholder = "Enter phone number", className = "", id, required }: PhoneInputWithFlagProps) {
  // Determine current country from phone number
  const getCurrentCountry = () => {
    if (value) {
      try {
        const phoneNumber = parsePhoneNumber(value);
        return phoneNumber?.country || 'US';
      } catch {
        return 'US';
      }
    }
    return 'US';
  };

  const [selectedCountry, setSelectedCountry] = useState<any>(getCurrentCountry());

  // Get local number (without country code)
  const getLocalNumber = () => {
    if (value) {
      try {
        const phoneNumber = parsePhoneNumber(value);
        return phoneNumber?.nationalNumber || '';
      } catch {
        return value.replace(/^\+\d+/, '');
      }
    }
    return '';
  };

  const [localNumber, setLocalNumber] = useState(getLocalNumber());

  // Update internal state when value prop changes externally
  useEffect(() => {
    setSelectedCountry(getCurrentCountry());
    setLocalNumber(getLocalNumber());
  }, [value]);

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    const callingCode = getCountryCallingCode(countryCode as any);
    const newValue = localNumber ? `+${callingCode}${localNumber}` : `+${callingCode}`;
    onChange(newValue);
  };

  const handleNumberChange = (number: string) => {
    // Remove any non-digit characters and cap at 10 digits (US number length)
    const cleanNumber = number.replace(/\D/g, '').slice(0, 10);
    setLocalNumber(cleanNumber);

    const callingCode = getCountryCallingCode(selectedCountry as any);
    const newValue = cleanNumber ? `+${callingCode}${cleanNumber}` : '';
    onChange(newValue);
  };

  const selectedCountryData = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];
  const callingCode = getCountryCallingCode(selectedCountry as any);

  return (
    <div className={`flex border border-input rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className}`}>
      {/* US flag + dial code — static, no dropdown needed */}
      <div className="flex items-center gap-2 px-3 shrink-0 text-sm text-muted-foreground select-none">
        <span className="text-lg">{selectedCountryData.flag}</span>
        <span>+{callingCode}</span>
      </div>

      <div className="w-px bg-border" />

      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        maxLength={10}
        className="border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-l-none"
      />
    </div>
  );
}
