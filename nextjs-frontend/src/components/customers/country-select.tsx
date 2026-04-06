import { forwardRef } from 'react';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCountryCallingCode } from 'react-phone-number-input/input';

interface Option {
  value?: string;
  label: string;
  divider?: boolean;
  icon: React.ComponentType<{ country: string }>;
}

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
}

// Simple flag emoji component
const FlagIcon = ({ country }: { country: string }) => {
  const getFlagEmoji = (countryCode: string) => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  return (
    <span style={{ fontSize: '1.2em', marginRight: '8px' }}>
      {getFlagEmoji(country)}
    </span>
  );
};

export const CountrySelect = forwardRef<HTMLButtonElement, CountrySelectProps>(({ value, onChange, options }, ref) => {
  const selectedOption = options.find(option => option.value === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto bg-transparent border-none shadow-none focus:ring-0 focus:shadow-none focus:ring-offset-0 p-1 h-auto min-w-[60px]" ref={ref}>
        <SelectValue asChild>
          <div className="flex items-center">
            {selectedOption?.value && <FlagIcon country={selectedOption.value} />}
            {selectedOption?.value && (
              <span className="text-sm text-muted-foreground">
                +{getCountryCallingCode(selectedOption.value as any)}
              </span>
            )}
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-60">
        {options
          .filter(option => option.value || option.divider)
          .map((option, index) => {
            if (option.divider) {
              return <SelectSeparator key={`divider-${index}`} />;
            }
            return (
              <SelectItem key={option.value} value={option.value!}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center">
                    <FlagIcon country={option.value!} />
                    <span>{option.label}</span>
                  </div>
                  <span className="text-muted-foreground ml-4">
                    +{getCountryCallingCode(option.value! as any)}
                  </span>
                </div>
              </SelectItem>
            );
          })}
      </SelectContent>
    </Select>
  );
});

CountrySelect.displayName = 'CountrySelect';
