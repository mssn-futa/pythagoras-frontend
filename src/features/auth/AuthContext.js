import { createContext, useContext } from "react";

export const AuthContext = createContext(null);

/**
 * Current session: { status: "restoring"|"authenticated"|"anonymous", user,
 * endReason: null|"logout"|"expired", isAuthenticated, isAdmin, isStudent,
 * login, register, logout, updateProfile, reloadUser }.
 */
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
