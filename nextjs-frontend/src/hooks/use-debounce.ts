import { useEffect, useState } from "react";

/**
 * Returns `value` only after it has stopped changing for `delay` ms.
 *
 * Search inputs that feed a fetch directly fire one request per keystroke.
 * Debouncing collapses those into one, but it does NOT make the result correct
 * on its own -- a slow response can still land after a faster later one. The
 * caller still needs a sequence guard so only the newest response is applied.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
