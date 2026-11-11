import { formatRemaining } from "../lib/serverClock.js";

/** Display only: the remaining time is derived from the server clock by the caller. */
export default function Countdown({ remainingMs }) {
  const urgent = remainingMs <= 60_000;
  return (
    <div
      role="timer"
      aria-label="Time remaining"
      className={`rounded-lg px-4 py-2 text-lg font-semibold tabular-nums ${
        urgent ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-green-50 text-[#2A742F] dark:bg-gray-800 dark:text-green-300"
      }`}
    >
      {formatRemaining(remainingMs)}
    </div>
  );
}
