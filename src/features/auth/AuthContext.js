import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

/**
 * Current session: { status: "restoring"|"restore_failed"|"authenticated"|"anonymous",
 * user, endReason: null|"logout"|"expired", restoreError, isAuthenticated,
 * isAdmin, isStudent, login, register, logout, updateProfile, reloadUser,
 * retryRestore }. "restore_failed" means a transient failure (network, 429,
 * 5xx) kept the stored session; offer retryRestore().
 */
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
