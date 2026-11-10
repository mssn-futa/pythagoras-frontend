import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FormAlert } from "../../../features/auth/components/FormControls.jsx";
import Spinner from "../../../features/auth/components/Spinner.jsx";
import { listStudents } from "../../../services/api/studentService.js";
import Pagination from "./Pagination.jsx";
import StudentDetailDrawer from "./StudentDetailDrawer.jsx";
import StudentFilters from "./StudentFilters.jsx";
import StudentTable from "./StudentTable.jsx";
import { PAGE_SIZE, readQuery, writeQuery } from "./studentQuery.js";

const SEARCH_DEBOUNCE_MS = 300;

/** /admin/students — real, paginated student administration. URL query is the source of truth. */
const StudentDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => readQuery(searchParams), [searchParams]);
  const { search, department, level, isActive, page, student } = query;

  const [draft, setDraft] = useState({ search, department });
  const [synced, setSynced] = useState({ search, department });
  const [list, setList] = useState({ key: null, data: null, error: null });
  const [reloads, setReloads] = useState(0);

  // A new key means a new request; the previous result stays on screen (dimmed) until it settles.
  const requestKey = JSON.stringify([search, department, level, isActive, page, reloads]);

  const go = useCallback((patch, { replace = false } = {}) => {
    setSearchParams(writeQuery({ search, department, level, isActive, page, student, ...patch }), { replace });
  }, [search, department, level, isActive, page, student, setSearchParams]);

  // Back/forward or a pasted URL changes the filters: mirror them into the inputs.
  if (synced.search !== search || synced.department !== department) {
    setSynced({ search, department });
    setDraft({ search, department });
  }

  // Debounced text filters reset to page 1.
  useEffect(() => {
    if (draft.search === search && draft.department === department) return undefined;
    const timer = setTimeout(() => go({ ...draft, page: 1 }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, search, department, go]);

  useEffect(() => {
    let cancelled = false;
    listStudents({ search, department, level, isActive, page, pageSize: PAGE_SIZE })
      .then((data) => !cancelled && setList({ key: requestKey, data, error: null }))
      .catch((error) => !cancelled && setList({ key: requestKey, data: null, error }));
    return () => {
      cancelled = true;
    };
  }, [search, department, level, isActive, page, requestKey]);

  const handleFilterChange = (patch) => {
    if ("level" in patch || "isActive" in patch) go({ ...patch, ...draft, page: 1 });
    else setDraft((current) => ({ ...current, ...patch }));
  };

  const handleUpdated = useCallback((updated) => {
    setList((current) =>
      current.data
        ? { ...current, data: { ...current.data, results: current.data.results.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)) } }
        : current,
    );
  }, []);

  const closeDetail = useCallback(() => go({ student: "" }), [go]);

  const settled = list.key === requestKey;
  const status = !settled ? "loading" : list.error ? "error" : "ready";
  const { data, error } = list;
  const filtered = Boolean(search || department || level || isActive);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Student Management</h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">Manage and monitor all registered students.</p>
      </div>

      <section className="mt-8 bg-white rounded-2xl p-4" aria-label="Students">
        <StudentFilters values={{ search: draft.search, department: draft.department, level, isActive }} onChange={handleFilterChange} />

        {status === "loading" && !data && (
          <p role="status" className="flex items-center gap-2 py-10 justify-center text-sm text-gray-600">
            <Spinner className="h-4 w-4 text-gray-500" /> Loading students...
          </p>
        )}

        {status === "error" && (
          <div className="space-y-3 py-6">
            <FormAlert>{error.message || "Students could not be loaded."}</FormAlert>
            <button type="button" onClick={() => setReloads((n) => n + 1)} className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm">
              Try again
            </button>
          </div>
        )}

        {data && status !== "error" && (
          <div aria-busy={status === "loading"} className={status === "loading" ? "opacity-60" : undefined}>
            {data.results.length === 0 ? (
              <p role="status" className="py-10 text-center text-sm text-gray-600">
                {filtered ? "No students match these filters." : "No students have registered yet."}
              </p>
            ) : (
              <StudentTable students={data.results} onView={(id) => go({ student: String(id) })} />
            )}
            <Pagination page={page} pageSize={PAGE_SIZE} count={data.count} onPage={(next) => go({ page: next })} />
          </div>
        )}
      </section>

      {student && <StudentDetailDrawer id={student} onClose={closeDetail} onUpdated={handleUpdated} />}
    </section>
  );
};

export default StudentDashboard;
