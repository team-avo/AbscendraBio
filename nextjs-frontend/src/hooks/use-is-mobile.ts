import { useState, useEffect } from "react";

/**
 * Hook to detect if the current viewport is mobile-sized (< 768px).
 * Uses window.matchMedia for performance and accuracy.
 */
export function useIsMobile(breakpoint: number = 768): boolean {
    const [isMobile, setIsMobile] = useState<boolean>(false);

    useEffect(() => {
        // Initial check
        const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
        setIsMobile(mql.matches);

        // Listener for changes
        const handler = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches);
        };

        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [breakpoint]);

    return isMobile;
}
