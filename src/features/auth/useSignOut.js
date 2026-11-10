import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext.js";

/** Sign-out action for navigation UI: revokes, clears, then shows sign-in. */
export function useSignOut() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const signOut = useCallback(async () => {
    setSigningOut(true);
    await logout();
    navigate("/sign-in", { replace: true });
  }, [logout, navigate]);
  return { signOut, signingOut };
}
