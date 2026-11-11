import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_INTERVAL_MS, POLL_MAX_FAILURES, POLL_MAX_POLLS } from "./model.js";

/**
 * Bounded polling. While `active`, runs `task` every `intervalMs` (after the
 * previous run finished). Stops when `active` turns false, on unmount, after
 * `maxPolls` runs, or after `maxFailures` consecutive failures (task threw).
 * `paused` is true once it gave up; `restart()` begins a fresh bounded cycle.
 */
export function usePolling(task, { active, intervalMs = POLL_INTERVAL_MS, maxPolls = POLL_MAX_POLLS, maxFailures = POLL_MAX_FAILURES }) {
  const taskRef = useRef(task);
  const [epoch, setEpoch] = useState(0);
  const [pausedEpoch, setPausedEpoch] = useState(null);

  useEffect(() => {
    taskRef.current = task;
  });

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    let timer = null;
    let runs = 0;
    let failures = 0;

    const run = async () => {
      runs += 1;
      try {
        await taskRef.current();
        failures = 0;
      } catch {
        failures += 1;
      }
      if (cancelled) return;
      if (runs >= maxPolls || failures >= maxFailures) {
        setPausedEpoch(epoch);
        return;
      }
      timer = setTimeout(run, intervalMs);
    };

    timer = setTimeout(run, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, epoch, intervalMs, maxPolls, maxFailures]);

  const restart = useCallback(() => setEpoch((value) => value + 1), []);
  return { paused: active && pausedEpoch === epoch, restart };
}
