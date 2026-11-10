import { useCallback, useEffect, useRef, useState } from "react";
import { describeClassError } from "./classErrors.js";
import { getClass } from "./classService.js";

/** Loads a class by id; `reload()` refreshes it (used after lifecycle changes and conflicts). */
export function useClassRecord(id) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  const reload = useCallback(async () => {
    const token = ++latest.current;
    try {
      const loaded = await getClass(id);
      if (token !== latest.current) return null;
      setRecord(loaded);
      setError(null);
      return loaded;
    } catch (failure) {
      if (token === latest.current) setError(describeClassError(failure).message);
      return null;
    } finally {
      if (token === latest.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    reload();
  }, [reload]);
  const retry = () => {
    setLoading(true);
    reload();
  };
  return { record, error, loading, reload, retry };
}
