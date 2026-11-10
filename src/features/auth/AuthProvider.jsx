import { useCallback, useEffect, useMemo, useState } from "react";
import { authService, onSessionEnded } from "../../services/api/index.js";
import { AuthContext } from "./AuthContext.js";
import { isAdmin, isStudent } from "./roles.js";

const RESTORING = { status: "restoring", user: null, endReason: null };

/**
 * Owns the session lifecycle (D1): restores on load before guarded pages
 * render, exposes login/register/logout/profile actions, and reacts to forced
 * sign-out signalled by the shared client when a refresh fails.
 */
export default function AuthProvider({ children }) {
  const [state, setState] = useState(RESTORING);

  useEffect(() => {
    let active = true;
    authService.restoreSession().then((user) => {
      if (!active) return;
      setState((current) =>
        current.status === "restoring"
          ? { status: user ? "authenticated" : "anonymous", user, endReason: current.endReason }
          : current,
      );
    });
    const unsubscribe = onSessionEnded((reason) => {
      if (active) setState({ status: "anonymous", user: null, endReason: reason });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const user = await authService.login(credentials);
    setState({ status: "authenticated", user, endReason: null });
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setState({ status: "anonymous", user: null, endReason: "logout" });
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
    }),
    [state, login, logout, updateProfile, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
