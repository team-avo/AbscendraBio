'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useGooglePlaces } from '@/contexts/google-places-context';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ParsedAddress {
    address1: string;
    address2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

interface GooglePlacesAutocompleteProps {
    /** Fires when user selects a place and fields are parsed */
    onAddressSelect: (address: ParsedAddress) => void;
    /** Controlled value for the input */
    value?: string;
    /** Fires on every keystroke (mirrors normal Input onChange) */
    onChange?: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    className?: string;
}

interface SuggestionItem {
    placeId: string;
    text: string;
    prediction: google.maps.places.PlacePrediction;
}

/** Parse address components from the new Places API (uses longText/shortText) */
function parseAddressComponents(components: google.maps.places.AddressComponent[]): ParsedAddress {
    const get = (type: string) => {
        const c = components.find(c => c.types.includes(type));
        return c ? c.longText || '' : '';
    };

    const streetNumber = get('street_number');
    const route = get('route');
    const address1 = [streetNumber, route].filter(Boolean).join(' ');

    const subpremise = get('subpremise');
    const city = get('locality') || get('sublocality_level_1') || get('sublocality') || get('postal_town') || '';
    const state = get('administrative_area_level_1');
    const postalCode = get('postal_code');
    const country = get('country');

    return { address1, address2: subpremise, city, state, postalCode, country };
}

export function GooglePlacesAutocomplete({
    onAddressSelect,
    value,
    onChange,
    placeholder = 'Enter address',
    disabled = false,
    id,
    className,
}: GooglePlacesAutocompleteProps) {
    const { isEnabled, isLoaded } = useGooglePlaces();

    if (!isEnabled || !isLoaded) {
        return (
            <Input
                id={id}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                className={className}
            />
        );
    }

    return (
        <AutocompleteInner
            onAddressSelect={onAddressSelect}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            id={id}
            className={className}
        />
    );
}

/** Inner component — only rendered when the new Places API is loaded */
function AutocompleteInner({
    onAddressSelect,
    value,
    onChange,
    placeholder,
    disabled,
    id,
    className,
}: GooglePlacesAutocompleteProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

    // Create session token on mount and after each selection (billing best-practice)
    const resetSession = useCallback(() => {
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
    }, []);

    useEffect(() => {
        resetSession();
    }, [resetSession]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchSuggestions = useCallback(async (input: string) => {
        if (input.length < 3) {
            setSuggestions([]);
            return;
        }
        try {
            const { suggestions: raw } =
                await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
                    input,
                    sessionToken: sessionTokenRef.current!,
                    includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route'],
                });
            setSuggestions(
                raw
                    .filter((s) => s.placePrediction)
                    .map((s) => ({
                        placeId: s.placePrediction!.placeId,
                        text: s.placePrediction!.text.toString(),
                        prediction: s.placePrediction!,
                    }))
            );
        } catch {
            setSuggestions([]);
        }
    }, []);

    const handleInput = useCallback(
        (val: string) => {
            onChange?.(val);
            setShowDropdown(val.length > 0);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => fetchSuggestions(val), 300);
        },
        [onChange, fetchSuggestions]
    );

    const handleSelect = useCallback(
        async (suggestion: SuggestionItem) => {
            setShowDropdown(false);
            setSuggestions([]);
            onChange?.(suggestion.text);

            try {
                const place = suggestion.prediction.toPlace();
                await place.fetchFields({ fields: ['addressComponents', 'formattedAddress'] });

                if (place.addressComponents) {
                    const parsed = parseAddressComponents(place.addressComponents);
                    if (!parsed.address1) {
                        parsed.address1 = suggestion.text;
                    }
                    onAddressSelect(parsed);
                }
            } catch {
                // Details fetch failed — user can fill manually
            }
            resetSession();
        },
        [onChange, onAddressSelect, resetSession]
    );

    return (
        <div ref={containerRef} className="relative">
            <Input
                id={id}
                value={value}
                onChange={(e) => handleInput(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(className)}
                autoComplete="off"
            />
            {showDropdown && suggestions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-[250px] overflow-y-auto">
                    {suggestions.map((s) => (
                        <li
                            key={s.placeId}
                            className="relative flex cursor-pointer select-none items-center px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelect(s);
                            }}
                        >
                            {s.text}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
