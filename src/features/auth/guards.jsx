import { Navigate, Outlet, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext.js";
import { AccessDenied, SessionLoading, SessionRestoreFailed } from "./components/SessionStatus.jsx";
import { buildSignInPath, getSafeReturnPath, RETURN_PARAM, SIGN_IN_PATH } from "./returnPath.js";
import { defaultHomeFor } from "./roles.js";

function useSignInRedirect() {
  const location = useLocation();
  const { endReason } = useAuth();
  // After an explicit logout the user goes to plain sign-in, not back here.
  return endReason === "logout" ? SIGN_IN_PATH : buildSignInPath(location);
}

/** Renders children (or nested routes) only for an active session. */
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const redirect = useSignInRedirect();
  if (status === "restoring") return <SessionLoading />;
  if (status === "restore_failed") return <SessionRestoreFailed />;
  if (status !== "authenticated") return <Navigate to={redirect} replace />;
  return children ?? <Outlet />;
}

/** Renders children (or nested routes) only for an active admin session. */
export function RequireAdmin({ children }) {
  const { status, isAdmin } = useAuth();
  const redirect = useSignInRedirect();
  if (status === "restoring") return <SessionLoading />;
  if (status === "restore_failed") return <SessionRestoreFailed />;
  if (status !== "authenticated") return <Navigate to={redirect} replace />;
  if (!isAdmin) return <AccessDenied />;
  return children ?? <Outlet />;
}

/** Sign-in/up pages: wait for restoration and send signed-in users onward. */
export function RedirectIfAuthenticated({ children }) {
  const { status, user } = useAuth();
  const [params] = useSearchParams();
  if (status === "restoring") return <SessionLoading />;
  if (status === "restore_failed") return <SessionRestoreFailed />;
  if (status === "authenticated") {
    const target = getSafeReturnPath(params.get(RETURN_PARAM)) ?? defaultHomeFor(user);
    return <Navigate to={target} replace />;
  }
  return children ?? <Outlet />;
}
