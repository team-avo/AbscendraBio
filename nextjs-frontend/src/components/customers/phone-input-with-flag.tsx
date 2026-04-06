'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCountryCallingCode, parsePhoneNumber, isValidPhoneNumber } from 'react-phone-number-input';

interface PhoneInputWithFlagProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

// Common countries with their codes and flag emojis
const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪' },
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
    // Remove any non-digit characters
    const cleanNumber = number.replace(/\D/g, '');
    setLocalNumber(cleanNumber);

    const callingCode = getCountryCallingCode(selectedCountry as any);
    const newValue = cleanNumber ? `+${callingCode}${cleanNumber}` : '';
    onChange(newValue);
  };

  const selectedCountryData = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];
  const callingCode = getCountryCallingCode(selectedCountry as any);

  return (
    <div className={`flex border border-input rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${className}`}>
      <Select value={selectedCountry} onValueChange={handleCountryChange}>
        <SelectTrigger className="w-auto border-none bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 px-3">
          <SelectValue asChild>
            <div className="flex items-center gap-2">
              <span className="text-lg">{selectedCountryData.flag}</span>
              <span className="text-sm text-muted-foreground">+{callingCode}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {COUNTRIES.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{country.flag}</span>
                  <span>{country.name}</span>
                </div>
                <span className="text-muted-foreground ml-4">
                  +{getCountryCallingCode(country.code as any)}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px bg-border" />

      <Input
        id={id}
        type="tel"
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-l-none"
      />
    </div>
  );
}
