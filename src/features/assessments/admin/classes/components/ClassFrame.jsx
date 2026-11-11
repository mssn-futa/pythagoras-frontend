import { Link, NavLink } from "react-router-dom";
import { Alert, LoadingBlock, StatusBadge } from "../../components/ui.jsx";
import { primaryButton, secondaryButton } from "../../components/styles.js";

const tabClass = ({ isActive }) =>
  `rounded-lg px-4 py-2 text-sm font-medium transition ${isActive ? "bg-[#2A742F] text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-100"}`;

/** Page chrome for one class: title, status, section tabs, load/error states. */
export default function ClassFrame({ id, state, children }) {
  const { record, error, loading, retry } = state;
  if (loading) return <LoadingBlock label="Loading class..." />;
  if (!record) {
    return (
      <section className="mx-auto max-w-4xl space-y-4">
        <Alert>{error}</Alert>
        <div className="flex gap-3">
          <button type="button" className={primaryButton} onClick={retry}>
            Try again
          </button>
          <Link to="/admin/classes" className={secondaryButton}>
            Back to classes
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-800 lg:text-3xl">{record.title || "Class"}</h1>
          <StatusBadge status={record.status} />
        </div>
        <Link to="/admin/classes" className={`${secondaryButton} text-center`}>
          All classes
        </Link>
      </div>
      {error && <Alert>{error}</Alert>}
      {record.legacy && (
        <Alert tone="warn">
          {record.kind !== "arabic"
            ? "This is a legacy or general academic course, not an Arabic class. It is shown read-only and cannot be managed here."
            : "The server returned an unrecognised class status, so this class is shown read-only and no actions are offered."}
        </Alert>
      )}
      {!record.legacy && (
        <nav aria-label="Class sections" className="flex flex-wrap gap-2">
          <NavLink end to={`/admin/classes/${id}`} className={tabClass}>
            Details
          </NavLink>
          <NavLink to={`/admin/classes/${id}/modules`} className={tabClass}>
            Modules
          </NavLink>
          <NavLink to={`/admin/classes/${id}/roster`} className={tabClass}>
            Roster
          </NavLink>
        </nav>
      )}
      {children}
    </section>
  );
}
