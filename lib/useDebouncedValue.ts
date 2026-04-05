import { useEffect, useState } from "react";

/**
 * Returns a value that updates to `value` only after `delayMs` of stability.
 * Useful for debouncing search input before hitting APIs.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
