import { useId } from "react";
import { Link } from "react-router-dom";
import { LoadError } from "../../components/dashboard/DashboardPanel.jsx";
import { useLiveData } from "../../components/dashboard/useLiveData.js";
import { useAuth } from "../../features/auth/AuthContext.js";
import { usePreloadLinkProps } from "../../routes/routePreload.js";
import {
  countActiveStudents,
  countAutomations,
  countBroadcasts,
  countBroadcastsInProgress,
  countClasses,
  countPublishedEvents,
  countQuizzes,
  countStudents,
} from "./dashboard/dashboardCounts.js";

/*
 * /admin dashboard (D1 "Frontend Design", PLAT-07): live counts from the
 * paginated `count` of existing admin lists, plus working shortcuts. Every card
 * loads on its own; a failing endpoint shows an error on that card only and
 * never a placeholder number.
 */

const loaders = {
  students: countStudents,
  activeStudents: countActiveStudents,
  publishedEvents: countPublishedEvents,
  publishedQuizzes: () => countQuizzes("published"),
  draftQuizzes: () => countQuizzes("draft"),
  closedQuizzes: () => countQuizzes("closed"),
  classes: countClasses,
  inProgress: countBroadcastsInProgress,
  uncertain: () => countBroadcasts("uncertain"),
  automations: countAutomations,
};

const numberFormat = new Intl.NumberFormat("en-NG");

const linkClass = "text-sm font-medium text-emerald-700 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";

function CountCard({ label, load, link, describe, tone = "default" }) {
  const id = useId();
  const preloadProps = usePreloadLinkProps();
  const source = useLiveData(load);
  const view = source.status === "ready" ? (describe ? describe(source.data) : { value: source.data }) : null;
  const accent = tone === "warning" && view && view.value > 0 ? "text-amber-700" : "text-gray-900";
  return (
    <article aria-labelledby={id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 id={id} className="text-sm font-medium text-gray-600">
        {label}
      </h3>
      <div className="mt-2 flex-1">
        {source.status === "loading" && (
          <p role="status" className="text-sm text-gray-500">
            <span className="mr-2 inline-block h-7 w-12 animate-pulse rounded bg-gray-100 align-middle" aria-hidden="true" />
            Loading…
          </p>
        )}
        {source.status === "error" && <LoadError title={`${label} unavailable`} error={source.error} onRetry={source.reload} />}
        {view && (
          <>
            <p className={`text-3xl font-bold ${accent}`} data-testid="count-value">
              {view.prefix && (
                <>
                  <span aria-hidden="true">{view.prefix}</span>
                  <span className="sr-only">approximately </span>
                </>
              )}
              {numberFormat.format(view.value)}
            </p>
            {view.detail && <p className="mt-1 text-sm text-gray-600">{view.detail}</p>}
          </>
        )}
      </div>
      {link && (
        <Link to={link.to} className={`${linkClass} mt-4`} {...preloadProps(link.to)}>
          {link.label}
        </Link>
      )}
    </article>
  );
}

function Section({ title, children }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-lg font-semibold text-gray-800">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

// Two separate list snapshots (queued, processing), so a broadcast moving between
// them can be counted twice or missed: label the sum as approximate.
const describeInProgress = (value) => ({ value, prefix: "≈", detail: "Approximate: queued plus processing, counted separately" });

const describeAutomations = ({ total, enabled }) =>
  enabled === null
    ? { value: total, detail: "rules in total; open Automations to see which are enabled" }
    : { value: enabled, detail: `enabled of ${total} ${total === 1 ? "rule" : "rules"}` };

const SHORTCUTS = [
  { to: "/admin/students", label: "Manage students" },
  { to: "/admin/events/new", label: "New event" },
  { to: "/admin/content", label: "Content library" },
  { to: "/admin/quizzes/new", label: "New quiz" },
  { to: "/admin/classes/new", label: "New Arabic class" },
  { to: "/admin/communication", label: "Compose a broadcast" },
  { to: "/admin/communication/automations/new", label: "New automation" },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email;
  const preloadProps = usePreloadLinkProps();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-800">Admin dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Signed in as <span className="font-medium text-gray-800">{name}</span>. Figures are live counts from the server.
        </p>
      </div>

      <Section title="Students">
        <CountCard label="Registered students" load={loaders.students} link={{ to: "/admin/students", label: "Manage students" }} />
        <CountCard label="Active students" load={loaders.activeStudents} link={{ to: "/admin/students?is_active=true", label: "View active students" }} />
      </Section>

      <Section title="Da'wah">
        <CountCard label="Published events" load={loaders.publishedEvents} link={{ to: "/admin/events", label: "Manage events" }} />
      </Section>

      <Section title="Assessments">
        <CountCard label="Published quizzes" load={loaders.publishedQuizzes} link={{ to: "/admin/quizzes", label: "Manage quizzes" }} />
        <CountCard label="Draft quizzes" load={loaders.draftQuizzes} link={{ to: "/admin/quizzes", label: "Manage quizzes" }} />
        <CountCard label="Closed quizzes" load={loaders.closedQuizzes} link={{ to: "/admin/quizzes", label: "Manage quizzes" }} />
        <CountCard label="Arabic classes" load={loaders.classes} link={{ to: "/admin/classes", label: "Manage classes" }} />
      </Section>

      <Section title="Communication">
        <CountCard
          label="Broadcasts in progress"
          load={loaders.inProgress}
          describe={describeInProgress}
          link={{ to: "/admin/communication/history", label: "View history" }}
        />
        <CountCard label="Uncertain broadcasts" tone="warning" load={loaders.uncertain} link={{ to: "/admin/communication/history", label: "Investigate in history" }} />
        <CountCard label="Automations" load={loaders.automations} describe={describeAutomations} link={{ to: "/admin/communication/automations", label: "Manage automations" }} />
      </Section>

      <section aria-labelledby="admin-shortcuts" className="space-y-3">
        <h2 id="admin-shortcuts" className="text-lg font-semibold text-gray-800">
          Shortcuts
        </h2>
        <ul className="flex flex-wrap gap-2">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.to}>
              <Link
                to={shortcut.to}
                {...preloadProps(shortcut.to)}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {shortcut.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AdminDashboard;
