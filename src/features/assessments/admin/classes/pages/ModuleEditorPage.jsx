import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { inputClass, primaryButton, secondaryButton } from "../../components/styles.js";
import { Alert, FieldError, LoadingBlock, StatusBadge } from "../../components/ui.jsx";
import ClassFrame from "../components/ClassFrame.jsx";
import { useClassRecord } from "../useClassRecord.js";
import ResourcePicker from "../components/ResourcePicker.jsx";
import { describeClassError } from "../classErrors.js";
import { validateModuleForm } from "../classRules.js";
import { buildModulePayload, createModule, getModule, listModules, updateModule } from "../classService.js";

const FIELDS = ["title", "body", "order", "resource_ids"];

export default function ModuleEditorPage() {
  const { id, moduleId } = useParams();
  return <ModuleEditor key={`${id}/${moduleId ?? "new"}`} id={id} moduleId={moduleId} />;
}

function ModuleEditor({ id, moduleId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useClassRecord(id);
  const { record } = state;
  const isNew = moduleId === undefined;
  const [module, setModule] = useState(null);
  const [form, setForm] = useState({ title: "", body: "", order: "" });
  const [resources, setResources] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [problem, setProblem] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const adopt = (loaded) => {
    const next = { title: loaded.title, body: loaded.body, order: String(loaded.order) };
    setModule(loaded);
    setForm(next);
    setResources(loaded.resources);
    setBaseline(JSON.stringify([next, loaded.resources.map((r) => r.id)]));
  };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (isNew) {
          // New modules default to the end of the current order.
          const existing = await listModules(id);
          if (live) {
            const next = { title: "", body: "", order: String(Math.max(0, ...existing.map((m) => m.order)) + 1) };
            setForm(next);
            setBaseline(JSON.stringify([next, []]));
          }
        } else if (live) {
          adopt(await getModule(id, moduleId));
        }
      } catch (failure) {
        if (live) setLoadError(describeClassError(failure).message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, moduleId, isNew]);

  const current = JSON.stringify([form, resources.map((r) => r.id)]);
  const dirty = baseline !== null && current !== baseline;

  async function submit(event) {
    event.preventDefault();
    setNotice(null);
    setProblem(null);
    const found = validateModuleForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    const payload = buildModulePayload({
      title: form.title,
      body: form.body,
      order: Number(form.order),
      resourceIds: [...resources.map((r) => r.id), ...(module?.hiddenResourceIds ?? [])],
    });
    setSaving(true);
    try {
      if (isNew) {
        const created = await createModule(id, payload);
        navigate(`/admin/classes/${id}/modules/${created.id}`, { replace: true, state: { notice: "Module saved as a draft." } });
        return;
      }
      await updateModule(id, moduleId, payload);
      adopt(await getModule(id, moduleId));
      setNotice("Module saved.");
    } catch (failure) {
      const described = describeClassError(failure, FIELDS);
      setProblem(described.message);
      setErrors(described.fields);
      // Stale view: show the persisted module in the badge/resources note, but keep the typed edits.
      if (!isNew && (described.conflict || described.gone)) {
        try {
          setModule(await getModule(id, moduleId));
        } catch {
          /* the message above already explains */
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const text = (name) => (Array.isArray(errors[name]) ? errors[name].join(" ") : errors[name]);
  const props = (name) => ({ "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `module-${name}-error` : undefined });
  const editable = record && !record.legacy && record.status !== "closed";

  return (
    <ClassFrame id={id} state={state}>
      {record && (
        <section aria-label="Module editor" className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-800">{isNew ? "New module" : module?.title || "Module"}</h2>
              {module && <StatusBadge status={module.status} />}
            </div>
            <Link to={`/admin/classes/${id}/modules`} className={`${secondaryButton} text-center`}>
              Back to modules
            </Link>
          </div>
          {loading && <LoadingBlock label="Loading module..." />}
          {loadError && <Alert>{loadError}</Alert>}
          {!loading && !loadError && (
            <form noValidate onSubmit={submit} aria-label="Module details" className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              {!editable && <Alert tone="info">This class is closed or read-only, so the module cannot be changed.</Alert>}
              {notice && <Alert tone="success">{notice}</Alert>}
              {problem && <Alert>{problem}</Alert>}
              {isNew && <Alert tone="info">New modules are saved as drafts. Publish a module from the module list when it is ready.</Alert>}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                <div className="md:col-span-3">
                  <label htmlFor="module-title" className="mb-2 block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <input id="module-title" value={form.title} disabled={!editable} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass(errors.title)} {...props("title")} />
                  <FieldError id="module-title-error">{text("title")}</FieldError>
                </div>
                <div>
                  <label htmlFor="module-order" className="mb-2 block text-sm font-medium text-gray-700">
                    Order
                  </label>
                  <input id="module-order" inputMode="numeric" value={form.order} disabled={!editable} onChange={(e) => setForm({ ...form, order: e.target.value })} className={inputClass(errors.order)} {...props("order")} />
                  <FieldError id="module-order-error">{text("order")}</FieldError>
                </div>
                <div className="md:col-span-4">
                  <label htmlFor="module-body" className="mb-2 block text-sm font-medium text-gray-700">
                    Lesson text (plain text)
                  </label>
                  <textarea id="module-body" rows={10} value={form.body} disabled={!editable} onChange={(e) => setForm({ ...form, body: e.target.value })} className={inputClass(errors.body)} {...props("body")} />
                  <FieldError id="module-body-error">{text("body")}</FieldError>
                </div>
              </div>
              <ResourcePicker selected={resources} onChange={setResources} disabled={!editable} error={text("resource_ids")} hiddenCount={module?.hiddenResourceIds.length ?? 0} />
              {module && module.quizzes.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-gray-700">Associated quizzes</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {module.quizzes.map((quiz) => (
                      <li key={quiz.id}>
                        <Link to={`/admin/quizzes/${quiz.id}`} className="text-[#2A742F] underline">
                          {quiz.title}
                        </Link>{" "}
                        {quiz.status && <span className="text-gray-500">({quiz.status})</span>}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs text-gray-500">Quizzes are linked to a class from the quiz draft, not from here.</p>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="submit" className={primaryButton} disabled={saving || !editable || (!isNew && !dirty)}>
                  {saving ? "Saving..." : isNew ? "Save draft module" : "Save module"}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </ClassFrame>
  );
}
