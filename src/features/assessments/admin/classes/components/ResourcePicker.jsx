import { useCallback, useEffect, useRef, useState } from "react";
import { inputClass, primaryButton, secondaryButton } from "../../components/styles.js";
import { Alert, FieldError, LoadingBlock, Pager } from "../../components/ui.jsx";
import { describeClassError } from "../classErrors.js";
import { TYPE_LABELS } from "../classRules.js";
import { searchResources } from "../classService.js";

const PAGE_SIZE = 10;

/**
 * Attach published event resources to a module by ID (D3: validated resource IDs, never arbitrary
 * URLs). Candidates come only from the D2 archive, which lists published, locally visible resources;
 * the server still validates every ID on save.
 */
export default function ResourcePicker({ selected, onChange, disabled, error, hiddenCount = 0 }) {
  const [term, setTerm] = useState("");
  const [type, setType] = useState("");
  const [applied, setApplied] = useState({ search: "", type: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const token = ++latest.current;
    setLoading(true);
    setFailure(null);
    try {
      const loaded = await searchResources({ ...applied, page, pageSize: PAGE_SIZE });
      if (token === latest.current) setData(loaded);
    } catch (problem) {
      if (token === latest.current) setFailure(describeClassError(problem).message);
    } finally {
      if (token === latest.current) setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    if (!disabled) load();
  }, [load, disabled]);

  const chosen = new Set(selected.map((resource) => resource.id));
  const add = (resource) => onChange([...selected, resource]);
  const remove = (id) => onChange(selected.filter((resource) => resource.id !== id));
  const label = (resource) => `${resource.title}${resource.type ? ` (${TYPE_LABELS[resource.type] ?? resource.type})` : ""}`;

  return (
    <fieldset className="space-y-4" aria-describedby={error ? "resource-ids-error" : undefined}>
      <legend className="mb-2 text-sm font-medium text-gray-700">Attached resources</legend>
      {selected.length === 0 ? (
        <p className="text-sm text-gray-500">No resources attached.</p>
      ) : (
        <ul aria-label="Attached resources" className="space-y-2">
          {selected.map((resource) => (
            <li key={resource.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <span>
                {label(resource)}
                {resource.eventTitle && <span className="block text-xs text-gray-500">{resource.eventTitle}</span>}
              </span>
              <button type="button" className={secondaryButton} disabled={disabled} onClick={() => remove(resource.id)} aria-label={`Remove ${resource.title}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <Alert tone="info">
          {hiddenCount} attached {hiddenCount === 1 ? "resource is" : "resources are"} currently hidden (not published) and not shown here. {hiddenCount === 1 ? "It stays" : "They stay"} attached when you save.
        </Alert>
      )}
      <FieldError id="resource-ids-error">{error}</FieldError>

      {!disabled && (
        <div className="space-y-3 rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700">Add a published resource</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              aria-label="Search resources"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setPage(1);
                  setApplied({ search: term.trim(), type });
                }
              }}
              placeholder="Search by title"
              className={inputClass(false)}
            />
            <select aria-label="Resource type" value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A742F]">
              <option value="">All types</option>
              {Object.entries(TYPE_LABELS).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={primaryButton}
              onClick={() => {
                setPage(1);
                setApplied({ search: term.trim(), type });
              }}
            >
              Search resources
            </button>
          </div>
          {failure && (
            <Alert>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{failure}</span>
                <button type="button" className={secondaryButton} onClick={load}>
                  Try again
                </button>
              </div>
            </Alert>
          )}
          {loading && <LoadingBlock label="Loading resources..." />}
          {!loading && !failure && data && data.results.length === 0 && <p className="text-sm text-gray-500">No published resources match.</p>}
          {!loading && !failure && data && data.results.length > 0 && (
            <>
              <ul aria-label="Available resources" className="space-y-2">
                {data.results.map((resource) => (
                  <li key={resource.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <span>
                      {label(resource)}
                      {resource.eventTitle && <span className="block text-xs text-gray-500">{resource.eventTitle}</span>}
                    </span>
                    <button type="button" className={secondaryButton} disabled={chosen.has(resource.id)} onClick={() => add(resource)} aria-label={`Attach ${resource.title}`}>
                      {chosen.has(resource.id) ? "Attached" : "Attach"}
                    </button>
                  </li>
                ))}
              </ul>
              <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={setPage} />
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}
