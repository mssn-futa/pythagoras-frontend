import { Link } from "react-router-dom";
import DashboardPanel from "../../components/dashboard/DashboardPanel.jsx";
import { useLiveData } from "../../components/dashboard/useLiveData.js";
import { listQuizzes as listQuizzesAsAdmin } from "../../features/assessments/admin/adminQuizService.js";
import { listAvailableQuizzes, listHistory } from "../../features/assessments/student/api/studentAssessmentsApi.js";
import { listClasses } from "../../features/assessments/student/classes/api/classesApi.js";
import { describeScore, formatLagos, pluralize } from "../../features/assessments/student/lib/format.js";
import { useAuth } from "../../features/auth/AuthContext.js";
import { listUpcomingEvents } from "../../features/dawah/public/api/dawahPublicService.js";
import { usePreloadLinkProps } from "../../routes/routePreload.js";

/*
 * Student dashboard (D1 "Frontend Design", PLAT-07). Every panel shows live
 * data from an existing feature service and loads independently. There are no
 * activity, points, progress, social or prayer/Hijri widgets: those prototypes
 * (src/features/dawah/components/*) are kept as source but no longer mounted.
 */

// Reader-visible items only: the student endpoints already return these, and an
// admin opening "/" should not see drafts presented as available.
const isOpen = (item) => item.status === null || item.status === undefined || item.status === "published";

const loadEvents = () => listUpcomingEvents({ pageSize: 5 }); // public: true, no bearer
// A quiz is "available" only while open: published (or unstated for the student
// endpoint, which only returns open quizzes) and not past its deadline.
const notPastDeadline = (quiz) => {
  const deadline = quiz.deadline ? Date.parse(quiz.deadline) : NaN;
  return !Number.isFinite(deadline) || deadline > Date.now();
};
const loadQuizzes = async () => {
  const page = await listAvailableQuizzes({ pageSize: 5 });
  return page.results.filter((quiz) => isOpen(quiz) && notPastDeadline(quiz));
};
// The same endpoint lists every status for an admin, so ask for published ones explicitly.
const loadQuizzesForAdmin = async () => {
  const page = await listQuizzesAsAdmin({ status: "published", pageSize: 5 });
  return page.results.filter((quiz) => quiz.status === "published" && notPastDeadline(quiz));
};
const loadClasses = async () => {
  const page = await listClasses({ pageSize: 5 });
  return page.results.filter(isOpen);
};
const loadResults = () => listHistory({ pageSize: 3 });

const isEmptyList = (items) => !items || items.length === 0;
const isEmptyPage = (page) => !page || page.results.length === 0;

const itemLink =
  "block rounded-xl border border-gray-100 p-3 hover:border-[#2A742F] hover:bg-green-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F] dark:border-gray-800 dark:hover:bg-gray-900";
const itemTitle = "font-medium text-[#1F2937] dark:text-white break-words";
const itemMeta = "mt-0.5 text-sm text-[#6B7280] dark:text-gray-400";

const SHORTCUTS = [
  { to: "/dawah", label: "Da'wah archive", hint: "Recordings, videos and documents" },
  { to: "/dawah/quizzes", label: "Quizzes", hint: "Open assessments" },
  { to: "/dawah/classes", label: "Arabic classes", hint: "Enrol and read modules" },
  { to: "/profile/results", label: "My results", hint: "Submitted quiz scores" },
  { to: "/profile", label: "Profile", hint: "Your details" },
];

function IdentityCard({ user }) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email;
  const facts = [
    user?.matric_number && { label: "Matric number", value: user.matric_number },
    user?.department && { label: "Department", value: user.department },
    user?.level && { label: "Level", value: user.level },
    user?.email && { label: "Email", value: user.email },
  ].filter(Boolean);
  return (
    <section aria-labelledby="dashboard-title" className="rounded-2xl bg-white p-5 shadow-sm md:p-6 dark:bg-black">
      <h1 id="dashboard-title" className="text-2xl font-semibold text-[#1F2937] dark:text-white break-words">
        Welcome, {user?.first_name || name}
      </h1>
      <p className="mt-1 text-sm text-[#6B7280] dark:text-gray-400">Here is what is available to you right now.</p>
      {facts.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">
              <dt className="text-xs uppercase tracking-wide text-[#6B7280] dark:text-gray-400">{fact.label}</dt>
              <dd className="truncate font-medium text-[#1F2937] dark:text-white">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

export default function Homepage() {
  const { user, isAdmin } = useAuth();
  const preloadProps = usePreloadLinkProps();
  const events = useLiveData(loadEvents);
  const quizzes = useLiveData(isAdmin ? loadQuizzesForAdmin : loadQuizzes);
  const classes = useLiveData(loadClasses);
  const results = useLiveData(loadResults);

  return (
    <div className="space-y-6 pt-22">
      <IdentityCard user={user} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardPanel
          title="Upcoming events"
          source={events}
          viewAll={{ to: "/dawah", label: "Open the archive" }}
          loadingText="Loading upcoming events…"
          errorTitle="Upcoming events could not be loaded"
          emptyText="No upcoming events have been published yet."
          isEmpty={isEmptyPage}
        >
          {(page) => (
            <ul className="space-y-2">
              {page.results.map((event) => (
                <li key={event.id}>
                  <Link to={`/dawah/events/${event.id}`} className={itemLink}>
                    <p className={itemTitle}>{event.title || "Untitled event"}</p>
                    <p className={itemMeta}>
                      {formatLagos(event.startTime)}
                      {event.location ? ` · ${event.location}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Available quizzes"
          source={quizzes}
          viewAll={{ to: "/dawah/quizzes", label: "All quizzes" }}
          loadingText="Loading quizzes…"
          errorTitle="Quizzes could not be loaded"
          emptyText="No quizzes are open right now."
          isEmpty={isEmptyList}
        >
          {(items) => (
            <ul className="space-y-2">
              {items.map((quiz) => (
                <li key={quiz.id}>
                  <Link to={`/dawah/quizzes/${quiz.id}`} className={itemLink}>
                    <p className={itemTitle}>{quiz.title}</p>
                    <p className={itemMeta}>
                      {quiz.deadline ? `Closes ${formatLagos(quiz.deadline)}` : "No deadline"}
                      {quiz.timeLimit ? ` · ${pluralize(quiz.timeLimit, "minute")}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Arabic classes"
          source={classes}
          viewAll={{ to: "/dawah/classes", label: "All classes" }}
          loadingText="Loading classes…"
          errorTitle="Classes could not be loaded"
          emptyText="No Arabic classes are open yet."
          isEmpty={isEmptyList}
        >
          {(items) => (
            <ul className="space-y-2">
              {items.map((klass) => (
                <li key={klass.id}>
                  <Link to={`/dawah/classes/${klass.id}`} className={itemLink}>
                    <p className={itemTitle}>{klass.title || klass.code}</p>
                    <p className={itemMeta}>
                      {[klass.code, klass.moduleCount !== null ? pluralize(klass.moduleCount, "module") : null].filter(Boolean).join(" · ") || "Open to see modules"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Recent results"
          source={results}
          viewAll={{ to: "/profile/results", label: "All results" }}
          loadingText="Loading your results…"
          errorTitle="Your results could not be loaded"
          emptyText="You have not submitted a quiz yet."
          isEmpty={isEmptyPage}
        >
          {(page) => (
            <ul className="space-y-2">
              {page.results.map((result) => (
                <li key={result.id}>
                  <Link to={`/profile/results/${result.id}`} className={itemLink}>
                    <p className={itemTitle}>{result.quizTitle || "Quiz result"}</p>
                    <p className={itemMeta}>
                      {describeScore(result)}
                      {result.submittedAt ? ` · ${formatLagos(result.submittedAt)}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </div>

      <section aria-labelledby="shortcuts-title" className="rounded-2xl bg-white p-5 shadow-sm md:p-6 dark:bg-black">
        <h2 id="shortcuts-title" className="mb-4 text-lg font-semibold text-[#1F2937] dark:text-white">
          Shortcuts
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.to}>
              <Link to={shortcut.to} className={`${itemLink} h-full`} {...preloadProps(shortcut.to)}>
                <span className={`${itemTitle} block`}>{shortcut.label}</span>
                <span className={`${itemMeta} block`}>{shortcut.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
