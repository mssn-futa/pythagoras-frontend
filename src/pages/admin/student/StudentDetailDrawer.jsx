import { useEffect, useRef, useState } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
import { X } from "lucide-react";
import { FormAlert, FormNotice, SelectField, SubmitButton, TextField } from "../../../features/auth/components/FormControls.jsx";
import Spinner from "../../../features/auth/components/Spinner.jsx";
import { describeFormError } from "../../../features/auth/formErrors.js";
import { getStudent, LEVEL_OPTIONS, setStudentActive, updateStudent } from "../../../services/api/studentService.js";
import StatusBadge from "./StatusBadge.jsx";
import { formatJoined, fullName } from "./studentQuery.js";

const FORM_FIELDS = ["first_name", "last_name", "email", "matric_number", "department", "level"];
const LEVELS = LEVEL_OPTIONS.map((value) => ({ value, label: `${value} level` }));

const toValues = (student) => Object.fromEntries(FORM_FIELDS.map((key) => [key, student?.[key] ?? ""]));

/**
 * Detail/edit drawer for one student, addressed by id (`?student=<id>`), so it
 * loads the real record and survives reload. `onUpdated(student)` receives each
 * server-confirmed record; nothing is reported as saved unless the API accepted it.
 */
const StudentDetailDrawer = ({ id, onClose, onUpdated }) => {
  const [state, setState] = useState({ id: null, status: "loading", student: null, error: null });
  const [values, setValues] = useState(toValues(null));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState(null);
  const [reloads, setReloads] = useState(0);
  const headingRef = useRef(null);
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const statusButtonRef = useRef(null);
  const confirmingBefore = useRef(false);
  const live = useRef(true);

  // The dashboard remounts this drawer per student (key), so a late result for a
  // previous student is dropped here: `live` is false once this instance is gone.
  useEffect(() => {
    live.current = true;
    const opener = document.activeElement;
    return () => {
      live.current = false;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  // Focus follows the confirmation: into Confirm when it opens, back to the status button after.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (confirmingBefore.current) statusButtonRef.current?.focus();
    confirmingBefore.current = confirming;
  }, [confirming]);

  // Trap Tab inside the dialog and pull stray focus back in (the page behind is inert to keyboard users).
  useEffect(() => {
    const focusables = () => [...(dialogRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
    const onKey = (event) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = dialogRef.current?.contains(document.activeElement);
      if (!inside || (event.shiftKey && document.activeElement === first) || (event.shiftKey && document.activeElement === headingRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) (focusables()[0] ?? headingRef.current)?.focus();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getStudent(id)
      .then((student) => {
        if (cancelled) return;
        setState({ id, status: "ready", student, error: null });
        setValues(toValues(student));
      })
      .catch((error) => {
        if (!cancelled) setState({ id, status: "error", student: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloads]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = state.id === id ? state : { status: "loading" };
  const { student } = current;
  useEffect(() => {
    if (current.status !== "loading") headingRef.current?.focus();
  }, [current.status]);

  const dirty = student ? FORM_FIELDS.filter((key) => (values[key] ?? "").trim() !== (student[key] ?? "")) : [];
  const { message, fields } = describeFormError(saveError, FORM_FIELDS);

  const bind = (key) => ({
    value: values[key],
    onChange: (event) => {
      setSaved(false);
      setValues((existing) => ({ ...existing, [key]: event.target.value }));
    },
  });

  // Server-confirmed records always reach the list; drawer state is only touched while this student is shown.
  const accept = (updated) => {
    onUpdated(updated);
    if (live.current) setState({ id, status: "ready", student: updated, error: null });
    return updated;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const updated = accept(await updateStudent(id, Object.fromEntries(dirty.map((key) => [key, values[key]]))));
      if (!live.current) return;
      setValues(toValues(updated));
      setSaved(true);
    } catch (error) {
      if (live.current) setSaveError(error);
    } finally {
      if (live.current) setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    setToggleError(null);
    try {
      accept(await setStudentActive(id, !student.is_active));
      if (live.current) setConfirming(false);
    } catch (error) {
      if (live.current) setToggleError(error);
    } finally {
      if (live.current) setToggling(false);
    }
  };

  const title = student ? fullName(student) : "Student details";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close details" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <aside ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="student-drawer-title" className="relative w-full max-w-md h-full overflow-y-auto bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="student-drawer-title" ref={headingRef} tabIndex={-1} className="text-xl font-bold text-gray-900 break-words focus:outline-none">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {current.status === "loading" && (
          <p role="status" className="mt-6 flex items-center gap-2 text-sm text-gray-600">
            <Spinner className="h-4 w-4 text-gray-500" /> Loading student...
          </p>
        )}

        {current.status === "error" && (
          <div className="mt-6 space-y-3">
            <FormAlert>{current.error.status === 404 ? "This student could not be found." : current.error.message}</FormAlert>
            {current.error.status !== 404 && (
              <button type="button" onClick={() => { setState({ id, status: "loading", student: null, error: null }); setReloads((n) => n + 1); }} className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm">
                Try again
              </button>
            )}
          </div>
        )}

        {current.status === "ready" && (
          <div className="mt-4 space-y-5">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <StatusBadge active={student.is_active} />
              {student.date_joined && <span>{`Joined ${formatJoined(student.date_joined)}`}</span>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <FormAlert>{message}</FormAlert>
              {saved && <FormNotice>Changes saved.</FormNotice>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField label="First name" name="first_name" errors={fields.first_name} {...bind("first_name")} />
                <TextField label="Last name" name="last_name" errors={fields.last_name} {...bind("last_name")} />
              </div>
              <TextField label="Email" type="email" name="email" errors={fields.email} {...bind("email")} />
              <TextField label="Matric number" name="matric_number" errors={fields.matric_number} {...bind("matric_number")} />
              <TextField label="Department" name="department" errors={fields.department} {...bind("department")} />
              <SelectField label="Level" name="level" placeholder="Not set" options={LEVELS} errors={fields.level} {...bind("level")} />
              <SubmitButton loading={saving} loadingLabel="Saving..." disabled={dirty.length === 0}>Save changes</SubmitButton>
            </form>

            <section className="border-t border-gray-200 pt-4 space-y-3" aria-label="Account status">
              {!confirming && (
                <button
                  ref={statusButtonRef}
                  type="button"
                  onClick={() => { setToggleError(null); setConfirming(true); }}
                  className={`w-full rounded-lg px-4 py-3 text-sm font-medium border ${student.is_active ? "border-red-300 text-red-700 hover:bg-red-50" : "border-green-300 text-green-700 hover:bg-green-50"}`}
                >
                  {student.is_active ? "Deactivate account" : "Activate account"}
                </button>
              )}
              {confirming && (
                <div role="alertdialog" aria-labelledby="status-confirm-title" className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p id="status-confirm-title" className="text-sm text-gray-800">
                    {student.is_active
                      ? `Deactivate ${fullName(student)}? They will no longer be able to sign in.`
                      : `Activate ${fullName(student)}? They will be able to sign in again.`}
                  </p>
                  <FormAlert>{toggleError?.message}</FormAlert>
                  <div className="flex gap-2">
                    <button ref={confirmRef} type="button" disabled={toggling} onClick={handleToggle} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-70 ${student.is_active ? "bg-red-600" : "bg-[#2A742F]"}`}>
                      {toggling ? "Working..." : student.is_active ? "Confirm deactivate" : "Confirm activate"}
                    </button>
                    <button type="button" disabled={toggling} onClick={() => { setConfirming(false); setToggleError(null); }} className="flex-1 rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};

export default StudentDetailDrawer;
