import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext.js";
import AuthShell from "../../features/auth/components/AuthShell.jsx";
import { FormAlert, PasswordField, SelectField, SubmitButton, TextField } from "../../features/auth/components/FormControls.jsx";
import { describeFormError } from "../../features/auth/formErrors.js";
import { LEVEL_OPTIONS } from "../../services/api/authService.js";

const FORM_FIELDS = ["first_name", "last_name", "email", "matric_number", "department", "level", "password", "password_confirm"];
const LEVELS = LEVEL_OPTIONS.map((value) => ({ value, label: `${value} level` }));
const EMPTY = { firstName: "", lastName: "", email: "", matricNumber: "", department: "", level: "", password: "", passwordConfirm: "" };

/** Local checks only for what the API would reject before persistence. */
function validate(values) {
  const fields = {};
  if (!values.firstName.trim()) fields.first_name = ["Enter your first name."];
  if (!values.lastName.trim()) fields.last_name = ["Enter your last name."];
  if (!values.email.trim()) fields.email = ["Enter your email address."];
  if (!values.password) fields.password = ["Enter a password."];
  if (values.password && values.password !== values.passwordConfirm) {
    fields.password_confirm = ["Passwords do not match."];
  }
  return Object.keys(fields).length ? { message: "Correct the highlighted fields.", fields } : null;
}

/** /sign-up — one direct registration form (D1); no verification steps. */
const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { message, fields } = describeFormError(error, FORM_FIELDS);

  const bind = (key) => ({
    value: values[key],
    onChange: (event) => setValues((current) => ({ ...current, [key]: event.target.value })),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const invalid = validate(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await register(values);
      navigate("/sign-in", { replace: true, state: { registered: true, email: user?.email ?? values.email.trim() } });
    } catch (caught) {
      setError(caught);
      setLoading(false);
    }
  };

  return (
    <AuthShell
      active="sign-up"
      title="Create your account with Pythagoras"
      subtitle="Names, email and password are required. You can add the rest later."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/sign-in" className="text-[#2A742F] dark:text-[#04AF43] font-medium hover:underline transition-all">
            Sign in
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
        <FormAlert>{message}</FormAlert>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="First name" name="first_name" autoComplete="given-name" errors={fields.first_name} required {...bind("firstName")} />
          <TextField label="Last name" name="last_name" autoComplete="family-name" errors={fields.last_name} required {...bind("lastName")} />
        </div>
        <TextField label="Email" name="email" type="email" autoComplete="email" placeholder="Enter your email" errors={fields.email} required {...bind("email")} />
        <TextField label="Matric number" hint="(optional)" name="matric_number" autoComplete="off" errors={fields.matric_number} {...bind("matricNumber")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Department" hint="(optional)" name="department" errors={fields.department} {...bind("department")} />
          <SelectField label="Level" hint="(optional)" name="level" placeholder="Select level" options={LEVELS} errors={fields.level} {...bind("level")} />
        </div>
        <PasswordField label="Password" name="password" autoComplete="new-password" errors={fields.password} required {...bind("password")} />
        <PasswordField label="Confirm password" name="password_confirm" autoComplete="new-password" errors={fields.password_confirm} required {...bind("passwordConfirm")} />
        <SubmitButton loading={loading} loadingLabel="Creating account...">
          Create account
        </SubmitButton>
      </form>
    </AuthShell>
  );
};

export default Register;
