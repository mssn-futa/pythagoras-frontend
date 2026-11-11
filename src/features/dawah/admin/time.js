import { LAGOS_TIME_ZONE } from "./constants.js";

// Africa/Lagos is UTC+01:00 all year (no daylight saving), so the explicit
// conversion is a fixed one-hour offset. Never parse these values with the
// Date string constructor (D0).
const LAGOS_OFFSET_MINUTES = 60;
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const pad = (value) => String(value).padStart(2, "0");

/** "2026-10-09T13:00" (Lagos wall clock, datetime-local) → "2026-10-09T12:00:00Z", or null. */
export function lagosLocalToUtcIso(local) {
  const match = LOCAL_PATTERN.exec(local ?? "");
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const stamp = Date.UTC(year, month - 1, day, hour, minute) - LAGOS_OFFSET_MINUTES * 60_000;
  const date = new Date(stamp);
  // Reject rolled-over values such as 2026-02-31.
  const roundTrip = utcIsoToLagosLocal(date.toISOString());
  if (roundTrip !== local) return null;
  return `${date.toISOString().slice(0, 19)}Z`;
}

/** "2026-10-09T12:00:00Z" → "2026-10-09T13:00" for a datetime-local input, or "". */
export function utcIsoToLagosLocal(iso) {
  const stamp = parseIsoInstant(iso);
  if (stamp === null) return "";
  const lagos = new Date(stamp + LAGOS_OFFSET_MINUTES * 60_000);
  return `${lagos.getUTCFullYear()}-${pad(lagos.getUTCMonth() + 1)}-${pad(lagos.getUTCDate())}T${pad(lagos.getUTCHours())}:${pad(lagos.getUTCMinutes())}`;
}

/** Parses only ISO-8601 instants (the API format), never DD-MM-YYYY. */
export function parseIsoInstant(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(iso)) return null;
  const stamp = Date.parse(iso);
  return Number.isNaN(stamp) ? null : stamp;
}

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAGOS_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Display an API instant in Africa/Lagos. */
export function formatLagos(iso) {
  const stamp = parseIsoInstant(iso);
  return stamp === null ? "—" : `${formatter.format(new Date(stamp))} WAT`;
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
