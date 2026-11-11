import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { formatLagos } from "../../dates.js";
import { inputClass, primaryButton, secondaryButton } from "../../components/styles.js";
import { Alert, ConfirmDialog, FieldError } from "../../components/ui.jsx";
import ClassFrame from "../components/ClassFrame.jsx";
import { useClassRecord } from "../useClassRecord.js";
import { describeClassError } from "../classErrors.js";
import { validateClassForm } from "../classRules.js";
import { buildClassPayload, closeClass, createClass, deleteClass, publishClass, updateClass } from "../classService.js";

const FIELDS = ["code", "title", "description"];

/** Keyed by id so moving between classes never carries state over. */
export default function ClassEditorPage() {
  const { id } = useParams();
  return id === undefined ? <NewClass /> : <EditClass key={id} id={id} />;
}

function ClassForm({ initial, disabled, submitLabel, onSubmit, onFailure }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [problem, setProblem] = useState(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  async function submit(event) {
    event.preventDefault();
    setProblem(null);
    const found = validateClassForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const next = await onSubmit(form);
      if (next) setForm(next);
    } catch (error) {
      const described = describeClassError(error, FIELDS);
      setProblem(described.message);
      setErrors(described.fields);
      onFailure?.(described);
    } finally {
      setSaving(false);
    }
  }

  const text = (name) => (Array.isArray(errors[name]) ? errors[name].join(" ") : errors[name]);
  const props = (name) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `class-${name}-error` : undefined });

  return (
    <form noValidate onSubmit={submit} aria-label="Class details" className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
      <h2 className="text-xl font-semibold text-[#111827]">Class details</h2>
      {problem && <Alert>{problem}</Alert>}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div>
          <label htmlFor="class-code" className="mb-2 block text-sm font-medium text-gray-700">
            Code
          </label>
          <input id="class-code" value={form.code} disabled={disabled} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass(errors.code)} {...props("code")} />
          <FieldError id="class-code-error">{text("code")}</FieldError>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="class-title" className="mb-2 block text-sm font-medium text-gray-700">
            Title
          </label>
          <input id="class-title" value={form.title} disabled={disabled} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass(errors.title)} {...props("title")} />
          <FieldError id="class-title-error">{text("title")}</FieldError>
        </div>
        <div className="md:col-span-3">
          <label htmlFor="class-description" className="mb-2 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="class-description"
            rows={4}
            value={form.description}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={`${inputClass(errors.description)} resize-none`}
            {...props("description")}
          />
          <FieldError id="class-description-error">{text("description")}</FieldError>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button type="submit" className={primaryButton} disabled={saving || disabled || (initial.id !== undefined && !dirty)}>
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

const blank = { code: "", title: "", description: "" };

function NewClass() {
  const navigate = useNavigate();
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-800 lg:text-3xl">New Arabic class</h1>
        <Link to="/admin/classes" className={`${secondaryButton} text-center`}>
          All classes
        </Link>
      </div>
      <Alert tone="info">The class is saved as a draft. Students cannot see or join it until you publish it.</Alert>
      <ClassForm
        initial={blank}
        submitLabel="Save draft class"
        onSubmit={async (form) => {
          const created = await createClass(buildClassPayload(form));
          navigate(`/admin/classes/${created.id}`, { replace: true, state: { notice: "Draft class saved. You can now add modules." } });
        }}
      />
    </section>
  );
}

function EditClass({ id }) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useClassRecord(id);
  const { record, reload } = state;
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [problem, setProblem] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'publish' | 'close' | 'delete'
  const [busy, setBusy] = useState(false);

  async function runConfirmed() {
    setBusy(true);
    const action = confirm;
    try {
      if (action === "publish") {
        await publishClass(id);
        setNotice("Class published. Students can now see it and enroll.");
      } else if (action === "close") {
        await closeClass(id);
        setNotice("Class closed. New enrollment is blocked and module access is hidden; history is kept.");
      } else {
        await deleteClass(id);
        navigate("/admin/classes", { replace: true, state: { notice: "Draft class deleted." } });
        return;
      }
      setProblem(null);
      await reload();
    } catch (error) {
      const described = describeClassError(error);
      setProblem(described.message);
      setNotice(null);
      if (described.conflict || described.gone) await reload();
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const editable = record && !record.legacy && record.status !== "closed";
  return (
    <ClassFrame id={id} state={state}>
      {record && (
        <>
          {notice && <Alert tone="success">{notice}</Alert>}
          {problem && <Alert>{problem}</Alert>}
          {record.status === "closed" && !record.legacy && <Alert tone="info">This class is closed. Its details are locked; the roster and modules remain available for review.</Alert>}
          <ClassForm
            initial={{ id: record.id, code: record.code, title: record.title, description: record.description }}
            disabled={!editable}
            submitLabel="Save details"
            onSubmit={async (form) => {
              await updateClass(id, buildClassPayload(form));
              setProblem(null);
              setNotice("Class details saved.");
              await reload();
              return null;
            }}
            onFailure={(described) => {
              setNotice(null);
              if (described.conflict || described.gone) reload();
            }}
          />
          {!record.legacy && (
            <section aria-label="Lifecycle" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-xl font-semibold text-gray-800">Publication</h2>
              {record.createdAt && <p className="text-sm text-gray-500">Created {formatLagos(record.createdAt)}.</p>}
              {record.status === "draft" && (
                <>
                  <p className="text-sm text-gray-600">Publishing lists the class in the student catalog and lets students enroll themselves. Modules are published separately.</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button type="button" className={secondaryButton} onClick={() => setConfirm("delete")}>
                      Delete draft class
                    </button>
                    <button type="button" className={primaryButton} onClick={() => setConfirm("publish")}>
                      Publish class
                    </button>
                  </div>
                </>
              )}
              {record.status === "published" && (
                <>
                  <p className="text-sm text-gray-600">
                    Closing blocks new enrollment and hides module access from students. Enrollment history and submissions remain retrievable. A published class cannot be deleted.
                  </p>
                  <div className="flex justify-end">
                    <button type="button" className={secondaryButton} onClick={() => setConfirm("close")}>
                      Close class
                    </button>
                  </div>
                </>
              )}
              {record.status === "closed" && <p className="text-sm text-gray-600">This class is closed and cannot be reopened in this release.</p>}
            </section>
          )}
          {confirm === "publish" && (
            <ConfirmDialog title="Publish this class?" confirmLabel="Publish class" busy={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>
              <p>
                {record.code}: {record.title}
              </p>
              <p>Students will be able to see this class and enroll themselves.</p>
            </ConfirmDialog>
          )}
          {confirm === "close" && (
            <ConfirmDialog title="Close this class?" confirmLabel="Close class" tone="danger" busy={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>
              <p>New enrollment stops and students lose module access. History and submissions are kept.</p>
              <p>There is no reopen action in this release.</p>
            </ConfirmDialog>
          )}
          {confirm === "delete" && (
            <ConfirmDialog title="Delete this draft class?" confirmLabel="Delete draft class" tone="danger" busy={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>
              <p>The draft is removed permanently. A class that modules, enrollments or quizzes reference cannot be deleted; the server will refuse it.</p>
            </ConfirmDialog>
          )}
        </>
      )}
    </ClassFrame>
  );
}
