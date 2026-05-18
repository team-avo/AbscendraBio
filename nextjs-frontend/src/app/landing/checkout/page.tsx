"use client";

import { useAuth } from "@/contexts/auth-context";
import { useCart } from "@/contexts/cart-context";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { api, type Address, getCustomCountries, getCustomStates, getCustomCities, createCustomLocation } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Minus, Plus, X, Search, MapPin, Pencil, CheckCircle2, ShieldCheck, FileSearch } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Promotion } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { calculateHighValueDiscount } from "@/utils/discount";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PhoneInputWithFlag } from "@/components/customers/phone-input-with-flag";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import logger from '@/lib/logger';
import { GooglePlacesAutocomplete, type ParsedAddress } from '@/components/ui/google-places-autocomplete';

const DEFAULT_COUNTRY_CODE = "United States";

type AddressFormState = {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

const createEmptyAddressForm = (): AddressFormState => ({
  firstName: "",
  lastName: "",
  company: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: DEFAULT_COUNTRY_CODE,
  phone: "",
});

const ADDRESS_COMPARE_FIELDS: Array<keyof AddressFormState> = [
  "firstName",
  "lastName",
  "company",
  "address1",
  "address2",
  "city",
  "state",
  "postalCode",
  "country",
  "phone",
];

const sanitizePhone = (value: string) =>
  value.replace(/\D/g, "").slice(0, 10);

export default function CheckoutPage() {
  const { isAuthenticated, hasRole, user, isLoading: authLoading } = useAuth();
  const { items, subtotal, discount, total, loading: cartLoading, refresh, update, remove } = useCart();

  // Safe wrapper for cart operations
  const safeUpdate = async (variantId: string, quantity: number) => {
    try {
      await update(variantId, quantity);
    } catch (error: any) {
      logger.error('Cart update error:', { error: error });
      toast.error(error.message || 'Failed to update quantity');
      throw error;
    }
  };

  const safeRemove = async (variantId: string) => {
    try {
      await remove(variantId);
    } catch (error: any) {
      logger.error('Cart remove error:', { error: error });
      toast.error(error.message || 'Failed to remove item');
      throw error;
    }
  };
  const router = useRouter();
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [billingId, setBillingId] = useState<string>("new");
  const [shippingId, setShippingId] = useState<string>("new");

  // Hydrate from sessionStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const storedBilling = sessionStorage.getItem('checkout_billingId');
    const storedShipping = sessionStorage.getItem('checkout_shippingId');
    if (storedBilling) setBillingId(storedBilling);
    if (storedShipping) setShippingId(storedShipping);
  }, []);
  const [shippingRate, setShippingRate] = useState<{ finalRate: number; reason?: string } | null>(null);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [productTaxAmount, setProductTaxAmount] = useState<number>(0);
  const [countryTaxAmount, setCountryTaxAmount] = useState<number>(0);
  const [shippingComputed, setShippingComputed] = useState(false);
  const [taxComputed, setTaxComputed] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [couponCode, setCouponCode] = useState<string>("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [couponLoading, setCouponLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [addrSuccess, setAddrSuccess] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(true);

  // Hydrate sameAsBilling from sessionStorage after mount
  useEffect(() => {
    const stored = sessionStorage.getItem('checkout_sameAsBilling');
    if (stored !== null) setSameAsBilling(stored === 'true');
  }, []);
  const [hasBilling, setHasBilling] = useState(false);
  const [hasShipping, setHasShipping] = useState(false);
  const [isB2B, setIsB2B] = useState(false);
  const [billingForm, setBillingForm] = useState<AddressFormState>(() => createEmptyAddressForm());
  const [shippingForm, setShippingForm] = useState<AddressFormState>(() => createEmptyAddressForm());

  type AddressTouched = Partial<Record<keyof AddressFormState, boolean>>;
  const [billingTouched, setBillingTouched] = useState<AddressTouched>({});
  const [shippingTouched, setShippingTouched] = useState<AddressTouched>({});
  const touchBilling = useCallback((key: keyof AddressFormState) => setBillingTouched(p => ({ ...p, [key]: true })), []);
  const touchShipping = useCallback((key: keyof AddressFormState) => setShippingTouched(p => ({ ...p, [key]: true })), []);

  const [billingCountryCode, setBillingCountryCode] = useState('United States');
  const [billingStateCode, setBillingStateCode] = useState('');
  const [shippingCountryCode, setShippingCountryCode] = useState('United States');
  const [shippingStateCode, setShippingStateCode] = useState('');

  // Custom location states (from database)
  const [customCountries, setCustomCountries] = useState<string[]>([]);
  const [customBillingStates, setCustomBillingStates] = useState<string[]>([]);
  const [customBillingCities, setCustomBillingCities] = useState<string[]>([]);
  const [customShippingStates, setCustomShippingStates] = useState<string[]>([]);
  const [customShippingCities, setCustomShippingCities] = useState<string[]>([]);

  // Add new location dialog states
  const [addLocationDialog, setAddLocationDialog] = useState<{
    open: boolean;
    type: 'state' | 'city' | null;
    addressType: 'billing' | 'shipping' | null;
    country: string;
    state?: string;
  }>({
    open: false,
    type: null,
    addressType: null,
    country: '',
    state: ''
  });
  const [newLocationName, setNewLocationName] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  const canCheckout =
    isAuthenticated && user?.role === "CUSTOMER" && user.customerId && items.length > 0;

  const formatAddressLabel = (address: Address) => {
    const name = [address.firstName, address.lastName].filter(Boolean).join(" ") || "Unnamed";
    // Truncate long company names on mobile
    const rawCompany = (address as any).company || "";
    const company = rawCompany ? ` (${rawCompany.length > 20 ? rawCompany.slice(0, 18) + "…" : rawCompany})` : "";
    // Show city + state abbreviation (not full street) to keep the label short
    const summaryParts = [address.city, address.state].filter(Boolean);
    const summary = summaryParts.length ? summaryParts.join(", ") : (address.address1 || "");
    const defaultTag = address.isDefault ? " ★" : "";
    const typeLabel = address.type === "BILLING" ? "Bill" : "Ship";
    return summary
      ? `${typeLabel} • ${name}${company} — ${summary}${defaultTag}`
      : `${typeLabel} • ${name}${company}${defaultTag}`;
  };

  const resolveCountryIso = useCallback((value: string) => {
    if (!value) return "United States";
    // Check if it's an ISO code (e.g., "US")
    const byIso = Country.getAllCountries().find(
      c => c.isoCode.toLowerCase() === value.toLowerCase()
    );
    if (byIso) return byIso.name;

    // Check if it's a Name (e.g., "United States")
    const byName = Country.getAllCountries().find(
      c => c.name.toLowerCase() === value.toLowerCase()
    );
    if (byName) return byName.name;

    return value;
  }, []);

  const resolveStateIso = useCallback((countryName: string, value: string) => {
    if (!countryName || !value) return "";

    // We need Country ISO to lookup states in the library
    const country = Country.getAllCountries().find(
      c => c.name.toLowerCase() === countryName.toLowerCase() ||
        c.isoCode.toLowerCase() === countryName.toLowerCase()
    );

    if (country) {
      const states = State.getStatesOfCountry(country.isoCode);

      // Check if value is State ISO Code
      const byIso = states.find(s => s.isoCode.toLowerCase() === value.toLowerCase());
      if (byIso) return byIso.name;

      // Check if value is State Name
      const byName = states.find(s => s.name.toLowerCase() === value.toLowerCase());
      if (byName) return byName.name;
    }

    return value;
  }, []);

  const applyBillingAddress = useCallback(
    (address: Address | null) => {
      if (address) {
        setBillingForm({
          firstName: address.firstName || "",
          lastName: address.lastName || "",
          company: (address as any).company || "",
          address1: address.address1 || "",
          address2: address.address2 || "",
          city: address.city || "",
          state: address.state || "",
          postalCode: address.postalCode || "",
          country: address.country || DEFAULT_COUNTRY_CODE,
          phone: sanitizePhone(address.phone || ""),
        });
        const countryIso = resolveCountryIso(address.country);
        setBillingCountryCode(countryIso);
        const stateIso = resolveStateIso(countryIso, address.state);
        setBillingStateCode(stateIso);
      } else {
        const empty = createEmptyAddressForm();
        setBillingForm(empty);
        setBillingCountryCode(DEFAULT_COUNTRY_CODE);
        setBillingStateCode("");
      }
    },
    [resolveCountryIso, resolveStateIso]
  );

  const applyShippingAddress = useCallback(
    (address: Address | null) => {
      if (address) {
        setShippingForm({
          firstName: address.firstName || "",
          lastName: address.lastName || "",
          company: (address as any).company || "",
          address1: address.address1 || "",
          address2: address.address2 || "",
          city: address.city || "",
          state: address.state || "",
          postalCode: address.postalCode || "",
          country: address.country || DEFAULT_COUNTRY_CODE,
          phone: sanitizePhone(address.phone || ""),
        });
        const countryIso = resolveCountryIso(address.country);
        setShippingCountryCode(countryIso);
        const stateIso = resolveStateIso(countryIso, address.state);
        setShippingStateCode(stateIso);
      } else {
        const empty = createEmptyAddressForm();
        setShippingForm(empty);
        setShippingCountryCode(DEFAULT_COUNTRY_CODE);
        setShippingStateCode("");
      }
    },
    [resolveCountryIso, resolveStateIso]
  );

  const markAddressDirty = useCallback(() => {
    setAddrSuccess(false);
    setAddrError(null);
  }, []);

  const updateBillingField = useCallback(
    (key: keyof AddressFormState, value: string) => {
      markAddressDirty();
      setBillingForm((prev) => ({ ...prev, [key]: value }));
    },
    [markAddressDirty]
  );

  const updateShippingField = useCallback(
    (key: keyof AddressFormState, value: string) => {
      markAddressDirty();
      setShippingForm((prev) => ({ ...prev, [key]: value }));
    },
    [markAddressDirty]
  );

  const hasAddressChanged = useCallback(
    (address: Address | null, form: AddressFormState) => {
      if (!address) return true;
      return ADDRESS_COMPARE_FIELDS.some((field) => {
        if (field === "phone") {
          return sanitizePhone(address.phone || "") !== sanitizePhone(form.phone || "");
        }
        const current = String(address[field as keyof Address] ?? "").trim();
        const next = String(form[field] ?? "").trim();
        return current !== next;
      });
    },
    []
  );

  const handleBillingSelect = useCallback(
    (value: string) => {
      markAddressDirty();
      if (value === "new") {
        setBillingId("new");
        if (typeof window !== 'undefined') sessionStorage.setItem('checkout_billingId', 'new');
        applyBillingAddress(null);
        if (sameAsBilling) {
          setShippingId("new");
          if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', 'new');
          applyShippingAddress(null);
        }
        return;
      }
      setBillingId(value);
      if (typeof window !== 'undefined') sessionStorage.setItem('checkout_billingId', value);
      const selected = addresses.find((a) => a.id === value) || null;
      applyBillingAddress(selected);
      setBillingTouched({});
      if (sameAsBilling) {
        const newShippingId = selected ? selected.id : "new";
        setShippingId(newShippingId);
        if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', newShippingId);
        applyShippingAddress(selected);
        setShippingTouched({});
      }
    },
    [addresses, applyBillingAddress, applyShippingAddress, markAddressDirty, sameAsBilling]
  );

  const handleShippingSelect = useCallback(
    (value: string) => {
      markAddressDirty();
      setSameAsBilling(false);
      if (value === "new") {
        setShippingId("new");
        if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', 'new');
        applyShippingAddress(null);
        return;
      }
      setShippingId(value);
      if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', value);
      const selected = addresses.find((a) => a.id === value) || null;
      applyShippingAddress(selected);
      setShippingTouched({});
    },
    [addresses, applyShippingAddress, markAddressDirty]
  );

  const handleSameAsBillingChange = useCallback(
    (checked: boolean) => {
      markAddressDirty();
      setSameAsBilling(checked);
      if (typeof window !== 'undefined') sessionStorage.setItem('checkout_sameAsBilling', String(checked));
      if (checked) {
        setShippingId(billingId);
        if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', billingId);
        setShippingCountryCode(billingCountryCode);
        setShippingStateCode(billingStateCode);
        setShippingForm({ ...billingForm });
      } else {
        // Don't auto-select a shipping address — let the user explicitly choose
        setShippingId("new");
        if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', 'new');
        applyShippingAddress(null);
      }
    },
    [
      applyShippingAddress,
      billingForm,
      billingCountryCode,
      billingId,
      billingStateCode,
      markAddressDirty,
    ]
  );

  const syncAddresses = useCallback(
    async (opts?: {
      billingId?: string;
      shippingId?: string;
      sameAsBilling?: boolean;
    }) => {
      if (!canCheckout || !user?.customerId) return;
      try {
        const res = await api.getCustomer(user.customerId);
        if (res.success && res.data) {
          const customerData = res.data as any;
          setCustomerMobile(customerData.mobile || "");

          const list: Address[] = customerData.addresses || [];
          setAddresses(list);
          const hasBill = list.some((a) => a.type === "BILLING");
          const hasShip = list.some((a) => a.type === "SHIPPING");
          setHasBilling(hasBill);
          setHasShipping(hasShip);

          const sorted = [...list].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          const billingCandidates = sorted.filter((a) => a.type === "BILLING");
          const shippingCandidates = sorted.filter((a) => a.type === "SHIPPING");

          const findById = (id?: string) =>
            id ? list.find((addr) => addr.id === id) || null : null;

          // Prioritize: opts.billingId > sessionStorage > current state > default
          const storedBillingId = typeof window !== 'undefined' ? sessionStorage.getItem('checkout_billingId') : null;
          const currentBillingId = billingId !== "new" ? billingId : undefined;

          // Check if user explicitly selected "new" - ignore the initial "new" state of the billingId variable
          const explicitlyNew = opts?.billingId === 'new' || (opts?.billingId === undefined && storedBillingId === 'new');

          const billingAddress = explicitlyNew ? null : (
            findById(opts?.billingId) ||
            findById(storedBillingId || undefined) ||
            findById(currentBillingId) ||
            billingCandidates[0] ||
            sorted[0] ||
            null
          );

          if (billingAddress) {
            setBillingId(billingAddress.id);
            if (typeof window !== 'undefined') sessionStorage.setItem('checkout_billingId', billingAddress.id);
            applyBillingAddress(billingAddress);
          } else {
            setBillingId("new");
            if (typeof window !== 'undefined') sessionStorage.setItem('checkout_billingId', 'new');
            applyBillingAddress(null);
          }

          const storedSameAsBilling = typeof window !== 'undefined' ? sessionStorage.getItem('checkout_sameAsBilling') : null;
          const shouldMatchBilling = opts?.sameAsBilling ?? (storedSameAsBilling !== null ? storedSameAsBilling === 'true' : sameAsBilling);

          if (shouldMatchBilling) {
            setSameAsBilling(true);
            if (typeof window !== 'undefined') sessionStorage.setItem('checkout_sameAsBilling', 'true');
            const newShippingId = billingAddress ? billingAddress.id : "new";
            setShippingId(newShippingId);
            if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', newShippingId);
            applyShippingAddress(billingAddress || null);
          } else {
            setSameAsBilling(false);
            if (typeof window !== 'undefined') sessionStorage.setItem('checkout_sameAsBilling', 'false');
            // Prioritize: opts.shippingId > sessionStorage > current state > default
            const storedShippingId = typeof window !== 'undefined' ? sessionStorage.getItem('checkout_shippingId') : null;
            const currentShippingId = shippingId !== "new" ? shippingId : undefined;

            // Check if user explicitly selected "new" - ignore the initial "new" state of the shippingId variable
            const explicitlyNewShipping = opts?.shippingId === 'new' || (opts?.shippingId === undefined && storedShippingId === 'new');

            const shippingAddress = explicitlyNewShipping ? null : (
              findById(opts?.shippingId) ||
              findById(storedShippingId || undefined) ||
              findById(currentShippingId) ||
              shippingCandidates[0] ||
              sorted[0] ||
              billingAddress ||
              null
            );
            if (shippingAddress) {
              setShippingId(shippingAddress.id);
              if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', shippingAddress.id);
              applyShippingAddress(shippingAddress);
            } else {
              setShippingId("new");
              if (typeof window !== 'undefined') sessionStorage.setItem('checkout_shippingId', 'new');
              applyShippingAddress(null);
            }
          }
        }
      } catch (error) {
        logger.error("Failed to load addresses:", { error: error });
      }
    },
    [api, applyBillingAddress, applyShippingAddress, canCheckout, sameAsBilling, billingId, shippingId, user?.customerId]
  );

  const [customerMobile, setCustomerMobile] = useState<string>("");

  useEffect(() => {
    if (user?.customerId) {
      api.getCustomer(user.customerId).then(res => {
        if (res.success && res.data) {
          const customerType = ((res.data as any).customerType || '').toUpperCase();
          const isB2BCustomer = customerType === 'B2B';
          setIsB2B(isB2BCustomer);
        }
      }).catch(error => {
        logger.error('Error loading customer data:', { error: error });
      });
    }
  }, [user?.customerId]);

  const highValue = useMemo(() => {
    return calculateHighValueDiscount(subtotal, isB2B);
  }, [subtotal, isB2B]);

  const totalDiscount = useMemo(() => {
    const cartDiscount = discount.discountAmount || 0;
    const result = Number((cartDiscount + (discountAmount || 0)).toFixed(2));
    return result;
  }, [discount.discountAmount, discountAmount]);

  useEffect(() => {
    if (authLoading) return; // wait for auth to hydrate
    if (!isAuthenticated) {
      router.replace('/landing/products');
      return;
    }
    // Don't redirect during initial cart load — items may still be fetching
    if (!cartLoading && items.length === 0) {
      router.replace('/landing/products');
    }
  }, [isAuthenticated, authLoading, router, items, cartLoading]);

  // Validate stock on mount
  useEffect(() => {
    if (!isAuthenticated || !user?.customerId) return;
    (async () => {
      try {
        const res = await api.validateCartStock();
        if (res.success && res.data && res.data.removedItems && res.data.removedItems.length > 0) {
          const names = (res.data.removedItems as any[]).map((i: any) =>
            `${i.productName}${i.variantName ? ` (${i.variantName})` : ''}`
          ).join(', ');
          toast.warning(`Removed out-of-stock items: ${names}`);
          await refresh();
          if (items.length === 0) router.replace('/landing/products');
        }
      } catch (err) {
        logger.error('Failed to validate cart stock:', { error: err });
      }
    })();
  }, [isAuthenticated, user?.customerId]);

  const sortedAddresses = useMemo(
    () =>
      [...addresses].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [addresses]
  );

  const billingAddressOptions = useMemo(() => {
    const billingList = sortedAddresses.filter((addr) => addr.type === "BILLING");
    return billingList.length ? billingList : sortedAddresses;
  }, [sortedAddresses]);

  const shippingAddressOptions = useMemo(() => {
    const shippingList = sortedAddresses.filter((addr) => addr.type === "SHIPPING");
    return shippingList.length ? shippingList : sortedAddresses;
  }, [sortedAddresses]);

  // Load custom countries on mount - ONLY SOURCE OF TRUTH
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await getCustomCountries();
        if (response.success && response.data) {
          setCustomCountries(response.data);
        }
      } catch (error) {
        logger.error('Failed to load custom countries:', { error: error });
      }
    };
    loadCountries();
  }, []);

  // Load custom states when billing country changes - ONLY SOURCE OF TRUTH
  useEffect(() => {
    const loadStates = async () => {
      if (!billingCountryCode) {
        setCustomBillingStates([]);
        return;
      }
      try {
        // Use the country name directly from customCountries
        const countryName = customCountries.find(c => c === billingCountryCode) || billingCountryCode;
        const response = await getCustomStates(countryName);
        if (response.success && response.data) {
          setCustomBillingStates(response.data);
        }
      } catch (error) {
        logger.error('Failed to load custom billing states:', { error: error });
        setCustomBillingStates([]);
      }
    };
    loadStates();
  }, [billingCountryCode, customCountries]);

  // Load custom cities when billing state changes - ONLY SOURCE OF TRUTH
  useEffect(() => {
    const loadCities = async () => {
      if (!billingCountryCode || !billingStateCode) {
        setCustomBillingCities([]);
        return;
      }
      try {
        const countryName = customCountries.find(c => c === billingCountryCode) || billingCountryCode;
        const stateName = customBillingStates.find(s => s === billingStateCode) || billingStateCode;
        const response = await getCustomCities(countryName, stateName);
        if (response.success && response.data) {
          setCustomBillingCities(response.data);
        }
      } catch (error) {
        logger.error('Failed to load custom billing cities:', { error: error });
        setCustomBillingCities([]);
      }
    };
    loadCities();
  }, [billingCountryCode, billingStateCode, customCountries, customBillingStates]);

  // Load custom states when shipping country changes - ONLY SOURCE OF TRUTH
  useEffect(() => {
    const loadStates = async () => {
      if (!shippingCountryCode || sameAsBilling) {
        setCustomShippingStates([]);
        return;
      }
      try {
        const countryName = customCountries.find(c => c === shippingCountryCode) || shippingCountryCode;
        const response = await getCustomStates(countryName);
        if (response.success && response.data) {
          setCustomShippingStates(response.data);
        }
      } catch (error) {
        logger.error('Failed to load custom shipping states:', { error: error });
        setCustomShippingStates([]);
      }
    };
    loadStates();
  }, [shippingCountryCode, sameAsBilling, customCountries]);

  // Load custom cities when shipping state changes - ONLY SOURCE OF TRUTH
  useEffect(() => {
    const loadCities = async () => {
      if (!shippingCountryCode || !shippingStateCode || sameAsBilling) {
        setCustomShippingCities([]);
        return;
      }
      try {
        const countryName = customCountries.find(c => c === shippingCountryCode) || shippingCountryCode;
        const stateName = customShippingStates.find(s => s === shippingStateCode) || shippingStateCode;
        const response = await getCustomCities(countryName, stateName);
        if (response.success && response.data) {
          setCustomShippingCities(response.data);
        }
      } catch (error) {
        logger.error('Failed to load custom shipping cities:', { error: error });
        setCustomShippingCities([]);
      }
    };
    loadCities();
  }, [shippingCountryCode, shippingStateCode, sameAsBilling, customCountries, customShippingStates]);

  // Handle opening the add location dialog
  const handleAddLocation = (type: 'state' | 'city', addressType: 'billing' | 'shipping') => {
    const country = addressType === 'billing' ? billingCountryCode : shippingCountryCode;
    const state = addressType === 'billing' ? billingStateCode : shippingStateCode;

    setAddLocationDialog({
      open: true,
      type,
      addressType,
      country,
      state: type === 'city' ? state : undefined
    });
    setNewLocationName('');
  };

  // Handle saving new location
  const handleSaveLocation = async () => {
    if (!newLocationName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setSavingLocation(true);

    // Simulate a brief delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const newValue = newLocationName.trim();

      if (addLocationDialog.type === 'state') {
        if (addLocationDialog.addressType === 'billing') {
          // Update billing state
          setBillingStateCode(newValue);
          setBillingForm(prev => ({
            ...prev,
            state: newValue,
            // Clear city as it's a new state
            city: ''
          }));
          // Clear cities list as it's a new state
          setCustomBillingCities([]);
        } else {
          // Update shipping state
          setShippingStateCode(newValue);
          setShippingForm(prev => ({
            ...prev,
            state: newValue,
            // Clear city as it's a new state
            city: ''
          }));
          // Clear cities list as it's a new state
          setCustomShippingCities([]);
        }
      } else if (addLocationDialog.type === 'city') {
        if (addLocationDialog.addressType === 'billing') {
          // Update billing city
          setBillingForm(prev => ({ ...prev, city: newValue }));
        } else {
          // Update shipping city
          setShippingForm(prev => ({ ...prev, city: newValue }));
        }
      }

      toast.success(`${addLocationDialog.type === 'state' ? 'State' : 'City'} added to address`);

      // Close dialog
      setAddLocationDialog({
        open: false,
        type: null,
        addressType: null,
        country: '',
        state: ''
      });
      setNewLocationName('');

    } catch (error: any) {
      logger.error('Error adding location:', { error: error });
      toast.error('Failed to add location');
    } finally {
      setSavingLocation(false);
    }
  };

  useEffect(() => {
    if (!sameAsBilling) return;
    setShippingForm({ ...billingForm });
    setShippingCountryCode(billingCountryCode);
    setShippingStateCode(billingStateCode);
    setShippingId(billingId);
  }, [sameAsBilling, billingForm, billingCountryCode, billingId, billingStateCode]);

  useEffect(() => {
    if (!canCheckout) return;
    syncAddresses();
  }, [canCheckout, syncAddresses]);

  async function handleSaveAddresses() {
    if (!user?.customerId) {
      setAddrError("User not authenticated");
      return;
    }

    if (
      !billingForm.firstName ||
      !billingForm.lastName ||
      !billingForm.address1 ||
      !billingForm.country ||
      !billingForm.state ||
      !billingForm.city ||
      !billingForm.postalCode ||
      !billingForm.phone
    ) {
      setAddrError("Please fill all required Billing fields");
      return;
    }

    if (!sameAsBilling) {
      if (
        !shippingForm.firstName ||
        !shippingForm.lastName ||
        !shippingForm.address1 ||
        !shippingForm.country ||
        !shippingForm.state ||
        !shippingForm.city ||
        !shippingForm.postalCode ||
        !shippingForm.phone
      ) {
        setAddrError("Please fill all required Shipping fields");
        return;
      }
    }

    setAddrSaving(true);
    setAddrError(null);
    setAddrSuccess(false);

    const buildPayload = (form: AddressFormState, type: "BILLING" | "SHIPPING") => ({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      company: form.company.trim(),
      address1: form.address1.trim(),
      address2: form.address2?.trim() || "",
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
      phone: sanitizePhone(form.phone || ""),
      type,
      isDefault: true,
    });

    const findDuplicateAddress = (form: AddressFormState, type: "BILLING" | "SHIPPING") => {
      const payload = buildPayload(form, type);
      return addresses.find((addr) =>
        addr.firstName === payload.firstName &&
        addr.lastName === payload.lastName &&
        (addr as any).company === payload.company &&
        addr.address1 === payload.address1 &&
        addr.address2 === payload.address2 &&
        addr.city === payload.city &&
        addr.state === payload.state &&
        addr.postalCode === payload.postalCode &&
        addr.country === payload.country &&
        sanitizePhone(addr.phone || "") === payload.phone &&
        addr.type === type
      );
    };

    try {
      const customerId = user.customerId;
      let nextBillingId = billingId;
      let nextShippingId = shippingId;
      let anyChanges = false;

      const existingBilling = addresses.find((addr) => addr.id === billingId) || null;
      if (!existingBilling || billingId === "new") {
        const duplicateBilling = findDuplicateAddress(billingForm, "BILLING");
        if (duplicateBilling) {
          nextBillingId = duplicateBilling.id;
        } else {
          const billingResponse = await api.createAddress(customerId, {
            ...buildPayload(billingForm, "BILLING"),
            customerId,
          });
          if (!billingResponse.success || !billingResponse.data) {
            throw new Error(billingResponse.error || "Failed to save billing address");
          }
          nextBillingId = billingResponse.data.id;
          anyChanges = true;
        }
      } else if (hasAddressChanged(existingBilling, billingForm)) {
        // Create a new address instead of updating the existing one,
        // so that past orders referencing the old address are not affected.
        const duplicateBilling = findDuplicateAddress(billingForm, "BILLING");
        if (duplicateBilling) {
          nextBillingId = duplicateBilling.id;
        } else {
          const billingResponse = await api.createAddress(customerId, {
            ...buildPayload(billingForm, "BILLING"),
            customerId,
          });
          if (!billingResponse.success || !billingResponse.data) {
            throw new Error(billingResponse.error || "Failed to save billing address");
          }
          nextBillingId = billingResponse.data.id;
        }
        anyChanges = true;
      }

      if (sameAsBilling) {
        nextShippingId = nextBillingId;
      } else {
        const existingShipping = addresses.find((addr) => addr.id === shippingId) || null;
        if (!existingShipping || shippingId === "new") {
          const duplicateShipping = findDuplicateAddress(shippingForm, "SHIPPING");
          if (duplicateShipping) {
            nextShippingId = duplicateShipping.id;
          } else {
            const shippingResponse = await api.createAddress(customerId, {
              ...buildPayload(shippingForm, "SHIPPING"),
              customerId,
            });
            if (!shippingResponse.success || !shippingResponse.data) {
              throw new Error(shippingResponse.error || "Failed to save shipping address");
            }
            nextShippingId = shippingResponse.data.id;
            anyChanges = true;
          }
        } else if (hasAddressChanged(existingShipping, shippingForm)) {
          // Create a new address instead of updating the existing one,
          // so that past orders referencing the old address are not affected.
          const duplicateShipping = findDuplicateAddress(shippingForm, "SHIPPING");
          if (duplicateShipping) {
            nextShippingId = duplicateShipping.id;
          } else {
            const shippingResponse = await api.createAddress(customerId, {
              ...buildPayload(shippingForm, "SHIPPING"),
              customerId,
            });
            if (!shippingResponse.success || !shippingResponse.data) {
              throw new Error(shippingResponse.error || "Failed to save shipping address");
            }
            nextShippingId = shippingResponse.data.id;
          }
          anyChanges = true;
        }
      }

      await syncAddresses({
        billingId: nextBillingId !== "new" ? nextBillingId : undefined,
        shippingId:
          sameAsBilling || nextShippingId === nextBillingId
            ? nextBillingId
            : nextShippingId !== "new"
              ? nextShippingId
              : undefined,
        sameAsBilling,
      });

      setBillingId(nextBillingId);
      setShippingId(sameAsBilling ? nextBillingId : nextShippingId);
      // Persist to sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('checkout_billingId', nextBillingId);
        sessionStorage.setItem('checkout_shippingId', sameAsBilling ? nextBillingId : nextShippingId);
        sessionStorage.setItem('checkout_sameAsBilling', String(sameAsBilling));
      }
      setAddrSuccess(true);
      toast.success(anyChanges ? "Addresses saved" : "Addresses already up to date");

      setTimeout(() => {
        router.push("/landing/checkout/items");
      }, 500);
    } catch (err: any) {
      const message = err?.message || "Failed to save addresses";
      setAddrError(message);
      toast.error(message);
    } finally {
      setAddrSaving(false);
    }
  }

  return (
    <div className="force-light min-h-screen bg-background text-foreground">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {redirecting ? (
          <div className="py-16 text-center text-gray-600">Loading checkout…</div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex items-center">
                <div className="flex items-center flex-1">
                  <button type="button" onClick={() => router.push('/landing/checkout')} className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-primary text-white">
                    1
                  </button>
                  <div className="h-1 flex-1 mx-2 rounded bg-gray-200" />
                </div>
                <div className="flex items-center flex-1">
                  <button type="button" disabled className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-gray-200 text-gray-600 cursor-default">
                    2
                  </button>
                  <div className="h-1 flex-1 mx-2 rounded bg-gray-200" />
                </div>
                <div className="flex items-center flex-1">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-gray-200 text-gray-600">3</div>
                  <div className="h-1 flex-1 mx-2 rounded bg-gray-200" />
                </div>
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full font-semibold bg-gray-200 text-gray-600">4</div>
                </div>
              </div>
              <div className="grid grid-cols-4 text-xs text-gray-600 mt-2">
                <div className="text-left">Address</div>
                <div className="text-center">Items</div>
                <div className="text-center">Payment</div>
                <div className="text-right">Summary</div>
              </div>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black mb-4 tracking-tight text-primary uppercase italic">Shipping & Billing Address</h1>
            <p className="text-sm text-gray-500 mb-8">We currently ship within the United States only.</p>

            <div className="max-w-4xl mx-auto">
              <Card className="border-gray-200">
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Billing Address */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest italic">Billing Address</h2>
                      </div>
                      {billingAddressOptions.length > 0 && (
                        <div className="mb-4 space-y-2">
                          <Label htmlFor="billing-address-select">Select saved billing address</Label>
                          <Select value={billingId} onValueChange={handleBillingSelect}>
                            <SelectTrigger
                              id="billing-address-select"
                              className="w-full items-start text-left whitespace-normal break-words leading-tight min-h-[48px]"
                            >
                              <SelectValue placeholder="Choose an address" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72 w-[min(22rem,calc(100vw-2rem))]">
                              {billingAddressOptions.map((address) => (
                                <SelectItem
                                  key={address.id}
                                  value={address.id}
                                  className="whitespace-normal break-words leading-tight py-2 text-sm"
                                >
                                  {formatAddressLabel(address)}
                                </SelectItem>
                              ))}
                              <SelectItem value="new" className="whitespace-normal break-words leading-tight py-2 text-sm">
                                + Add new address
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="billing-firstName">
                              First Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="billing-firstName"
                              value={billingForm.firstName}
                              onChange={(e) => updateBillingField("firstName", e.target.value)}
                              onBlur={() => touchBilling("firstName")}
                              placeholder="Enter first name"
                              maxLength={50}
                              className={billingTouched.firstName && !billingForm.firstName ? "border-red-400" : ""}
                            />
                            {billingTouched.firstName && !billingForm.firstName && (
                              <p className="text-xs text-red-500 mt-1">First name is required</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="billing-lastName">
                              Last Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="billing-lastName"
                              value={billingForm.lastName}
                              onChange={(e) => updateBillingField("lastName", e.target.value)}
                              onBlur={() => touchBilling("lastName")}
                              placeholder="Enter last name"
                              maxLength={50}
                              className={billingTouched.lastName && !billingForm.lastName ? "border-red-400" : ""}
                            />
                            {billingTouched.lastName && !billingForm.lastName && (
                              <p className="text-xs text-red-500 mt-1">Last name is required</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="billing-company">Company Name (Optional)</Label>
                          <Input
                            id="billing-company"
                            value={billingForm.company}
                            onChange={(e) => updateBillingField("company", e.target.value)}
                            placeholder="Enter company name"
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <Label htmlFor="billing-address1">
                            Address Line 1 <span className="text-red-500">*</span>
                          </Label>
                          <GooglePlacesAutocomplete
                            id="billing-address1"
                            value={billingForm.address1}
                            onChange={(val) => updateBillingField("address1", val)}
                            onBlur={() => touchBilling("address1")}
                            placeholder="Enter address"
                            className={billingTouched.address1 && !billingForm.address1 ? "border-red-400" : ""}
                            onAddressSelect={(parsed) => {
                              markAddressDirty();
                              setBillingForm((prev) => ({
                                ...prev,
                                address1: parsed.address1 || prev.address1,
                                address2: parsed.address2 || prev.address2,
                                city: parsed.city || prev.city,
                                state: parsed.state || prev.state,
                                postalCode: parsed.postalCode || prev.postalCode,
                                country: parsed.country || prev.country,
                              }));
                              if (parsed.country) setBillingCountryCode(parsed.country);
                              if (parsed.state) setBillingStateCode(parsed.state);
                            }}
                          />
                          {billingTouched.address1 && !billingForm.address1 && (
                            <p className="text-xs text-red-500 mt-1">Address is required</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="billing-address2">Address Line 2 (Optional)</Label>
                          <Input
                            id="billing-address2"
                            value={billingForm.address2}
                            onChange={(e) => updateBillingField("address2", e.target.value)}
                            placeholder="Apartment, suite, etc."
                          />
                        </div>
                        <div>
                          <Label htmlFor="billing-country">
                            Country <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={billingCountryCode}
                            onValueChange={(value) => {
                              markAddressDirty();
                              setBillingCountryCode(value);
                              setBillingStateCode("");
                              setBillingForm((prev) => ({
                                ...prev,
                                country: value,
                                state: "",
                                city: "",
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {billingCountryCode && !customCountries.includes(billingCountryCode) && (
                                <SelectItem value={billingCountryCode}>
                                  {billingCountryCode}
                                </SelectItem>
                              )}
                              {customCountries.map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="billing-state">
                            State <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={billingStateCode}
                            onValueChange={(value) => {
                              if (value === '__add_new__') {
                                handleAddLocation('state', 'billing');
                                return;
                              }
                              markAddressDirty();
                              setBillingStateCode(value);
                              setBillingForm((prev) => ({
                                ...prev,
                                state: value,
                                city: "",
                              }));
                            }}
                            disabled={!billingCountryCode}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {billingStateCode && !customBillingStates.includes(billingStateCode) && (
                                <SelectItem value={billingStateCode}>
                                  {billingStateCode}
                                </SelectItem>
                              )}
                              {customBillingStates.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="billing-city">
                            City <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={billingForm.city}
                            onValueChange={(value) => {
                              if (value === '__add_new__') {
                                handleAddLocation('city', 'billing');
                                return;
                              }
                              updateBillingField("city", value);
                            }}
                            disabled={!billingStateCode}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                              {billingForm.city && !customBillingCities.includes(billingForm.city) && (
                                <SelectItem value={billingForm.city}>
                                  {billingForm.city}
                                </SelectItem>
                              )}
                              {customBillingCities.map((city) => (
                                <SelectItem key={city} value={city}>
                                  {city}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="billing-postalCode">
                            Postal Code <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="billing-postalCode"
                            value={billingForm.postalCode}
                            onChange={(e) => updateBillingField("postalCode", e.target.value.replace(/\D/g, '').slice(0, 5))}
                            onBlur={() => touchBilling("postalCode")}
                            placeholder="5-digit ZIP"
                            inputMode="numeric"
                            maxLength={5}
                            pattern="\d{5}"
                            className={billingTouched.postalCode && !billingForm.postalCode ? "border-red-400" : ""}
                          />
                          {billingTouched.postalCode && !billingForm.postalCode && (
                            <p className="text-xs text-red-500 mt-1">Postal code is required</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="billing-phone">
                            Phone Number <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex gap-2">
                            <div className="flex items-center px-3 border border-input rounded-md bg-muted text-sm text-muted-foreground shrink-0 select-none">
                              🇺🇸 +1
                            </div>
                            <Input
                              id="billing-phone"
                              value={billingForm.phone}
                              onChange={(e) => updateBillingField("phone", sanitizePhone(e.target.value))}
                              onBlur={() => touchBilling("phone")}
                              placeholder="10-digit mobile number"
                              className={`flex-1${billingTouched.phone && billingForm.phone.length !== 10 ? " border-red-400" : ""}`}
                              inputMode="numeric"
                              pattern="\d{10}"
                              maxLength={10}
                            />
                          </div>
                          {billingTouched.phone && billingForm.phone.length !== 10 && (
                            <p className="text-xs text-red-500 mt-1">
                              {billingForm.phone.length === 0 ? "Phone number is required" : "Must be 10 digits"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-primary" />
                          <h2 className="text-xs font-black uppercase tracking-widest italic">Shipping Address</h2>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="same-as-billing"
                            checked={sameAsBilling}
                            onCheckedChange={handleSameAsBillingChange}
                            aria-label="Toggle same as billing"
                          />
                          <Label htmlFor="same-as-billing" className="text-sm cursor-pointer select-none">
                            Same as billing
                          </Label>
                        </div>
                      </div>
                      {shippingAddressOptions.length > 0 && (
                        <div className="mb-4 space-y-2">
                          <Label htmlFor="shipping-address-select">Select saved shipping address</Label>
                          <Select
                            value={shippingId}
                            onValueChange={handleShippingSelect}
                            disabled={sameAsBilling}
                          >
                            <SelectTrigger
                              id="shipping-address-select"
                              className="w-full items-start text-left whitespace-normal break-words leading-tight min-h-[48px]"
                            >
                              <SelectValue
                                placeholder={
                                  sameAsBilling ? "Using billing address" : "Choose an address"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent className="max-h-72 w-[min(22rem,calc(100vw-2rem))]">
                              {shippingAddressOptions.map((address) => (
                                <SelectItem
                                  key={address.id}
                                  value={address.id}
                                  className="whitespace-normal break-words leading-tight py-2 text-sm"
                                >
                                  {formatAddressLabel(address)}
                                </SelectItem>
                              ))}
                              <SelectItem value="new" className="whitespace-normal break-words leading-tight py-2 text-sm">
                                + Add new address
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="shipping-firstName">
                              First Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="shipping-firstName"
                              value={shippingForm.firstName}
                              onChange={(e) => updateShippingField("firstName", e.target.value)}
                              onBlur={() => !sameAsBilling && touchShipping("firstName")}
                              disabled={sameAsBilling}
                              placeholder="Enter first name"
                              maxLength={50}
                              className={!sameAsBilling && shippingTouched.firstName && !shippingForm.firstName ? "border-red-400" : ""}
                            />
                            {!sameAsBilling && shippingTouched.firstName && !shippingForm.firstName && (
                              <p className="text-xs text-red-500 mt-1">First name is required</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="shipping-lastName">
                              Last Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="shipping-lastName"
                              value={shippingForm.lastName}
                              onChange={(e) => updateShippingField("lastName", e.target.value)}
                              onBlur={() => !sameAsBilling && touchShipping("lastName")}
                              disabled={sameAsBilling}
                              placeholder="Enter last name"
                              maxLength={50}
                              className={!sameAsBilling && shippingTouched.lastName && !shippingForm.lastName ? "border-red-400" : ""}
                            />
                            {!sameAsBilling && shippingTouched.lastName && !shippingForm.lastName && (
                              <p className="text-xs text-red-500 mt-1">Last name is required</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="shipping-company">Company Name (Optional)</Label>
                          <Input
                            id="shipping-company"
                            value={shippingForm.company}
                            onChange={(e) => updateShippingField("company", e.target.value)}
                            disabled={sameAsBilling}
                            placeholder="Enter company name"
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <Label htmlFor="shipping-address1">
                            Address Line 1 <span className="text-red-500">*</span>
                          </Label>
                          <GooglePlacesAutocomplete
                            id="shipping-address1"
                            value={shippingForm.address1}
                            onChange={(val) => updateShippingField("address1", val)}
                            onBlur={() => !sameAsBilling && touchShipping("address1")}
                            disabled={sameAsBilling}
                            placeholder="Enter address"
                            className={!sameAsBilling && shippingTouched.address1 && !shippingForm.address1 ? "border-red-400" : ""}
                            onAddressSelect={(parsed) => {
                              markAddressDirty();
                              setShippingForm((prev) => ({
                                ...prev,
                                address1: parsed.address1 || prev.address1,
                                address2: parsed.address2 || prev.address2,
                                city: parsed.city || prev.city,
                                state: parsed.state || prev.state,
                                postalCode: parsed.postalCode || prev.postalCode,
                                country: parsed.country || prev.country,
                              }));
                              if (parsed.country) setShippingCountryCode(parsed.country);
                              if (parsed.state) setShippingStateCode(parsed.state);
                            }}
                          />
                          {!sameAsBilling && shippingTouched.address1 && !shippingForm.address1 && (
                            <p className="text-xs text-red-500 mt-1">Address is required</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="shipping-address2">Address Line 2 (Optional)</Label>
                          <Input
                            id="shipping-address2"
                            value={shippingForm.address2}
                            onChange={(e) => updateShippingField("address2", e.target.value)}
                            disabled={sameAsBilling}
                            placeholder="Apartment, suite, etc."
                          />
                        </div>
                        <div>
                          <Label htmlFor="shipping-country">
                            Country <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={shippingCountryCode}
                            onValueChange={(value) => {
                              if (sameAsBilling) return;
                              markAddressDirty();
                              setShippingCountryCode(value);
                              setShippingStateCode("");
                              setShippingForm((prev) => ({
                                ...prev,
                                country: value,
                                state: "",
                                city: "",
                              }));
                            }}
                            disabled={sameAsBilling}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                            <SelectContent>
                              {shippingCountryCode && !customCountries.includes(shippingCountryCode) && (
                                <SelectItem value={shippingCountryCode}>
                                  {shippingCountryCode}
                                </SelectItem>
                              )}
                              {customCountries.map((country) => (
                                <SelectItem key={country} value={country}>
                                  {country}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="shipping-state">
                            State <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={shippingStateCode}
                            onValueChange={(value) => {
                              if (value === '__add_new__') {
                                handleAddLocation('state', 'shipping');
                                return;
                              }
                              if (sameAsBilling) return;
                              markAddressDirty();
                              setShippingStateCode(value);
                              setShippingForm((prev) => ({
                                ...prev,
                                state: value,
                                city: "",
                              }));
                            }}
                            disabled={sameAsBilling || !shippingCountryCode}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {shippingStateCode && !customShippingStates.includes(shippingStateCode) && (
                                <SelectItem value={shippingStateCode}>
                                  {shippingStateCode}
                                </SelectItem>
                              )}
                              {customShippingStates.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="shipping-city">
                            City <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            value={shippingForm.city}
                            onValueChange={(value) => {
                              if (value === '__add_new__') {
                                handleAddLocation('city', 'shipping');
                                return;
                              }
                              updateShippingField("city", value);
                            }}
                            disabled={sameAsBilling || !shippingStateCode}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select city" />
                            </SelectTrigger>
                            <SelectContent>
                              {shippingForm.city && !customShippingCities.includes(shippingForm.city) && (
                                <SelectItem value={shippingForm.city}>
                                  {shippingForm.city}
                                </SelectItem>
                              )}
                              {customShippingCities.map((city) => (
                                <SelectItem key={city} value={city}>
                                  {city}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="shipping-postalCode">
                            Postal Code <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="shipping-postalCode"
                            value={shippingForm.postalCode}
                            onChange={(e) => updateShippingField("postalCode", e.target.value.replace(/\D/g, '').slice(0, 5))}
                            onBlur={() => !sameAsBilling && touchShipping("postalCode")}
                            disabled={sameAsBilling}
                            placeholder="5-digit ZIP"
                            inputMode="numeric"
                            maxLength={5}
                            pattern="\d{5}"
                            className={!sameAsBilling && shippingTouched.postalCode && !shippingForm.postalCode ? "border-red-400" : ""}
                          />
                          {!sameAsBilling && shippingTouched.postalCode && !shippingForm.postalCode && (
                            <p className="text-xs text-red-500 mt-1">Postal code is required</p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="shipping-phone">
                            Phone Number <span className="text-red-500">*</span>
                          </Label>
                          <div className="flex gap-2">
                            <div className="flex items-center px-3 border border-input rounded-md bg-muted text-sm text-muted-foreground shrink-0 select-none">
                              🇺🇸 +1
                            </div>
                            <Input
                              id="shipping-phone"
                              value={shippingForm.phone}
                              onChange={(e) => updateShippingField("phone", sanitizePhone(e.target.value))}
                              onBlur={() => !sameAsBilling && touchShipping("phone")}
                              disabled={sameAsBilling}
                              placeholder="10-digit mobile number"
                              className={`flex-1${!sameAsBilling && shippingTouched.phone && shippingForm.phone.length !== 10 ? " border-red-400" : ""}`}
                              inputMode="numeric"
                              pattern="\d{10}"
                              maxLength={10}
                            />
                          </div>
                          {!sameAsBilling && shippingTouched.phone && shippingForm.phone.length !== 10 && (
                            <p className="text-xs text-red-500 mt-1">
                              {shippingForm.phone.length === 0 ? "Phone number is required" : "Must be 10 digits"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <Button
                      onClick={handleSaveAddresses}
                      disabled={
                        addrSaving ||
                        !billingForm.firstName ||
                        !billingForm.lastName ||
                        !billingForm.address1 ||
                        !billingForm.city ||
                        !billingForm.state ||
                        !billingForm.postalCode ||
                        !billingCountryCode ||
                        sanitizePhone(billingForm.phone).length !== 10 ||
                        (!sameAsBilling && sanitizePhone(shippingForm.phone).length !== 10)
                      }
                      size="lg"
                      className="px-8"
                    >
                      {addrSaving ? (
                        <>
                          <LoadingSpinner size={16} className="mr-2" />
                          Saving...
                        </>
                      ) : addrSuccess ? (
                        <>✓ Addresses Saved</>
                      ) : (
                        'Continue to Order Review'
                      )}
                    </Button>
                  </div>
                  {addrError && <div className="text-sm text-red-600 mt-4 text-center">{addrError}</div>}
                  {addrSuccess && <div className="text-sm text-green-600 mt-4 text-center">✓ Addresses saved successfully! Redirecting to checkout...</div>}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>

      {/* Add New Location Dialog */}
      <Dialog open={addLocationDialog.open} onOpenChange={(open) => {
        if (!open) {
          setAddLocationDialog({
            open: false,
            type: null,
            addressType: null,
            country: '',
            state: ''
          });
          setNewLocationName('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add New {addLocationDialog.type === 'state' ? 'State' : 'City'}
            </DialogTitle>
            <DialogDescription>
              Enter the name of the {addLocationDialog.type === 'state' ? 'state' : 'city'} you want to add.
              {addLocationDialog.type === 'city' && addLocationDialog.state && (
                <span className="block mt-1">
                  This will be added to{' '}
                  <strong>
                    {State.getStateByCodeAndCountry(addLocationDialog.state, addLocationDialog.country)?.name || addLocationDialog.state}
                  </strong>
                  ,{' '}
                  <strong>
                    {Country.getCountryByCode(addLocationDialog.country)?.name || addLocationDialog.country}
                  </strong>
                </span>
              )}
              {addLocationDialog.type === 'state' && (
                <span className="block mt-1">
                  This will be added to{' '}
                  <strong>
                    {Country.getCountryByCode(addLocationDialog.country)?.name || addLocationDialog.country}
                  </strong>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-location-name">
                {addLocationDialog.type === 'state' ? 'State' : 'City'} Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="new-location-name"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder={`Enter ${addLocationDialog.type === 'state' ? 'state' : 'city'} name`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newLocationName.trim()) {
                    handleSaveLocation();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddLocationDialog({
                  open: false,
                  type: null,
                  addressType: null,
                  country: '',
                  state: ''
                });
                setNewLocationName('');
              }}
              disabled={savingLocation}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLocation}
              disabled={savingLocation || !newLocationName.trim()}
            >
              {savingLocation ? (
                <>
                  <LoadingSpinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}