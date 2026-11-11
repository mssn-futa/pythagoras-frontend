import { gtagScriptUrl } from "./config.js";
import { browserOptsOut, CHOICES, clearAnalyticsCookies, CONSENT_STORAGE_KEY, readStoredConsent, writeStoredChoice } from "./consent.js";

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
 * - While active, history.pushState/replaceState and popstate first `set` the sanitized page context
 *   of the NEXT location, so even a misconfigured property's automatic history page_view (enhanced
 *   measurement) can only carry the route template, never the raw URL.
 * - Withdrawal sets GA's documented opt-out flag, denies analytics storage, expires the _ga*
 *   cookies, stops all further events and then reloads the page ONCE (guarded) so gtag.js is
 *   unloaded instead of relying on consent-mode cookieless pings.
 * - A stored choice older than 12 months is asked again.
 * - Every failure (storage, blocked script, gtag error) is swallowed: analytics must never
 *   break rendering, authentication or navigation.
 */

const SCRIPT_ATTRIBUTE = "data-pythagoras-analytics";
/** sessionStorage marker: "this load follows a withdrawal reload" (shows the notice, never reloads again). */
export const WITHDRAW_RELOAD_KEY = "pythagoras.analyticsWithdrawReload";
const RELOAD_GUARD_MS = 60 * 1000;

const noop = () => {};

function defaultEnvironment() {
  const win = typeof window === "undefined" ? undefined : window;
  let storage;
  let session;
  try {
    storage = win?.localStorage;
  } catch {
    storage = undefined;
  }
  try {
    session = win?.sessionStorage;
  } catch {
    session = undefined;
  }
  return { win, doc: win?.document, storage, session, reload: () => win.location.reload() };
}

/** A controller with nothing enabled (no measurement ID configured). */
function disabledAnalytics() {
  const snapshot = Object.freeze({ enabled: false, choice: CHOICES.UNSET, optOutSignal: false, active: false, scriptStatus: "idle", withdrawnByReload: false });
  return {
    enabled: false,
    getSnapshot: () => snapshot,
    subscribe: () => noop,
    accept: noop,
    decline: noop,
    withdraw: noop,
    completeNavigation: () => false,
    trackSignUp: () => false,
    setPageResolver: noop,
    dispose: noop,
  };
}

/**
 * @param {{ measurementId: string } | null} config from readAnalyticsConfig()
 * @param {{ win?: Window, doc?: Document, storage?: Storage, session?: Storage, reload?: () => void, now?: () => Date }} [environment] test seam
 */
export function createAnalytics(config, environment = defaultEnvironment()) {
  if (!config?.measurementId) return disabledAnalytics();
  const { measurementId } = config;
  const { win, doc, storage, session, reload = noop, now = () => new Date() } = environment;
  const optOutSignal = browserOptsOut(win);
  const listeners = new Set();
  const origin = (() => {
    try {
      return win.location.origin;
    } catch {
      return "";
    }
  })();

  const stored = readStoredConsent(storage, now());
  let choice = optOutSignal ? CHOICES.DENIED : stored.choice;
  let scriptStatus = "idle"; // idle | loading | loaded | failed
  let initialized = false;
  let currentPage = null; // { location, title } of the last completed navigation (memory only)
  let resolvePage = null; // pathname → { template, title }, registered by RouteAnalytics
  let reloading = false;
  let snapshot = null;
  const withdrawnByReload = consumeReloadMarker();

  function consumeReloadMarker() {
    try {
      const marker = session?.getItem(WITHDRAW_RELOAD_KEY);
      if (marker) session.removeItem(WITHDRAW_RELOAD_KEY);
      return Boolean(marker);
    } catch {
      return false;
    }
  }

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
    snapshot ??= Object.freeze({ enabled: true, choice, optOutSignal, active: active(), scriptStatus, withdrawnByReload });
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

  /** Sanitized { page_location, page_title } for any URL (pushState target, popstate location). */
  function sanitizedContext(url) {
    try {
      const target = new URL(String(url), win.location.href);
      const page = target.origin === origin ? resolvePage?.(target.pathname) : null;
      return page ? { page_location: `${origin}${page.template}`, page_title: page.title } : { page_location: `${origin}/`, page_title: "Pythagoras" };
    } catch {
      return { page_location: `${origin}/`, page_title: "Pythagoras" };
    }
  }

  const onPopState = () => {
    if (active()) gtag("set", sanitizedContext(win.location.href));
  };

  /*
   * Registered before gtag.js loads, so these run BEFORE gtag's own history listeners: our wrapper is
   * either the inner function gtag's wrapper calls (the `set` lands in dataLayer during the call) or the
   * outer one (it runs first). Either way the next automatic hit sees the sanitized page context.
   */
  const hooks = {}; // name → { original, wrapped } installed by THIS controller

  function hookHistory() {
    try {
      const history = win.history;
      for (const name of ["pushState", "replaceState"]) {
        const original = history[name];
        if (typeof original !== "function" || original === hooks[name]?.wrapped) continue;
        const wrapped = function analyticsHistoryHook(state, title, url) {
          if (active() && url !== undefined && url !== null) gtag("set", sanitizedContext(url));
          return original.apply(this, arguments);
        };
        hooks[name] = { original, wrapped };
        history[name] = wrapped;
      }
      win.addEventListener("popstate", onPopState);
    } catch {
      /* swallowed */
    }
  }

  function unhookHistory() {
    try {
      const history = win.history;
      for (const name of ["pushState", "replaceState"]) {
        // Restore only when nothing wrapped ours since; otherwise our wrapper stays, inert while inactive.
        if (hooks[name] && history[name] === hooks[name].wrapped) {
          history[name] = hooks[name].original;
          delete hooks[name];
        }
      }
      win.removeEventListener("popstate", onPopState);
    } catch {
      /* swallowed */
    }
  }

  /** One reload after withdrawing in a document where gtag.js ran; the marker makes a second reload impossible. */
  function reloadOnceAfterWithdrawal() {
    if (reloading) return;
    try {
      const previous = Number(session?.getItem(WITHDRAW_RELOAD_KEY));
      if (Number.isFinite(previous) && previous > 0 && now().getTime() - previous < RELOAD_GUARD_MS) return;
      session?.setItem(WITHDRAW_RELOAD_KEY, String(now().getTime()));
    } catch {
      return; // without the marker we cannot prove there is no loop: keep the (already disabled) tag instead
    }
    reloading = true;
    try {
      reload();
    } catch {
      /* swallowed */
    }
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
    hookHistory();
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
    unhookHistory();
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
    // gtag.js ran in this document: unload it. (Other tabs only stop; reloading them could lose unsaved input.)
    if (next === CHOICES.DENIED && initialized) reloadOnceAfterWithdrawal();
  }

  // Another tab changed the preference: follow it (withdrawal must take effect everywhere).
  const onStorage = (event) => {
    if (event.key !== null && event.key !== CONSENT_STORAGE_KEY) return;
    const next = optOutSignal ? CHOICES.DENIED : readStoredConsent(storage, now()).choice;
    if (next === choice) return;
    choice = next;
    if (next === CHOICES.GRANTED) start();
    else if (initialized || next === CHOICES.DENIED) stop();
    emitChange();
  };
  try {
    win.addEventListener("storage", onStorage);
  } catch {
    /* swallowed */
  }

  if (active()) start();
  else if (optOutSignal || choice === CHOICES.DENIED || stored.expired) {
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
    /** Detaches this controller's listeners and history hooks (tests; the app keeps one controller for its lifetime). */
    dispose() {
      unhookHistory();
      try {
        win.removeEventListener("storage", onStorage);
      } catch {
        /* swallowed */
      }
      listeners.clear();
    },
    /** RouteAnalytics registers how a pathname maps to its template (it knows the route tree and basename). */
    setPageResolver(resolver) {
      resolvePage = typeof resolver === "function" ? resolver : null;
    },
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
