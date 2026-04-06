"use client";

import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as api from "@/lib/api";
import { Loader2 } from "lucide-react";
import logger from '@/lib/logger';

interface CustomLocationSelectorProps {
    // Current values
    country: string;
    state: string;
    city: string;

    // Change handlers
    onCountryChange: (value: string) => void;
    onStateChange: (value: string) => void;
    onCityChange: (value: string) => void;

    // Optional props
    disabled?: boolean;
    required?: boolean;
    showLabels?: boolean;
}

export function CustomLocationSelector({
    country,
    state,
    city,
    onCountryChange,
    onStateChange,
    onCityChange,
    disabled = false,
    required = false,
    showLabels = true
}: CustomLocationSelectorProps) {
    const [countries, setCountries] = useState<string[]>([]);
    const [states, setStates] = useState<string[]>([]);
    const [cities, setCities] = useState<string[]>([]);

    const [loadingCountries, setLoadingCountries] = useState(false);
    const [loadingStates, setLoadingStates] = useState(false);
    const [loadingCities, setLoadingCities] = useState(false);

    const [showCustomCountry, setShowCustomCountry] = useState(false);
    const [showCustomState, setShowCustomState] = useState(false);
    const [showCustomCity, setShowCustomCity] = useState(false);

    const [customCountry, setCustomCountry] = useState("");
    const [customState, setCustomState] = useState("");
    const [customCity, setCustomCity] = useState("");

    // Load countries on mount
    useEffect(() => {
        loadCountries();
    }, []);

    // Load states when country changes
    useEffect(() => {
        if (country && country !== "__custom__") {
            loadStates(country);
            // Reset state and city when country changes
            if (state) {
                onStateChange("");
            }
            if (city) {
                onCityChange("");
            }
        } else {
            setStates([]);
            setCities([]);
        }
    }, [country]);

    // Load cities when state changes
    useEffect(() => {
        if (country && country !== "__custom__" && state && state !== "__custom__") {
            loadCities(country, state);
            // Reset city when state changes
            if (city) {
                onCityChange("");
            }
        } else {
            setCities([]);
        }
    }, [country, state]);

    const loadCountries = async () => {
        setLoadingCountries(true);
        try {
            const response = await api.getCustomCountries();
            if (response.success && response.data) {
                setCountries(response.data);
            }
        } catch (error) {
            logger.error("Failed to load countries:", { error: error });
        } finally {
            setLoadingCountries(false);
        }
    };

    const loadStates = async (countryName: string) => {
        setLoadingStates(true);
        try {
            const response = await api.getCustomStates(countryName);
            if (response.success && response.data) {
                setStates(response.data);
            }
        } catch (error) {
            logger.error("Failed to load states:", { error: error });
        } finally {
            setLoadingStates(false);
        }
    };

    const loadCities = async (countryName: string, stateName: string) => {
        setLoadingCities(true);
        try {
            const response = await api.getCustomCities(countryName, stateName);
            if (response.success && response.data) {
                setCities(response.data);
            }
        } catch (error) {
            logger.error("Failed to load cities:", { error: error });
        } finally {
            setLoadingCities(false);
        }
    };

    const handleCountryChange = (value: string) => {
        if (value === "__custom__") {
            setShowCustomCountry(true);
            setCustomCountry("");
        } else {
            setShowCustomCountry(false);
            onCountryChange(value);
        }
    };

    const handleStateChange = (value: string) => {
        if (value === "__custom__") {
            setShowCustomState(true);
            setCustomState("");
        } else {
            setShowCustomState(false);
            onStateChange(value);
        }
    };

    const handleCityChange = (value: string) => {
        if (value === "__custom__") {
            setShowCustomCity(true);
            setCustomCity("");
        } else {
            setShowCustomCity(false);
            onCityChange(value);
        }
    };

    const handleCustomCountryChange = (value: string) => {
        setCustomCountry(value);
        onCountryChange(value);
    };

    const handleCustomStateChange = (value: string) => {
        setCustomState(value);
        onStateChange(value);
    };

    const handleCustomCityChange = (value: string) => {
        setCustomCity(value);
        onCityChange(value);
    };

    return (
        <div className="space-y-4">
            {/* Country Selector */}
            <div>
                {showLabels && (
                    <Label htmlFor="country">
                        Country {required && <span className="text-destructive">*</span>}
                    </Label>
                )}
                {showCustomCountry ? (
                    <div className="space-y-2">
                        <Input
                            id="country"
                            value={customCountry}
                            onChange={(e) => handleCustomCountryChange(e.target.value)}
                            placeholder="Enter country name"
                            disabled={disabled}
                            required={required}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setShowCustomCountry(false);
                                setCustomCountry("");
                                onCountryChange("");
                            }}
                            className="text-sm text-muted-foreground hover:text-foreground underline"
                        >
                            Select from list instead
                        </button>
                    </div>
                ) : (
                    <Select value={country} onValueChange={handleCountryChange} disabled={disabled || loadingCountries}>
                        <SelectTrigger id="country">
                            <SelectValue placeholder={loadingCountries ? "Loading countries..." : "Select country"} />
                        </SelectTrigger>
                        <SelectContent>
                            {loadingCountries ? (
                                <SelectItem value="loading" disabled>
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading...
                                    </div>
                                </SelectItem>
                            ) : (
                                <>
                                    {countries.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="__custom__" className="text-primary font-medium">
                                        + Add Custom Country
                                    </SelectItem>
                                </>
                            )}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* State Selector */}
            {country && country !== "__custom__" && (
                <div>
                    {showLabels && (
                        <Label htmlFor="state">
                            State / Province {required && <span className="text-destructive">*</span>}
                        </Label>
                    )}
                    {showCustomState ? (
                        <div className="space-y-2">
                            <Input
                                id="state"
                                value={customState}
                                onChange={(e) => handleCustomStateChange(e.target.value)}
                                placeholder="Enter state/province name"
                                disabled={disabled}
                                required={required}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCustomState(false);
                                    setCustomState("");
                                    onStateChange("");
                                }}
                                className="text-sm text-muted-foreground hover:text-foreground underline"
                            >
                                Select from list instead
                            </button>
                        </div>
                    ) : (
                        <Select value={state} onValueChange={handleStateChange} disabled={disabled || loadingStates}>
                            <SelectTrigger id="state">
                                <SelectValue placeholder={loadingStates ? "Loading states..." : "Select state/province"} />
                            </SelectTrigger>
                            <SelectContent>
                                {loadingStates ? (
                                    <SelectItem value="loading" disabled>
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading...
                                        </div>
                                    </SelectItem>
                                ) : states.length > 0 ? (
                                    <>
                                        {states.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {s}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="__custom__" className="text-primary font-medium">
                                            + Add Custom State
                                        </SelectItem>
                                    </>
                                ) : (
                                    <SelectItem value="__custom__" className="text-primary font-medium">
                                        + Add Custom State
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}

            {/* City Selector */}
            {country && country !== "__custom__" && state && state !== "__custom__" && (
                <div>
                    {showLabels && (
                        <Label htmlFor="city">
                            City {required && <span className="text-destructive">*</span>}
                        </Label>
                    )}
                    {showCustomCity ? (
                        <div className="space-y-2">
                            <Input
                                id="city"
                                value={customCity}
                                onChange={(e) => handleCustomCityChange(e.target.value)}
                                placeholder="Enter city name"
                                disabled={disabled}
                                required={required}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCustomCity(false);
                                    setCustomCity("");
                                    onCityChange("");
                                }}
                                className="text-sm text-muted-foreground hover:text-foreground underline"
                            >
                                Select from list instead
                            </button>
                        </div>
                    ) : (
                        <Select value={city} onValueChange={handleCityChange} disabled={disabled || loadingCities}>
                            <SelectTrigger id="city">
                                <SelectValue placeholder={loadingCities ? "Loading cities..." : "Select city"} />
                            </SelectTrigger>
                            <SelectContent>
                                {loadingCities ? (
                                    <SelectItem value="loading" disabled>
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading...
                                        </div>
                                    </SelectItem>
                                ) : cities.length > 0 ? (
                                    <>
                                        {cities.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="__custom__" className="text-primary font-medium">
                                            + Add Custom City
                                        </SelectItem>
                                    </>
                                ) : (
                                    <SelectItem value="__custom__" className="text-primary font-medium">
                                        + Add Custom City
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}
        </div>
    );
}
