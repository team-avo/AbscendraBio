import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordValidationTooltipProps {
  password: string;
  show: boolean;
}

interface ValidationRule {
  label: string;
  isValid: (password: string) => boolean;
}

const validationRules: ValidationRule[] = [
  {
    label: '8 characters',
    isValid: (password) => password.length >= 8
  },
  {
    label: 'One uppercase letter',
    isValid: (password) => /[A-Z]/.test(password)
  },
  {
    label: 'One special character',
    isValid: (password) => /[@$!%*?&]/.test(password)
  }
];

export function PasswordValidationTooltip({ password, show }: PasswordValidationTooltipProps) {
  if (!show || !password) return null;

  const allValid = validationRules.every(rule => rule.isValid(password));

  return (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]">
      <div className="absolute -top-1 left-4 w-2 h-2 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
      
      <div className="space-y-2">
        {validationRules.map((rule, index) => {
          const isValid = rule.isValid(password);
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                isValid ? 'bg-green-500' : 'bg-gray-200'
              }`}>
                {isValid ? (
                  <Check className="w-3 h-3 text-white" />
                ) : (
                  <X className="w-3 h-3 text-gray-400" />
                )}
              </div>
              <span className={isValid ? 'text-green-700' : 'text-gray-600'}>
                {rule.label}
              </span>
            </div>
          );
        })}
      </div>
      
      {allValid && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Check className="w-4 h-4" />
            <span className="font-medium">Password is valid!</span>
          </div>
        </div>
      )}
    </div>
  );
}
