import { useState } from "react";
import { useAuth } from "../../features/auth/AuthContext.js";
import { FormAlert, FormNotice, SelectField, SubmitButton, TextField } from "../../features/auth/components/FormControls.jsx";
import { describeFormError } from "../../features/auth/formErrors.js";
import { LEVEL_OPTIONS } from "../../services/api/authService.js";

const FORM_FIELDS = ["first_name", "last_name", "department", "level"];
const LEVELS = LEVEL_OPTIONS.map((value) => ({ value, label: `${value} level` }));

function editableValues(user) {
  return {
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    department: user?.department ?? "",
    level: user?.level ?? "",
  };
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-[#6B7280] dark:text-gray-400">{label}</dt>
      <dd className="font-medium text-[#1F2937] dark:text-white break-words">{value || "Not set"}</dd>
    </div>
  );
}

/** /profile — view own account; edit names/department/level only (D1). */
const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [values, setValues] = useState(() => editableValues(user));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const { message, fields } = describeFormError(error, FORM_FIELDS);
  const unchanged = FORM_FIELDS.every((key) => values[key] === editableValues(user)[key]);

  const bind = (key) => ({
    value: values[key],
    onChange: (event) => {
      setSaved(false);
      setValues((current) => ({ ...current, [key]: event.target.value }));
    },
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateProfile(values);
      setValues(editableValues(updated));
      setSaved(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  };

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  return (
    <div className="space-y-6 pt-22">
      <section className="py-8 px-5 md:px-8 bg-white rounded-2xl dark:bg-black">
        <h1 className="text-2xl font-semibold text-[#1F2937] dark:text-white">{fullName || "Your profile"}</h1>
        <p className="text-sm text-[#6B7280] dark:text-gray-400 capitalize">{user?.role}</p>
        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Detail label="Email" value={user?.email} />
          <Detail label="Matric number" value={user?.matric_number} />
          <Detail label="Department" value={user?.department} />
          <Detail label="Level" value={user?.level ? `${user.level} level` : ""} />
        </dl>
        <p className="mt-4 text-xs text-[#6B7280] dark:text-gray-400">
          Email and matric number changes are handled by an administrator.
        </p>
      </section>

      <section className="py-8 px-5 md:px-8 bg-white rounded-2xl dark:bg-black">
        <h2 className="text-xl font-semibold text-[#1F2937] dark:text-white mb-4">Edit profile</h2>
        <form className="space-y-4 max-w-2xl" onSubmit={handleSubmit} noValidate>
          <FormAlert>{message}</FormAlert>
          <FormNotice>{saved ? "Profile saved." : null}</FormNotice>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="First name" name="first_name" autoComplete="given-name" errors={fields.first_name} required {...bind("first_name")} />
            <TextField label="Last name" name="last_name" autoComplete="family-name" errors={fields.last_name} required {...bind("last_name")} />
            <TextField label="Department" name="department" errors={fields.department} {...bind("department")} />
            <SelectField label="Level" name="level" placeholder="Not set" options={LEVELS} errors={fields.level} {...bind("level")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label="Email" name="email" value={user?.email ?? ""} readOnly disabled />
            <TextField label="Matric number" name="matric_number" value={user?.matric_number ?? ""} readOnly disabled />
          </div>
          <SubmitButton className="sm:w-auto sm:px-8" loading={saving} loadingLabel="Saving..." disabled={unchanged}>
            Save changes
          </SubmitButton>
        </form>
      </section>
    </div>
  );
};

export default Profile;
