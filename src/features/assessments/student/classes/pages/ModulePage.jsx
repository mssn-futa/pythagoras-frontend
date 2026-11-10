import { Link, useParams } from "react-router-dom";
import { ResourceRenderer } from "../../../../dawah/public";
import { accessState, canReadModules, describeClassError, getClass, getEnrollment, getModule, listModules } from "../api/classesApi.js";
import AccessNotice from "../components/AccessNotice.jsx";
import { ErrorPanel, Loading, Page } from "../../components/StateBlocks.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { cardClass, headingClass, mutedClass, secondaryButton } from "../../lib/ui.js";

async function loadModuleView(classId, moduleId) {
  const [klass, enrollment] = await Promise.all([getClass(classId), getEnrollment(classId)]);
  // Gate first: no module request unless the class is published and the enrollment active.
  if (!canReadModules(klass, enrollment)) return { klass, enrollment, module: null, modules: [] };
  const [module, modules] = await Promise.all([getModule(classId, moduleId), listModules(classId)]);
  return { klass, enrollment, module, modules };
}

/** /dawah/classes/:id/modules/:moduleId — the module reading view. */
export default function ModulePage() {
  const { id, moduleId } = useParams();
  const { loading, data, error, reload } = useLoad(() => loadModuleView(id, moduleId), `${id}/${moduleId}`);
  const back = (
    <Link to={`/dawah/classes/${id}`} className={secondaryButton}>
      Back to the class
    </Link>
  );

  if (loading) return <Page><Loading label="Loading module…" /></Page>;
  if (error) {
    const hidden = error.status === 404 || error.status === 403;
    return (
      <Page>
        <ErrorPanel error={{ ...error, message: describeClassError(error) }} onRetry={hidden ? undefined : reload} title="We couldn't load this module" />
        {back}
      </Page>
    );
  }

  const { klass, enrollment, module, modules } = data;
  if (!module) {
    return (
      <Page>
        <section className={cardClass}>
          <h1 className={headingClass}>{klass.title}</h1>
        </section>
        <AccessNotice state={accessState(klass, enrollment)} classId={klass.id} showClassLink />
      </Page>
    );
  }

  const index = modules.findIndex((item) => item.id === module.id);
  const previous = index > 0 ? modules[index - 1] : null;
  const next = index >= 0 && index < modules.length - 1 ? modules[index + 1] : null;

  return (
    <Page>
      <article className={cardClass}>
        <p className={mutedClass}>
          <Link to={`/dawah/classes/${klass.id}`} className="underline">{klass.title}</Link>
          {index >= 0 && ` · Module ${index + 1} of ${modules.length}`}
        </p>
        <h1 className={`${headingClass} mt-1 break-words`}>{module.title}</h1>
        {module.body && (
          <div data-testid="module-body" className="mt-4 whitespace-pre-wrap break-words leading-relaxed text-[#1F2937] dark:text-gray-100">
            {module.body}
          </div>
        )}
      </article>

      {module.resources.length > 0 && (
        <section className={cardClass} aria-labelledby="resources-title">
          <h2 id="resources-title" className="text-lg font-semibold text-[#1F2937] dark:text-white">Resources</h2>
          <ul className="mt-3 space-y-5">
            {module.resources.map((resource) => (
              <li key={resource.id}>
                <h3 className="mb-2 font-medium text-[#1F2937] dark:text-white break-words">{resource.title}</h3>
                <ResourceRenderer resource={resource} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={cardClass} aria-labelledby="quizzes-title">
        <h2 id="quizzes-title" className="text-lg font-semibold text-[#1F2937] dark:text-white">Related quizzes</h2>
        {module.quizzes.length === 0 ? (
          <p className="mt-2 text-sm text-[#4B5563] dark:text-gray-300">No quizzes are linked to this module.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {module.quizzes.map((quiz) => (
              <li key={quiz.id} className="break-words">
                {quiz.status === "published" ? (
                  <Link to={`/dawah/quizzes/${quiz.id}`} className="text-[#2A742F] underline dark:text-green-300">{quiz.title}</Link>
                ) : (
                  <span className="text-[#6B7280] dark:text-gray-400">{quiz.title} (not open)</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <Link to="/profile/results" className="underline text-[#2A742F] dark:text-green-300">View my results</Link>
        </p>
      </section>

      <nav aria-label="Module navigation" className="flex flex-wrap items-center justify-between gap-3">
        {previous ? <Link to={`/dawah/classes/${klass.id}/modules/${previous.id}`} className={secondaryButton}>Previous: {previous.title}</Link> : <span />}
        {next ? <Link to={`/dawah/classes/${klass.id}/modules/${next.id}`} className={secondaryButton}>Next: {next.title}</Link> : back}
      </nav>
    </Page>
  );
}
