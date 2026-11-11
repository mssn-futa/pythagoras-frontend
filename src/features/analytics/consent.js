/*
 * Explicit analytics consent (D1): the ONLY analytics data this app stores is the preference itself.
 * Stored as { v, choice, at } under one localStorage key; a different version means "ask again".
 */

export const CONSENT_STORAGE_KEY = "pythagoras.analyticsConsent";
export const CONSENT_VERSION = 1;
export const CHOICES = Object.freeze({ UNSET: "unset", GRANTED: "granted", DENIED: "denied" });

/** A stored choice older than this is asked again (12 months). */
export const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Reads the stored preference: { choice, expired }. Anything missing, malformed, from another version or
 * unreadable is "unset"; a choice whose `at` is missing, invalid, in the future or older than 12 months is
 * "unset" with expired: true (the visitor is asked again).
 */
export function readStoredConsent(storage, now = new Date()) {
  try {
    const raw = storage?.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return { choice: CHOICES.UNSET, expired: false };
    const parsed = JSON.parse(raw);
    if (parsed?.v !== CONSENT_VERSION) return { choice: CHOICES.UNSET, expired: false };
    if (parsed.choice !== CHOICES.GRANTED && parsed.choice !== CHOICES.DENIED) return { choice: CHOICES.UNSET, expired: false };
    const at = typeof parsed.at === "string" ? Date.parse(parsed.at) : NaN;
    const age = now.getTime() - at;
    if (!Number.isFinite(age) || age < -5 * 60 * 1000 || age > CONSENT_MAX_AGE_MS) return { choice: CHOICES.UNSET, expired: true };
    return { choice: parsed.choice, expired: false };
  } catch {
    return { choice: CHOICES.UNSET, expired: false };
  }
}

export const readStoredChoice = (storage, now) => readStoredConsent(storage, now).choice;

/** Persists a choice. Returns false when storage is unavailable (the choice then lasts for this page only). */
export function writeStoredChoice(storage, choice, now = new Date()) {
  try {
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ v: CONSENT_VERSION, choice, at: now.toISOString() }));
    return true;
  } catch {
    return false;
  }
}

/** Do Not Track or Global Privacy Control: treated as a decline, without prompting. */
export function browserOptsOut(win) {
  try {
    const nav = win?.navigator ?? {};
    return nav.globalPrivacyControl === true || [nav.doNotTrack, win?.doNotTrack, nav.msDoNotTrack].some((value) => value === "1" || value === "yes");
  } catch {
    return false;
  }
}

/** Every first-party GA cookie: `_ga` and `_ga_<container>` (GA4), plus legacy `_gid`/`_gat*` if present. */
export const isAnalyticsCookie = (name) => /^_ga(_|$)/.test(name) || name === "_gid" || /^_gat/.test(name);

/** Expires GA cookies for this host and each parent domain gtag's `cookie_domain: auto` may have used. */
export function clearAnalyticsCookies(doc) {
  try {
    const names = String(doc.cookie ?? "")
      .split(";")
      .map((part) => part.split("=")[0].trim())
      .filter(isAnalyticsCookie);
    if (names.length === 0) return [];
    const hostname = String(doc.location?.hostname ?? "");
    const domains = [null];
    if (/[a-z]/i.test(hostname) && !hostname.includes(":")) {
      const labels = hostname.split(".");
      for (let index = 0; index < labels.length - 1; index += 1) domains.push(labels.slice(index).join("."));
    }
    for (const name of names) {
      for (const domain of domains) {
        doc.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/${domain ? `; Domain=${domain}` : ""}`;
      }
    }
    return names;
  } catch {
    return [];
  }
}
