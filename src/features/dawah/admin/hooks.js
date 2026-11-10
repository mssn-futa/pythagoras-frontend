import { useCallback, useEffect, useState } from "react";

/**
 * Runs `loader` (must be memoized with useCallback) and exposes
 * { data, error, loading, reload }. `data` keeps the previous value while a
 * reload is in flight so action buttons do not blank the page.
 */
export function useLoad(loader) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    loader().then(
      (data) => active && setResult({ loader, version, data, error: null }),
      (error) => active && setResult({ loader, version, data: null, error }),
    );
    return () => {
      active = false;
    };
  }, [loader, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const current = result && result.loader === loader && result.version === version;
  return {
    data: result?.data ?? null,
    error: current ? result.error : null,
    loading: !current,
    reload,
  };
}
