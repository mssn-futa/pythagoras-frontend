import { useCallback, useEffect, useMemo, useState } from "react";
import { authService, onSessionEnded } from "../../services/api/index.js";
import { AuthContext } from "./AuthContext.js";
import { isAdmin, isStudent } from "./roles.js";

const RESTORING = { status: "restoring", user: null, endReason: null, restoreError: null };

function settleRestoration(promise, isActive, setState) {
  promise.then(
    (user) => {
      if (!isActive()) return;
      setState((current) =>
        current.status === "restoring"
          ? { status: user ? "authenticated" : "anonymous", user, endReason: current.endReason, restoreError: null }
          : current,
      );
    },
    (error) => {
      if (!isActive()) return;
      // Transient failure: the stored session is kept and the UI offers a retry.
      setState((current) =>
        current.status === "restoring"
          ? { status: "restore_failed", user: null, endReason: null, restoreError: error }
          : current,
      );
    },
  );
}

/**
 * Owns the session lifecycle (D1): restores on load before guarded pages
 * render, exposes login/register/logout/profile actions, and reacts to forced
 * sign-out signalled by the shared client when a refresh fails.
 */
export default function AuthProvider({ children }) {
  const [state, setState] = useState(RESTORING);

  useEffect(() => {
    let active = true;
    settleRestoration(authService.restoreSession(), () => active, setState);
    const unsubscribe = onSessionEnded((reason) => {
      if (active) setState({ status: "anonymous", user: null, endReason: reason, restoreError: null });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const user = await authService.login(credentials);
    setState({ status: "authenticated", user, endReason: null, restoreError: null });
    return user;
  }, []);

  const retryRestore = useCallback(() => {
    setState(RESTORING);
    settleRestoration(authService.restoreSession(), () => true, setState);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({ status: "anonymous", user: null, endReason: "logout", restoreError: null });
  }, []);

  const updateProfile = useCallback(async (changes) => {
    const user = await authService.updateProfile(changes);
    setState((current) => ({ ...current, user }));
    return user;
  }, []);

  const reloadUser = useCallback(async () => {
    const user = await authService.getCurrentUser();
    setState((current) => ({ ...current, user }));
    return user;
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated: state.status === "authenticated",
      isAdmin: isAdmin(state.user),
      isStudent: isStudent(state.user),
      login,
      register: authService.register,
      logout,
      updateProfile,
      reloadUser,
      retryRestore,
    }),
    [state, login, logout, updateProfile, reloadUser, retryRestore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
