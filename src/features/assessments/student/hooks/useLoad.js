import { useCallback, useEffect, useEffectEvent, useState } from "react";

/**
 * Runs `loader` when `key` changes (or reload() is called). `loading` is derived
 * from the key, so no state is set synchronously inside the effect.
 */
export function useLoad(loader, key) {
  const [reloads, setReloads] = useState(0);
  const [result, setResult] = useState(null);
  const run = useEffectEvent(loader);
  const requestKey = `${key}#${reloads}`;

  useEffect(() => {
    let active = true;
    run().then(
      (data) => active && setResult({ requestKey, data, error: null }),
      (error) => active && setResult({ requestKey, data: null, error }),
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const reload = useCallback(() => setReloads((count) => count + 1), []);
  const settled = result?.requestKey === requestKey;
  return {
    loading: !settled,
    data: settled ? result.data : null,
    error: settled ? result.error : null,
    reload,
  };
}
