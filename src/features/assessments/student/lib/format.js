const lagos = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

/** ISO-8601 UTC string -> "12 Oct 2026, 21:00 WAT" (Africa/Lagos, D0). */
export function formatLagos(iso) {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? `${lagos.format(time)} WAT` : "Not set";
}

export const pluralize = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function describeScore(result) {
  if (result.score === null) return "Score unavailable";
  return result.totalPoints === null
    ? `${result.score} points (total unavailable for this older record)`
    : `${result.score} / ${result.totalPoints} points`;
}
