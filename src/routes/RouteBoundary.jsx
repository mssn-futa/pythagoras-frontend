import { Component, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { isChunkLoadError } from "./chunkError.js";
import { usePageLoading } from "./lazyPage.js";

export function RouteLoading({ label = "Loading page…", className = "" }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center gap-3 py-16 text-sm text-gray-600 dark:text-gray-300 ${className}`}>
      <span className="h-5 w-5 rounded-full border-2 border-[#2A742F] border-t-transparent animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Navigation runs in a transition, so the previous page stays visible while the
 * next page's chunk downloads. This shows that something is happening: a thin
 * progress bar plus an announced "Loading page…" status.
 */
export function PageLoadingIndicator() {
  const loading = usePageLoading();
  if (!loading) return null;
  return (
    <div role="status" aria-live="polite" data-testid="page-loading" className="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-green-100">
      <div className="h-full w-1/3 animate-pulse bg-[#2A742F]" aria-hidden="true" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

const reloadPage = () => window.location.reload();

export class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previous) {
    // Navigating elsewhere clears a failed page without remounting the layout.
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkLoadError(error);
    const { onReload = reloadPage, className = "" } = this.props;
    return (
      <div role="alert" className={`mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200 ${className}`}>
        <h1 className="text-lg font-semibold text-red-800 dark:text-red-100">
          {chunk ? "This page could not be loaded" : "Something went wrong on this page"}
        </h1>
        <p className="mt-2">
          {chunk
            ? "Part of the app failed to download. Check your connection; if the app was just updated, reloading fetches the latest version."
            : "Reload the page to try again. If it keeps happening, contact the developers."}
        </p>
        <button
          type="button"
          onClick={onReload}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#2A742F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1f5a24] focus:outline-none focus:ring-2 focus:ring-[#2A742F] focus:ring-offset-2"
        >
          Reload page
        </button>
      </div>
    );
  }
}

/**
 * Suspense + error boundary around a lazily loaded route outlet. The error
 * resets when the pathname changes, so navigating away from a failed page works.
 */
export default function RouteBoundary({ children, onReload, className }) {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary resetKey={pathname} onReload={onReload} className={className}>
      <Suspense fallback={<RouteLoading className={className} />}>{children}</Suspense>
    </RouteErrorBoundary>
  );
}
