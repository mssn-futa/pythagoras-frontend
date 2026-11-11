/*
 * Explicit analytics consent (D1): the ONLY analytics data this app stores is the preference itself.
 * Stored as { v, choice, at } under one localStorage key; a different version means "ask again".
 */

export const CONSENT_STORAGE_KEY = "pythagoras.analyticsConsent";
export const CONSENT_VERSION = 1;
export const CHOICES = Object.freeze({ UNSET: "unset", GRANTED: "granted", DENIED: "denied" });

/** Reads the stored choice; anything missing, malformed, outdated or unreadable is "unset". */
export function readStoredChoice(storage) {
  try {
    const raw = storage?.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return CHOICES.UNSET;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== CONSENT_VERSION) return CHOICES.UNSET;
    return parsed.choice === CHOICES.GRANTED || parsed.choice === CHOICES.DENIED ? parsed.choice : CHOICES.UNSET;
  } catch {
    return CHOICES.UNSET;
  }
}

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
