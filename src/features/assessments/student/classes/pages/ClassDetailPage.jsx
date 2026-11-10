import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { accessState, canReadModules, describeClassError, enroll, getClass, getEnrollment, listModules, withdraw } from "../api/classesApi.js";
import AccessNotice from "../components/AccessNotice.jsx";
import { ErrorPanel, Loading, Page } from "../../components/StateBlocks.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { cardClass, headingClass, mutedClass, primaryButton, secondaryButton } from "../../lib/ui.js";

async function loadClassView(id) {
  const [klass, enrollment] = await Promise.all([getClass(id), getEnrollment(id)]);
  // Modules are requested only for an active enrollment in a published class.
  if (!canReadModules(klass, enrollment)) return { klass, enrollment, modules: null, modulesError: null };
  try {
    return { klass, enrollment, modules: await listModules(id), modulesError: null };
  } catch (modulesError) {
    return { klass, enrollment, modules: null, modulesError };
  }
}

/** /dawah/classes/:id — class info, enrollment actions, and (when enrolled) the ordered modules. */
export default function ClassDetailPage() {
  const { id } = useParams();
  const { loading, data, error, reload } = useLoad(() => loadClassView(id), id);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  if (loading) return <Page><Loading label="Loading class…" /></Page>;
  if (error) {
    const hidden = error.status === 404 || error.status === 403;
    return (
      <Page>
        <ErrorPanel error={{ ...error, message: describeClassError(error) }} onRetry={hidden ? undefined : reload} title="We couldn't load this class" />
        <Link to="/dawah/classes" className={secondaryButton}>Back to classes</Link>
      </Page>
    );
  }

  const { klass, enrollment, modules, modulesError } = data;
  const state = accessState(klass, enrollment);

  const run = async (action, success) => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      // 409: the class changed under us (e.g. closed). Show the server's reason and refresh the real state.
      setActionError(caught.status === 409 ? caught.message || "This class is no longer open for enrollment." : describeClassError(caught));
    } finally {
      setConfirming(false);
      setBusy(false);
      reload();
    }
  };

  return (
    <Page>
      <section className={cardClass}>
        <p className={mutedClass}>{klass.code}</p>
        <h1 className={`${headingClass} break-words`}>{klass.title}</h1>
        {klass.description && <p className="mt-2 text-[#4B5563] dark:text-gray-300 whitespace-pre-wrap break-words">{klass.description}</p>}
        <p className="mt-4 text-sm font-medium text-[#1F2937] dark:text-white" data-testid="enrollment-state">
          {state === "open" && "You are enrolled."}
          {state === "not_enrolled" && "You are not enrolled."}
          {state === "withdrawn" && "You have withdrawn from this class."}
          {state === "closed" && "This class is closed."}
          {state === "unavailable" && "This class is not available."}
        </p>
        {notice && <p role="status" className="mt-2 text-sm text-[#2A742F] dark:text-green-300">{notice}</p>}
        {actionError && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{actionError}</p>}

        <div className="mt-4 flex flex-wrap gap-3">
          {(state === "not_enrolled" || state === "withdrawn") && (
            <button type="button" className={primaryButton} disabled={busy} onClick={() => run(() => enroll(klass.id), state === "withdrawn" ? "Welcome back. Your modules are available again." : "Enrollment saved. The modules are now available.")}>
              {busy ? "Working…" : state === "withdrawn" ? "Re-enroll" : "Enroll"}
            </button>
          )}
          {state === "open" && !confirming && (
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => setConfirming(true)}>
              Withdraw
            </button>
          )}
          <Link to="/dawah/classes" className={secondaryButton}>All classes</Link>
        </div>

        {state === "open" && confirming && (
          <div role="alertdialog" aria-labelledby="withdraw-title" aria-describedby="withdraw-desc" className="mt-4 rounded-lg border border-amber-400 p-4">
            <h2 id="withdraw-title" className="font-semibold text-[#1F2937] dark:text-white">Withdraw from this class?</h2>
            <p id="withdraw-desc" className="mt-1 text-sm text-[#4B5563] dark:text-gray-300">
              You will lose access to its modules until you re-enroll. Your quiz attempts and results are kept.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={primaryButton} disabled={busy} onClick={() => run(() => withdraw(klass.id), "Withdrawal saved. Your quiz results are kept.")}>
                {busy ? "Working…" : "Yes, withdraw"}
              </button>
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => setConfirming(false)}>
                Keep my enrollment
              </button>
            </div>
          </div>
        )}
      </section>

      {state === "open" ? (
        <section className={cardClass} aria-labelledby="modules-title">
          <h2 id="modules-title" className="text-lg font-semibold text-[#1F2937] dark:text-white">Modules</h2>
          {modulesError ? (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
              {describeClassError(modulesError)}{" "}
              <button type="button" className="underline" onClick={reload}>Try again</button>
            </p>
          ) : modules.length === 0 ? (
            <p className="mt-2 text-sm text-[#4B5563] dark:text-gray-300">No modules have been published for this class yet.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {modules.map((module) => (
                <li key={module.id}>
                  <Link to={`/dawah/classes/${klass.id}/modules/${module.id}`} className="block rounded-lg border border-gray-200 px-4 py-3 text-[#2A742F] underline dark:border-gray-700 dark:text-green-300 break-words">
                    {module.title}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : (
        state !== "not_enrolled" && <AccessNotice state={state} classId={klass.id} />
      )}
    </Page>
  );
}
