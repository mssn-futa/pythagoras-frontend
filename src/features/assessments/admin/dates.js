/**
 * Africa/Lagos has a fixed UTC+1 offset (no daylight saving), so conversion
 * between the datetime-local input value and UTC ISO strings is explicit
 * arithmetic, never `new Date("DD-MM-YYYY")` string parsing.
 */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2026-10-12T21:00" (Lagos wall time) -> "2026-10-12T20:00:00Z". Returns null for blank/invalid. */
export function lagosInputToIso(value) {
  const match = LOCAL_INPUT.exec(String(value ?? "").trim());
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const utc = Date.UTC(year, month - 1, day, hour, minute) - LAGOS_OFFSET_MS;
  const date = new Date(utc);
  if (Number.isNaN(date.getTime())) return null;
  // Reject impossible calendar values (month 13, 30 February, 25:00) instead of rolling over.
  const check = new Date(utc + LAGOS_OFFSET_MS);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute) return null;
  return `${date.toISOString().slice(0, 16)}:00Z`;
}

/** UTC ISO -> datetime-local value in Lagos wall time. Returns "" for blank/invalid. */
export function isoToLagosInput(iso) {
  const time = Date.parse(iso ?? "");
  if (Number.isNaN(time)) return "";
  return new Date(time + LAGOS_OFFSET_MS).toISOString().slice(0, 16);
}

const formatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatLagos(iso) {
  const time = Date.parse(iso ?? "");
  return Number.isNaN(time) ? "—" : `${formatter.format(time)} (WAT)`;
}
