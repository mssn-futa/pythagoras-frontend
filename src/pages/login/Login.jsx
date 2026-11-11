import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext.js";
import AuthShell from "../../features/auth/components/AuthShell.jsx";
import { FormAlert, FormNotice, PasswordField, SubmitButton, TextField } from "../../features/auth/components/FormControls.jsx";
import { describeFormError } from "../../features/auth/formErrors.js";

const FORM_FIELDS = ["email_or_matric", "password"];

function sessionNotice(endReason, locationState) {
  if (locationState?.registered) return "Account created. Sign in to continue.";
  if (endReason === "expired") return "Your session has ended. Sign in again.";
  if (endReason === "logout") return "You have signed out.";
  return null;
}

/** /sign-in — redirect after success is handled by RedirectIfAuthenticated. */
const Login = () => {
  const { login, endReason } = useAuth();
  const location = useLocation();
  const [emailOrMatric, setEmailOrMatric] = useState(location.state?.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { message, fields } = describeFormError(error, FORM_FIELDS);
  const notice = error ? null : sessionNotice(endReason, location.state);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ emailOrMatric, password });
    } catch (caught) {
      setError(caught);
      setPassword("");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      active="sign-in"
      title="Welcome back to Pythagoras"
      subtitle="Enter your credentials to continue"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/sign-up" className="text-[#2A742F] dark:text-[#04AF43] font-medium hover:underline transition-all">
            Create an account
          </Link>
          <span className="block mt-2">
            <Link to="/privacy" className="text-[#2A742F] dark:text-[#04AF43] hover:underline transition-all">
              Privacy settings
            </Link>
          </span>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <FormNotice>{notice}</FormNotice>
        <FormAlert>{message}</FormAlert>
        <TextField
          label="Email or matric number"
          name="email_or_matric"
          autoComplete="username"
          placeholder="Enter your email or matric number"
          value={emailOrMatric}
          onChange={(event) => setEmailOrMatric(event.target.value)}
          errors={fields.email_or_matric}
          required
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          errors={fields.password}
          required
        />
        <SubmitButton loading={loading} loadingLabel="Signing in..." disabled={!emailOrMatric.trim() || !password}>
          Sign in
        </SubmitButton>
      </form>
    </AuthShell>
  );
};

export default Login;
