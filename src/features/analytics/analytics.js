import { gtagScriptUrl } from "./config.js";
import { browserOptsOut, CHOICES, clearAnalyticsCookies, CONSENT_STORAGE_KEY, readStoredChoice, writeStoredChoice } from "./consent.js";

/*
 * The single analytics adapter (PLAT-08, D1 "Phase 1 analytics").
 *
 * - Nothing loads and nothing is sent until the visitor explicitly accepts. Do Not Track /
 *   Global Privacy Control count as a decline and are never prompted.
 * - After consent the gtag script is injected once, configured with send_page_view:false and
 *   Google signals / ad personalization off; page views are sent per completed navigation
 *   with a sanitized route template and generic title only.
 * - Events are never queued: a page view or sign-up that happens before consent is dropped,
 *   so nothing is replayed when consent arrives later.
 * - Withdrawal sets GA's documented opt-out flag, denies analytics storage, expires the _ga*
 *   cookies and stops all further events, without reloading the page.
 * - Every failure (storage, blocked script, gtag error) is swallowed: analytics must never
 *   break rendering, authentication or navigation.
 */

const SCRIPT_ATTRIBUTE = "data-pythagoras-analytics";

const noop = () => {};

function defaultEnvironment() {
  const win = typeof window === "undefined" ? undefined : window;
  let storage;
  try {
    storage = win?.localStorage;
  } catch {
    storage = undefined;
  }
  return { win, doc: win?.document, storage };
}

/** A controller with nothing enabled (no measurement ID configured). */
function disabledAnalytics() {
  const snapshot = Object.freeze({ enabled: false, choice: CHOICES.UNSET, optOutSignal: false, active: false, scriptStatus: "idle" });
  return {
    enabled: false,
    getSnapshot: () => snapshot,
    subscribe: () => noop,
    accept: noop,
    decline: noop,
    withdraw: noop,
    completeNavigation: () => false,
    trackSignUp: () => false,
  };
}

/**
 * @param {{ measurementId: string } | null} config from readAnalyticsConfig()
 * @param {{ win?: Window, doc?: Document, storage?: Storage, now?: () => Date }} [environment] test seam
 */
export function createAnalytics(config, environment = defaultEnvironment()) {
  if (!config?.measurementId) return disabledAnalytics();
  const { measurementId } = config;
  const { win, doc, storage, now = () => new Date() } = environment;
  const optOutSignal = browserOptsOut(win);
  const listeners = new Set();
  const origin = (() => {
    try {
      return win.location.origin;
    } catch {
      return "";
    }
  })();

  let choice = optOutSignal ? CHOICES.DENIED : readStoredChoice(storage);
  let scriptStatus = "idle"; // idle | loading | loaded | failed
  let initialized = false;
  let currentPage = null; // { location, title } of the last completed navigation (memory only)
  let snapshot = null;

  const active = () => choice === CHOICES.GRANTED && !optOutSignal;

  function emitChange() {
    snapshot = null;
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* a broken subscriber must not affect the others */
      }
    });
  }

  function getSnapshot() {
    snapshot ??= Object.freeze({ enabled: true, choice, optOutSignal, active: active(), scriptStatus });
    return snapshot;
  }

  /** gtag requires the Arguments object itself to be pushed (as Google's snippet does). */
  function gtag() {
    try {
      win.dataLayer = win.dataLayer || [];
      win.dataLayer.push(arguments);
    } catch {
      /* swallowed */
    }
  }

  function setOptOutFlag(disabled) {
    try {
      win[`ga-disable-${measurementId}`] = disabled; // GA's documented per-property opt-out switch
    } catch {
      /* swallowed */
    }
  }

  /** Referrer without paths/queries: only our own sanitized pages, or another site's bare origin. */
  function initialReferrer() {
    try {
      const referrer = doc.referrer ? new URL(doc.referrer) : null;
      if (!referrer) return undefined;
      return referrer.origin === origin ? `${origin}/` : `${referrer.origin}/`;
    } catch {
      return undefined;
    }
  }

  function pageContext() {
    return currentPage
      ? { page_location: currentPage.location, page_title: currentPage.title }
      : { page_location: `${origin}/`, page_title: "Pythagoras" };
  }

  function injectScript() {
    try {
      if (doc.querySelector(`script[${SCRIPT_ATTRIBUTE}]`)) return;
      const script = doc.createElement("script");
      script.async = true;
      script.src = gtagScriptUrl(measurementId);
      script.setAttribute(SCRIPT_ATTRIBUTE, "");
      script.addEventListener("load", () => {
        scriptStatus = "loaded";
        emitChange();
      });
      // Ad blockers and network failures land here; the product keeps working.
      script.addEventListener("error", () => {
        scriptStatus = "failed";
        emitChange();
      });
      scriptStatus = "loading";
      (doc.head ?? doc.body).appendChild(script);
    } catch {
      scriptStatus = "failed";
    }
  }

  function start() {
    setOptOutFlag(false);
    if (initialized) {
      gtag("consent", "update", { analytics_storage: "granted" });
      return;
    }
    initialized = true;
    gtag("consent", "default", { analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    gtag("js", now());
    const referrer = initialReferrer();
    // Page context is set globally so automatic/engagement hits never carry the raw URL or document.title.
    gtag("set", { ...pageContext(), ...(referrer ? { page_referrer: referrer } : {}) });
    gtag("config", measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    injectScript();
  }

  function stop() {
    setOptOutFlag(true);
    if (initialized) gtag("consent", "update", { analytics_storage: "denied" });
    try {
      clearAnalyticsCookies(doc);
    } catch {
      /* swallowed */
    }
  }

  function choose(next) {
    if (optOutSignal) return; // DNT/GPC always wins; nothing to store
    choice = next;
    writeStoredChoice(storage, next, now());
    if (next === CHOICES.GRANTED) start();
    else stop();
    emitChange();
  }

  // Another tab changed the preference: follow it (withdrawal must take effect everywhere).
  try {
    win.addEventListener("storage", (event) => {
      if (event.key !== null && event.key !== CONSENT_STORAGE_KEY) return;
      const next = optOutSignal ? CHOICES.DENIED : readStoredChoice(storage);
      if (next === choice) return;
      choice = next;
      if (next === CHOICES.GRANTED) start();
      else if (initialized || next === CHOICES.DENIED) stop();
      emitChange();
    });
  } catch {
    /* swallowed */
  }

  if (active()) start();
  else if (optOutSignal || choice === CHOICES.DENIED) {
    setOptOutFlag(true);
    clearAnalyticsCookies(doc);
  }

  return {
    enabled: true,
    measurementId,
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    accept: () => choose(CHOICES.GRANTED),
    decline: () => choose(CHOICES.DENIED),
    withdraw: () => choose(CHOICES.DENIED),
    /**
     * Records a completed navigation ({ template, title } from describeRoute). Sends one page_view
     * only while consent is active; before consent it is remembered as context only, never replayed.
     */
    completeNavigation(page) {
      try {
        const previous = currentPage;
        currentPage = { location: `${origin}${page.template}`, title: page.title };
        if (!active()) return false;
        const params = { ...pageContext(), ...(previous ? { page_referrer: previous.location } : {}) };
        gtag("set", params);
        gtag("event", "page_view", params);
        return true;
      } catch {
        return false;
      }
    },
    /** One sign_up after a confirmed account creation (called by AuthProvider). Dropped without consent. */
    trackSignUp() {
      try {
        if (!active()) return false;
        gtag("event", "sign_up", { method: "email" });
        return true;
      } catch {
        return false;
      }
    },
  };
}
