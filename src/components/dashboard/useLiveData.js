import { useCallback, useEffect, useState } from "react";

/**
 * Loads one dashboard source. Each panel/card owns its own request, so one
 * failing endpoint never blanks the others. A newer request (retry) always
 * wins over an older one, and nothing is set after unmount.
 *
 * Returns { status: "loading" | "ready" | "error", data, error, reload }.
 */
export function useLiveData(load) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ attempt: -1, data: undefined, error: null });

  useEffect(() => {
    let current = true;
    let request;
    try {
      request = Promise.resolve(load()); // started synchronously: never after unmount
    } catch (error) {
      request = Promise.reject(error);
    }
    request.then(
      (data) => current && setResult({ attempt, data, error: null }),
      (error) => current && setResult({ attempt, data: undefined, error: error ?? new Error("Request failed") }),
    );
    return () => {
      current = false;
    };
  }, [load, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const settled = result.attempt === attempt;
  const status = !settled ? "loading" : result.error ? "error" : "ready";
  return { status, data: settled ? result.data : undefined, error: settled ? result.error : null, reload };
}
