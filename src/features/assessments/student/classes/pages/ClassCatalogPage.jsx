import { Link, useSearchParams } from "react-router-dom";
import { listClasses, describeClassError } from "../api/classesApi.js";
import Pager from "../../components/Pager.jsx";
import { EmptyState, ErrorPanel, Loading, Page } from "../../components/StateBlocks.jsx";
import { useLoad } from "../../hooks/useLoad.js";
import { cardClass, headingClass, mutedClass, pageFromParams, primaryButton } from "../../lib/ui.js";

/** /dawah/classes — published Arabic classes. */
export default function ClassCatalogPage() {
  const [params, setParams] = useSearchParams();
  const page = pageFromParams(params);
  const { loading, data, error, reload } = useLoad(() => listClasses({ page }), `page-${page}`);

  if (loading) return <Page><Loading label="Loading classes…" /></Page>;
  if (error) return <Page><ErrorPanel error={error} message={describeClassError(error)} onRetry={reload} title="We couldn't load classes" /></Page>;

  return (
    <Page>
      <section className={cardClass}>
        <h1 className={headingClass}>Arabic classes</h1>
        <p className={`${mutedClass} mt-1`}>Enroll in a class to read its modules. Linked quizzes are listed in each module.</p>
      </section>
      {data.results.length === 0 ? (
        <EmptyState title="No classes are open right now">Published Arabic classes will appear here.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.results.map((klass) => (
            <li key={klass.id} className={`${cardClass} !py-5`}>
              <p className={mutedClass}>{klass.code}</p>
              <h2 className="text-lg font-semibold text-[#1F2937] dark:text-white break-words">{klass.title}</h2>
              {klass.description && <p className={`${mutedClass} mt-1 break-words`}>{klass.description}</p>}
              <Link to={`/dawah/classes/${klass.id}`} className={`${primaryButton} mt-4`} aria-label={`View ${klass.title}`}>
                View class
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        hasNext={Boolean(data.next)}
        hasPrevious={Boolean(data.previous) || page > 1}
        onPage={(next) => setParams(next > 1 ? { page: String(next) } : {})}
      />
    </Page>
  );
}
