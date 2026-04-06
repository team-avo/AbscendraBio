'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { api } from '@/lib/api';
import { useAuth } from './auth-context';

interface GooglePlacesContextValue {
    /** Feature is enabled in admin settings and API key is present */
    isEnabled: boolean;
    /** Google Maps Places library has finished loading */
    isLoaded: boolean;
}

const GooglePlacesContext = createContext<GooglePlacesContextValue>({
    isEnabled: false,
    isLoaded: false,
});

export const useGooglePlaces = () => useContext(GooglePlacesContext);

let loaderPromise: Promise<void> | null = null;

export function GooglePlacesProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const loadScript = useCallback((apiKey: string) => {
        if (loaderPromise) {
            loaderPromise.then(() => setIsLoaded(true)).catch(() => { });
            return;
        }
        setOptions({ key: apiKey, libraries: ['places'] });
        loaderPromise = importLibrary('places').then(() => {
            setIsLoaded(true);
        }).catch(() => {
            // Script failed to load — degrade gracefully
            loaderPromise = null;
        });
    }, []);

    useEffect(() => {
        // If we already have the config and it's loaded, no need to re-fetch
        if (isEnabled && isLoaded) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await api.getGooglePlacesConfig();
                if (cancelled) return;
                if (res.success && res.data?.enabled && res.data.apiKey) {
                    setIsEnabled(true);
                    loadScript(res.data.apiKey);
                }
            } catch {
                // Config fetch failed — stay disabled
            }
        })();
        return () => { cancelled = true; };
    }, [loadScript, isAuthenticated, isEnabled, isLoaded]);

    return (
        <GooglePlacesContext.Provider value={{ isEnabled, isLoaded }}>
            {children}
        </GooglePlacesContext.Provider>
    );
}
