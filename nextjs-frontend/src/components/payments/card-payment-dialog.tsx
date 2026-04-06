'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Lock, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';

interface CardPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (transactionId: string) => void;
  amount: number;
  billingAddress?: any;
  shippingAddress?: any;
  orderId?: string;
  shippingAmount?: number;
  paymentFeePct?: number;
  discountAmount?: number;
  subtotal?: number;
  taxAmount?: number;
}

export function CardPaymentDialog({
  open,
  onClose,
  onSuccess,
  amount,
  billingAddress,
  shippingAddress,
  orderId,
  shippingAmount,
  paymentFeePct,
  discountAmount = 0,
  subtotal = 0,
  taxAmount = 0
}: CardPaymentDialogProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gatewayResponse, setGatewayResponse] = useState<any | null>(null);
  const [cardholderName, setCardholderName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const COOLDOWN_MS = 5 * 60 * 1000;
  const COOLDOWN_STORAGE_KEY = 'authorize_net_card_retry_cooldown_until';
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(0);
  const [currentYear, setCurrentYear] = useState(2026);
  const years = Array.from({ length: 20 }, (_, i) => currentYear + i);

  // Set time-dependent values after mount to avoid hydration mismatch
  useEffect(() => {
    setNowTs(Date.now());
    setCurrentYear(new Date().getFullYear());
  }, []);
  const months = [
    '01', '02', '03', '04', '05', '06',
    '07', '08', '09', '10', '11', '12'
  ];

  useEffect(() => {
    if (!open) return;

    setGatewayResponse(null);

    try {
      const saved = window.localStorage.getItem(COOLDOWN_STORAGE_KEY);
      const parsed = saved ? Number(saved) : NaN;
      if (!Number.isNaN(parsed) && parsed > Date.now()) {
        setCooldownUntil(parsed);
      } else if (!Number.isNaN(parsed)) {
        window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
        setCooldownUntil(null);
      }
    } catch {
      // ignore storage errors
    }
  }, [open]);

  const gatewaySummary = useMemo(() => {
    if (!gatewayResponse) return null;
    try {
      const parsed = typeof gatewayResponse === 'string' ? JSON.parse(gatewayResponse) : gatewayResponse;

      // Some API responses may already be a summary object at the root
      if (parsed && (parsed.responseCode || parsed.avsResultCode || parsed.cvvResultCode || parsed.cavvResultCode)) {
        return {
          responseCode: parsed.responseCode ?? '',
          avsResultCode: parsed.avsResultCode ?? '',
          cvvResultCode: parsed.cvvResultCode ?? '',
          cavvResultCode: parsed.cavvResultCode ?? '',
        };
      }

      const summary = parsed?.gatewayResponse || parsed?.gateway_summary || null;
      if (summary && (summary.responseCode || summary.avsResultCode || summary.cvvResultCode || summary.cavvResultCode)) {
        return {
          responseCode: summary.responseCode ?? '',
          avsResultCode: summary.avsResultCode ?? '',
          cvvResultCode: summary.cvvResultCode ?? '',
          cavvResultCode: summary.cavvResultCode ?? '',
        };
      }

      const tx = parsed?.transactionResponse || parsed?.gateway?.transactionResponse || parsed?.gateway?.gateway?.transactionResponse || null;
      if (!tx) return null;
      return {
        responseCode: tx.responseCode ?? '',
        avsResultCode: tx.avsResultCode ?? '',
        cvvResultCode: tx.cvvResultCode ?? '',
        cavvResultCode: tx.cavvResultCode ?? '',
      };
    } catch {
      return null;
    }
  }, [gatewayResponse]);

  const responseCodeMeaning: Record<string, string> = {
    '1': 'Approved',
    '2': 'Declined',
    '3': 'Error',
    '4': 'Held for Review',
  };

  const avsMeaning: Record<string, string> = {
    A: 'The street address matched, but the postal code did not.',
    B: 'No address information was provided.',
    E: 'The AVS check returned an error.',
    G: 'The card was issued by a bank outside the U.S. and does not support AVS.',
    N: 'Neither the street address nor postal code matched.',
    P: 'AVS is not applicable for this transaction.',
    R: 'Retry — AVS was unavailable or timed out.',
    S: 'AVS is not supported by card issuer.',
    U: 'Address information is unavailable.',
    W: 'The US ZIP+4 code matches, but the street address does not.',
    X: 'Both the street address and the US ZIP+4 code matched.',
    Y: 'The street address and postal code matched.',
    Z: 'The postal code matched, but the street address did not.',
  };

  const cvvMeaning: Record<string, string> = {
    M: 'CVV matched.',
    N: 'CVV did not match.',
    P: 'CVV was not processed.',
    S: 'CVV should have been present but was not indicated.',
    U: 'The issuer was unable to process the CVV check.',
  };

  const cavvMeaning: Record<string, string> = {
    '': 'CAVV not validated.',
    '0': 'CAVV was not validated because erroneous data was submitted.',
    '1': 'CAVV failed validation.',
    '2': 'CAVV passed validation.',
    '3': 'CAVV validation could not be performed; issuer attempt incomplete.',
    '4': 'CAVV validation could not be performed; issuer system error.',
    '5': 'Reserved for future use.',
    '6': 'Reserved for future use.',
    '7': 'CAVV failed validation, but the issuer is available.',
    '8': 'CAVV passed validation and the issuer is available.',
    '9': 'CAVV failed validation and the issuer is unavailable.',
    A: 'CAVV passed validation but the issuer unavailable.',
    B: 'CAVV passed validation, information only, no liability shift.',
  };

  const renderGatewayRow = (
    label: string,
    code: string,
    meaningMap?: Record<string, string>
  ) => {
    const key = (code ?? '').toString();
    const meaning = meaningMap ? meaningMap[key] ?? (key === '' ? meaningMap[''] : undefined) : undefined;
    const display = meaning || (key === '' ? 'Not available' : 'Unknown');
    return (
      <div className="inline-block text-xs bg-white/70 rounded px-2 py-1 break-words text-red-900">
        {display}
      </div>
    );
  };

  useEffect(() => {
    if (!open) return;
    if (!cooldownUntil) return;
    if (cooldownUntil <= Date.now()) return;

    setNowTs(Date.now());
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [open, cooldownUntil]);

  const remainingMs = cooldownUntil ? Math.max(0, cooldownUntil - nowTs) : 0;
  const cooldownActive = Boolean(cooldownUntil && remainingMs > 0);

  const formatRemaining = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19);
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  };

  const validateForm = () => {
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 13) {
      setError('Please enter a valid card number');
      return false;
    }
    if (!expiryMonth || !expiryYear) {
      setError('Please select card expiration date');
      return false;
    }
    if (!cvv || cvv.length < 3) {
      setError('Please enter card security code (CVV)');
      return false;
    }
    if (!cardholderName) {
      setError('Please enter cardholder name');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (submitted || loading) {
      return; // Prevent double submission
    }

    if (cooldownActive) {
      return;
    }

    setError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitted(true);
    setLoading(true);

    try {
      // Call backend to process payment with Authorize.Net using API client
      const response = await api.authorizeCard({
        amount: amount.toFixed(2),
        cardNumber: cardNumber.replace(/\s/g, ''),
        expirationDate: `${expiryYear}-${expiryMonth}`,
        cardCode: cvv,
        cardholderName,
        orderId,
        billingAddress,
        shippingAddress,
        shippingAmount: shippingAmount !== undefined ? shippingAmount.toFixed(2) : undefined,
        paymentFeePct,
        discountAmount: discountAmount !== undefined ? discountAmount.toFixed(2) : undefined,
        subtotal: subtotal !== undefined ? subtotal.toFixed(2) : undefined,
        taxAmount: taxAmount !== undefined ? taxAmount.toFixed(2) : undefined,
      });

      if (!response.success) {
        const failureData: any = response.data;
        setGatewayResponse(failureData?.gateway ?? failureData ?? null);
        setError(response.error || 'Payment processing failed');
        const until = Date.now() + COOLDOWN_MS;
        setCooldownUntil(until);
        try {
          window.localStorage.setItem(COOLDOWN_STORAGE_KEY, String(until));
        } catch {
          // ignore storage errors
        }
        setSubmitted(false);
        return;
      }

      setGatewayResponse(response.data?.gateway ?? null);

      try {
        window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
      setCooldownUntil(null);

      // Success
      onSuccess(response.data?.transactionId || '');
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
      const until = Date.now() + COOLDOWN_MS;
      setCooldownUntil(until);
      try {
        window.localStorage.setItem(COOLDOWN_STORAGE_KEY, String(until));
      } catch {
        // ignore storage errors
      }
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setCardNumber('');
      setExpiryMonth('');
      setExpiryYear('');
      setCvv('');
      setCardholderName('');
      setError(null);
      setGatewayResponse(null);
      setSubmitted(false);
      setCooldownUntil(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-4 text-center">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-2xl font-bold text-blue-600">
              <Shield className="h-6 w-6" />
              Authorize.net
            </div>
            <div className="w-16 h-1 bg-blue-600 mx-auto rounded-full"></div>
          </div>
          <DialogTitle className="text-xl font-semibold text-gray-800">
            Enter Payment Details
          </DialogTitle>
          <DialogDescription className="text-lg">
            Securely complete your payment of <span className="font-bold text-green-600">${amount.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex flex-col gap-1">
                  <p>{error}</p>
                  {cooldownActive && (
                    <p>
                      Please wait <strong>{formatRemaining(remainingMs)}</strong> before retrying to avoid a duplicate transaction.
                    </p>
                  )}
                  {gatewaySummary && (
                    <div className="mt-3 rounded-md border border-red-200 bg-red-50/60 p-3 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Authorize.Net Response
                      </div>
                      <div className="flex flex-col gap-2">
                        {renderGatewayRow('Response Code', gatewaySummary.responseCode, responseCodeMeaning)}
                        {renderGatewayRow('AVS Result Code', gatewaySummary.avsResultCode, avsMeaning)}
                        {renderGatewayRow('CVV Result Code', gatewaySummary.cvvResultCode, cvvMeaning)}
                        {renderGatewayRow('CAVV Result Code', gatewaySummary.cavvResultCode, cavvMeaning)}
                      </div>
                    </div>
                  )}
                  {error === 'Cart is empty' && (
                    <button
                      onClick={() => window.location.href = '/landing/products'}
                      className="font-bold underline cursor-pointer hover:opacity-80 transition-opacity text-left text-xs"
                    >
                      Looks like there were changes to your cart, click here to build your cart again
                    </button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber" className="text-sm font-medium text-gray-700">Card Number</Label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="cardNumber"
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={handleCardNumberChange}
                maxLength={19}
                disabled={loading}
                className="pl-10 h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cardholder Name */}
          <div className="space-y-2">
            <Label htmlFor="cardholderName" className="text-sm font-medium text-gray-700">Cardholder Name</Label>
            <Input
              id="cardholderName"
              type="text"
              placeholder="John Doe"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              disabled={loading}
              className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Expiry and CVV */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expiryMonth" className="text-sm font-medium text-gray-700">Expiration Date</Label>
              <div className="flex gap-2">
                <Select value={expiryMonth} onValueChange={setExpiryMonth} disabled={loading}>
                  <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={expiryYear} onValueChange={setExpiryYear} disabled={loading}>
                  <SelectTrigger className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="YYYY" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvv" className="text-sm font-medium text-gray-700">CVV</Label>
              <div className="relative">
                <Input
                  id="cvv"
                  type="password"
                  placeholder="•••"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  disabled={loading}
                  className="h-12 text-base border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  ••••
                </div>
              </div>
            </div>
          </div>

          {/* Security Info */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 bg-blue-50 p-4 rounded-lg border border-blue-200">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="font-medium">Your payment information is encrypted and secure</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className="w-full sm:w-auto h-12 text-base font-medium border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || submitted || cooldownActive}
            className="w-full sm:w-auto h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing Payment...
              </>
            ) : cooldownActive ? (
              <>
                <Lock className="mr-2 h-5 w-5" />
                Retry in {formatRemaining(remainingMs)}
              </>
            ) : (
              <>
                <Lock className="mr-2 h-5 w-5" />
                Pay ${amount.toFixed(2)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

