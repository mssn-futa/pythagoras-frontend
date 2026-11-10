import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { primaryButton, secondaryButton } from "../../components/styles.js";
import { Alert, ConfirmDialog, LoadingBlock, StatusBadge } from "../../components/ui.jsx";
import ClassFrame from "../components/ClassFrame.jsx";
import { useClassRecord } from "../useClassRecord.js";
import { describeClassError } from "../classErrors.js";
import { moveItem } from "../classRules.js";
import { deleteModule, listModules, publishModule, reorderModules, unpublishModule } from "../classService.js";

export default function ModuleListPage() {
  const { id } = useParams();
  return <Modules key={id} id={id} />;
}

function Modules({ id }) {
  const location = useLocation();
  const state = useClassRecord(id);
  const { record } = state;
  const [modules, setModules] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // module to delete
  const [focusTarget, setFocusTarget] = useState(null); // { id, dir } to restore after a reorder
  const latest = useRef(0);

  const load = useCallback(async () => {
    const token = ++latest.current;
    try {
      const loaded = await listModules(id);
      if (token === latest.current) {
        setModules(loaded);
        setLoadError(null);
      }
    } catch (failure) {
      if (token === latest.current) setLoadError(describeClassError(failure).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(work, success) {
    setBusy(true);
    setProblem(null);
    try {
      await work();
      setNotice(success);
    } catch (failure) {
      setProblem(failure?.described ?? describeClassError(failure).message);
      setNotice(null);
    } finally {
      // Whatever happened, show the persisted state rather than a guess.
      await load();
      setBusy(false);
    }
  }

  const move = async (index, delta) => {
    const moved = modules[index];
    const next = moveItem(modules, index, delta);
    await run(
      () =>
        reorderModules(
          id,
          next.map((module) => module.id),
        ).catch((failure) => {
          const described = describeClassError(failure);
          throw Object.assign(new Error(), { described: `The new order could not be saved, so nothing changed. The list shows the current saved order. ${described.message}` });
        }),
      "Module order saved.",
    );
    setFocusTarget({ id: moved.id, dir: delta < 0 ? "up" : "down" });
  };
  const toggle = (module) =>
    run(
      () => (module.status === "published" ? unpublishModule(id, module.id) : publishModule(id, module.id)),
      module.status === "published" ? `"${module.title}" unpublished. Students no longer see it.` : `"${module.title}" published. Enrolled students can now read it.`,
    );
  const remove = async () => {
    const module = confirm;
    await run(() => deleteModule(id, module.id), `"${module.title}" deleted.`);
    setConfirm(null);
  };

  // Keep keyboard focus on the moved module's button (the list re-renders after the reload).
  useLayoutEffect(() => {
    if (!focusTarget || !modules) return;
    const pick = (dir) => document.querySelector(`[data-move="${focusTarget.id}-${dir}"]:not([disabled])`);
    (pick(focusTarget.dir) ?? pick(focusTarget.dir === "up" ? "down" : "up"))?.focus();
    setFocusTarget(null);
  }, [focusTarget, modules]);

  const manageable = record && !record.legacy && record.status !== "closed";

  return (
    <ClassFrame id={id} state={state}>
      {record && (
        <section aria-label="Modules" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Modules{modules ? ` (${modules.length})` : ""}</h2>
            {manageable && (
              <Link to={`/admin/classes/${id}/modules/new`} className={`${primaryButton} text-center`}>
                Add module
              </Link>
            )}
          </div>
          {record.status === "closed" && <Alert tone="info">This class is closed, so modules are read-only and hidden from students.</Alert>}
          {record.status === "draft" && <Alert tone="info">This class is a draft. Students cannot see its modules until the class is published.</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}
          {problem && <Alert>{problem}</Alert>}
          {loadError && (
            <Alert>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{loadError}</span>
                <button type="button" className={secondaryButton} onClick={load}>
                  Try again
                </button>
              </div>
            </Alert>
          )}
          {!modules && !loadError && <LoadingBlock label="Loading modules..." />}
          {modules && modules.length === 0 && <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">No modules yet.</p>}
          {modules && modules.length > 0 && (
            <ol className="space-y-3">
              {modules.map((module, index) => (
                <li key={module.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-gray-800">
                        {index + 1}. {module.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {module.resources.length + module.hiddenResourceIds.length} {module.resources.length + module.hiddenResourceIds.length === 1 ? "resource" : "resources"}
                        {module.quizzes.length > 0 && ` · ${module.quizzes.length} ${module.quizzes.length === 1 ? "quiz" : "quizzes"}`}
                      </p>
                    </div>
                    <StatusBadge status={module.status} />
                  </div>
                  {manageable && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button type="button" className={secondaryButton} data-move={`${module.id}-up`} disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${module.title} up`}>
                        Move up
                      </button>
                      <button type="button" className={secondaryButton} data-move={`${module.id}-down`} disabled={busy || index === modules.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${module.title} down`}>
                        Move down
                      </button>
                      <Link to={`/admin/classes/${id}/modules/${module.id}`} className={`${secondaryButton} text-center`} aria-label={`Edit ${module.title}`}>
                        Edit
                      </Link>
                      {module.status && (
                        <button type="button" className={secondaryButton} disabled={busy} onClick={() => toggle(module)} aria-label={`${module.status === "published" ? "Unpublish" : "Publish"} ${module.title}`}>
                          {module.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                      )}
                      {module.status === "draft" && (
                        <button type="button" className={secondaryButton} disabled={busy} onClick={() => setConfirm(module)} aria-label={`Delete ${module.title}`}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
          {confirm && (
            <ConfirmDialog title="Delete this module?" confirmLabel="Delete module" tone="danger" busy={busy} onConfirm={remove} onCancel={() => setConfirm(null)}>
              <p>{confirm.title}</p>
              <p>Only unreferenced draft modules can be deleted. To hide a published module, unpublish it instead.</p>
            </ConfirmDialog>
          )}
        </section>
      )}
    </ClassFrame>
  );
}
