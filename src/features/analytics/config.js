/*
 * Phase 1 analytics configuration (D1 "Phase 1 analytics", PLAT-08).
 * The GA4 measurement ID is a PUBLIC build value (VITE_GA_MEASUREMENT_ID), not a secret.
 * Absent or malformed → analytics is fully off: no consent prompt, no script, no requests.
 */

/** GA4 web stream measurement IDs look like G-XXXXXXXXXX. */
export const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

/** The only script origin the tag loads from (CSP script-src; scripts/hosting/headers.mjs). */
export const GTAG_SCRIPT_ORIGIN = "https://www.googletagmanager.com";

export function readAnalyticsConfig(env = {}) {
  const measurementId = String(env.VITE_GA_MEASUREMENT_ID ?? "").trim().toUpperCase();
  if (!MEASUREMENT_ID_PATTERN.test(measurementId)) return null;
  return { measurementId };
}

export const gtagScriptUrl = (measurementId) => `${GTAG_SCRIPT_ORIGIN}/gtag/js?id=${encodeURIComponent(measurementId)}`;
