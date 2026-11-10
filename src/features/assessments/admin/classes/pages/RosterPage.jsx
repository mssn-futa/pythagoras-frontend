import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { formatLagos } from "../../dates.js";
import { inputClass, primaryButton, secondaryButton } from "../../components/styles.js";
import { Alert, ConfirmDialog, LoadingBlock, Pager } from "../../components/ui.jsx";
import ClassFrame from "../components/ClassFrame.jsx";
import { useClassRecord } from "../useClassRecord.js";
import { describeClassError } from "../classErrors.js";
import { ENROLLMENT_STATUSES, listEnrollments, searchStudents, setEnrollment } from "../classService.js";

const PAGE_SIZE = 20;

export default function RosterPage() {
  const { id } = useParams();
  return <Roster key={id} id={id} />;
}

const badge = { active: "bg-emerald-100 text-emerald-800", withdrawn: "bg-gray-200 text-gray-700" };

function Roster({ id }) {
  const state = useClassRecord(id);
  const { record, reload } = state;
  const [params, setParams] = useSearchParams();
  const status = ENROLLMENT_STATUSES.includes(params.get("status")) ? params.get("status") : "";
  const search = params.get("search") ?? "";
  const page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);
  const [term, setTerm] = useState(search);

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirm, setConfirm] = useState(null); // { row, status }
  const latest = useRef(0);

  const load = useCallback(async () => {
    const token = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const loaded = await listEnrollments(id, { status, search, page, pageSize: PAGE_SIZE });
      if (token === latest.current) setData(loaded);
    } catch (failure) {
      if (token === latest.current) setError(describeClassError(failure).message);
    } finally {
      if (token === latest.current) setLoading(false);
    }
  }, [id, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (next) => {
    const merged = { status, search, page, ...next };
    const query = {};
    if (merged.status) query.status = merged.status;
    if (merged.search) query.search = merged.search;
    if (Number(merged.page) > 1) query.page = String(merged.page);
    setParams(query);
  };

  async function change(row, nextStatus) {
    setBusyId(row.studentId);
    setProblem(null);
    try {
      await setEnrollment(id, { studentId: row.studentId, status: nextStatus });
      setNotice(nextStatus === "withdrawn" ? `${row.studentName || "Student"} withdrawn.` : `${row.studentName || "Student"} reinstated.`);
    } catch (failure) {
      const described = describeClassError(failure);
      setProblem(described.message);
      setNotice(null);
      if (described.conflict) reload(); // e.g. the class closed meanwhile
    } finally {
      setBusyId(null);
      setConfirm(null);
      load();
    }
  }

  const manageable = record && !record.legacy && record.status !== "closed";
  const canAdd = manageable && record.status === "published";

  return (
    <ClassFrame id={id} state={state}>
      {record && (
        <section aria-label="Roster" className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">Roster{data ? ` (${data.count})` : ""}</h2>
          {record.status === "draft" && <Alert tone="info">This class is a draft. Students can enroll only after it is published.</Alert>}
          {record.status === "closed" && <Alert tone="info">This class is closed. The roster is read-only; no new enrollment is possible.</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}
          {problem && <Alert>{problem}</Alert>}

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Status
              <select
                value={status}
                onChange={(event) => update({ status: event.target.value, page: 1 })}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2A742F]"
              >
                <option value="">All</option>
                {ENROLLMENT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <form
              role="search"
              className="flex flex-1 flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                update({ search: term.trim(), page: 1 });
              }}
            >
              <input aria-label="Search students" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Name or email" className={inputClass(false)} />
              <button type="submit" className={secondaryButton}>
                Search
              </button>
            </form>
          </div>

          {canAdd && <AddStudent classId={id} onAdded={(name) => { setNotice(`${name} enrolled.`); setProblem(null); load(); }} onFailed={(described) => { setProblem(described.message); setNotice(null); if (described.conflict || described.gone) reload(); }} />}

          {error && (
            <Alert>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{error}</span>
                <button type="button" className={secondaryButton} onClick={load}>
                  Try again
                </button>
              </div>
            </Alert>
          )}
          {loading && <LoadingBlock label="Loading roster..." />}
          {!loading && !error && data && data.results.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              {status || search ? "No enrollments match these filters." : "No students are enrolled yet."}
            </p>
          )}
          {!loading && !error && data && data.results.length > 0 && (
            <>
              <div className="relative overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Student</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3 font-medium">Enrolled</th>
                      <th scope="col" className="px-4 py-3 font-medium">Withdrawn</th>
                      <th scope="col" className="px-4 py-3 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.results.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">{row.studentName || `Student ${row.studentId}`}</p>
                          <p className="text-gray-500">{row.studentEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${badge[row.status] ?? badge.withdrawn}`}>{row.status ?? "unknown"}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatLagos(row.enrolledAt)}</td>
                        <td className="px-4 py-3 text-gray-600">{row.withdrawnAt ? formatLagos(row.withdrawnAt) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          {manageable && row.status === "active" && (
                            <button type="button" className={secondaryButton} disabled={busyId === row.studentId} onClick={() => setConfirm({ row, status: "withdrawn" })} aria-label={`Withdraw ${row.studentName || row.studentId}`}>
                              Withdraw
                            </button>
                          )}
                          {manageable && row.status === "withdrawn" && (
                            <button type="button" className={secondaryButton} disabled={busyId === row.studentId} onClick={() => change(row, "active")} aria-label={`Reinstate ${row.studentName || row.studentId}`}>
                              Reinstate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} count={data.count} pageSize={PAGE_SIZE} onPage={(next) => update({ page: next })} />
            </>
          )}
          {confirm && (
            <ConfirmDialog title="Withdraw this student?" confirmLabel="Withdraw" tone="danger" busy={busyId !== null} onConfirm={() => change(confirm.row, "withdrawn")} onCancel={() => setConfirm(null)}>
              <p>{confirm.row.studentName || `Student ${confirm.row.studentId}`} loses access to this class's modules. Their enrollment record is kept and can be reinstated.</p>
              <p>Quiz attempts already started keep their original expiry.</p>
            </ConfirmDialog>
          )}
        </section>
      )}
    </ClassFrame>
  );
}

/** Admin enrollment: find a student through the D1 student list, then POST the enrollment. */
function AddStudent({ classId, onAdded, onFailed }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState(null);
  const [adding, setAdding] = useState(null);

  async function find(event) {
    event.preventDefault();
    if (!term.trim()) return;
    setSearching(true);
    setMessage(null);
    try {
      setResults((await searchStudents({ search: term.trim() })).results);
    } catch (failure) {
      setResults(null);
      setMessage(describeClassError(failure).message);
    } finally {
      setSearching(false);
    }
  }

  async function add(student) {
    setAdding(student.id);
    try {
      await setEnrollment(classId, { studentId: student.id, status: "active" });
      setResults(null);
      setTerm("");
      onAdded(student.name);
    } catch (failure) {
      onFailed(describeClassError(failure));
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <form onSubmit={find} role="search" aria-label="Enroll a student" className="flex flex-col gap-3 sm:flex-row">
        <input aria-label="Find a student to enroll" value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Find a student by name, email or matric number" className={inputClass(false)} />
        <button type="submit" className={primaryButton} disabled={searching}>
          {searching ? "Searching..." : "Find student"}
        </button>
      </form>
      {message && <Alert>{message}</Alert>}
      {results && results.length === 0 && <p className="text-sm text-gray-500">No students match.</p>}
      {results && results.length > 0 && (
        <ul aria-label="Matching students" className="space-y-2">
          {results.map((student) => (
            <li key={student.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <span>
                {student.name} <span className="text-gray-500">{student.email}</span>
              </span>
              <button type="button" className={secondaryButton} disabled={adding !== null} onClick={() => add(student)} aria-label={`Enroll ${student.name}`}>
                Enroll
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
