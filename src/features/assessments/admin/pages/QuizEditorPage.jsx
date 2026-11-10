import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  buildQuestionPayload,
  buildQuizPayload,
  closeQuiz,
  createQuestion,
  createQuiz,
  deleteQuestion,
  deleteQuiz,
  getQuiz,
  publishQuiz,
  updateQuestion,
  updateQuiz,
} from "../adminQuizService.js";
import { formatLagos, isoToLagosInput, lagosInputToIso } from "../dates.js";
import { describeAssessmentError } from "../errors.js";
import QuestionEditor from "../components/QuestionEditor.jsx";
import RelatedCourseSelect from "../classes/components/RelatedCourseSelect.jsx";
import { inputClass, primaryButton, secondaryButton } from "../components/styles.js";
import { Alert, ConfirmDialog, FieldError, LoadingBlock, StatusBadge } from "../components/ui.jsx";
import { blankQuestionDraft, draftFromQuestion, publishBlockers, TIME_LIMIT_MAX, TIME_LIMIT_MIN, totalPoints, validateQuizDetails } from "../quizRules.js";

const DETAIL_FIELDS = ["title", "description", "time_limit", "deadline", "related_event", "related_course"];
const letter = (index) => String.fromCharCode(65 + index);

const emptyForm = { title: "", description: "", time_limit: "", deadline: "", related_course: "" };
const formFromQuiz = (quiz) => ({
  title: quiz.title,
  description: quiz.description,
  time_limit: quiz.timeLimit === null ? "" : String(quiz.timeLimit),
  deadline: isoToLagosInput(quiz.deadline),
  related_course: quiz.relatedCourse === null ? "" : String(quiz.relatedCourse),
});

/** Keyed by quiz id so navigating between quizzes never carries state over. */
export default function QuizEditorPage() {
  const { id } = useParams();
  return <QuizEditor key={id ?? "new"} id={id} />;
}

function QuizEditor({ id }) {
  const navigate = useNavigate();
  const savedFormRef = useRef(emptyForm);
  const formRef = useRef(emptyForm);
  const location = useLocation();
  const isNew = id === undefined;

  const [quiz, setQuiz] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [savedForm, setSavedFormState] = useState(emptyForm);
  const setSavedForm = (next) => {
    savedFormRef.current = next;
    setSavedFormState(next);
  };
  useEffect(() => {
    formRef.current = form;
  });
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [problem, setProblem] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [questionMode, setQuestionMode] = useState(null); // null | { question: null | persisted question }
  const [confirm, setConfirm] = useState(null); // { kind: 'publish'|'close'|'delete'|'question', question? }
  const [busy, setBusy] = useState(false);

  // Refreshes the quiz and the saved baseline. Unsaved detail edits are kept unless `adopt` says
  // otherwise; `merge(server, current)` lets a caller keep only some fields (metadata correction).
  const load = useCallback(async ({ adopt = false, merge } = {}) => {
    try {
      const loaded = await getQuiz(id);
      setQuiz(loaded);
      const next = formFromQuiz(loaded);
      const wasDirty = JSON.stringify(formRef.current) !== JSON.stringify(savedFormRef.current);
      setSavedForm(next);
      if (merge) setForm(merge(next, formRef.current));
      else if (adopt || !wasDirty) setForm(next);
      setLoadError(null);
    } catch (error) {
      setLoadError(describeAssessmentError(error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isNew) load();
  }, [isNew, load]);

  const status = isNew ? "draft" : quiz?.status ?? null;
  const unknownStatus = !isNew && status === null; // contract violation: fail closed
  const isDraft = status === "draft";
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  function fail(error, formFields = DETAIL_FIELDS, loadOptions) {
    const described = describeAssessmentError(error, formFields);
    setProblem(described.message);
    setFieldErrors(described.fields);
    setNotice(null);
    // A state conflict or a vanished object means our view is stale: show the real state.
    if (!isNew && (described.immutable || error?.status === 409 || error?.status === 404)) load(loadOptions);
    return described;
  }

  // Untouched deadline round-trips byte for byte (keeps seconds the input cannot show).
  const deadlineToSend = () => (form.deadline === savedForm.deadline ? quiz?.deadline ?? null : lagosInputToIso(form.deadline));

  async function saveDetails(event) {
    event.preventDefault();
    setNotice(null);
    setProblem(null);
    const found = validateQuizDetails(form);
    setFieldErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      if (isNew) {
        const created = await createQuiz(
          buildQuizPayload({
            title: form.title,
            description: form.description,
            timeLimit: form.time_limit.trim() ? Number(form.time_limit) : null,
            deadline: lagosInputToIso(form.deadline),
            relatedEvent: null, // D3 draft example; no UI for event association yet
            relatedCourse: form.related_course ? Number(form.related_course) : undefined,
          }),
        );
        navigate(`/admin/quizzes/${created.id}`, { replace: true, state: { notice: "Draft saved. You can now add questions." } });
        return;
      }
      // Published/closed quizzes accept only the D3 metadata corrections.
      const payload = isDraft
        ? buildQuizPayload({
            title: form.title,
            description: form.description,
            timeLimit: form.time_limit.trim() ? Number(form.time_limit) : null,
            deadline: deadlineToSend(),
            relatedCourse: form.related_course === savedForm.related_course ? undefined : form.related_course ? Number(form.related_course) : null,
          })
        : { title: form.title.trim(), description: form.description.trim() };
      await updateQuiz(id, payload);
      await load({ adopt: true });
      setNotice(isDraft ? "Draft saved." : "Title and description updated.");
    } catch (error) {
      const edited = form;
      const described = fail(error, DETAIL_FIELDS, {
        // Published meanwhile: keep the typed title/description so they can be saved as a metadata correction.
        merge: (server) => (error?.code === "QUIZ_IMMUTABLE" ? { ...server, title: edited.title, description: edited.description } : server),
      });
      if (described.immutable) {
        setProblem(`${described.message} Your title and description edits are kept below. Use "Save title and description" to apply them as a correction.`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveQuestion(draft) {
    const editing = questionMode.question;
    const order = editing ? editing.order : Math.max(0, ...quiz.questions.map((question) => question.order)) + 1;
    const payload = buildQuestionPayload({ ...draft, order });
    try {
      if (editing) await updateQuestion(editing.id, payload);
      else await createQuestion(quiz.id, payload);
    } catch (error) {
      const described = describeAssessmentError(error, ["text", "points", "options", "order"]);
      if (described.immutable || error?.status === 409 || error?.status === 404) {
        setQuestionMode(null);
        fail(error);
        return null;
      }
      return described;
    }
    setQuestionMode(null);
    setProblem(null);
    setNotice(editing ? "Question updated." : "Question added.");
    await load();
    return null;
  }

  async function runConfirmed() {
    setBusy(true);
    const action = confirm;
    try {
      if (action.kind === "publish") {
        await publishQuiz(id);
        setNotice("Quiz published. Its questions, answers, timing and links are now locked.");
      } else if (action.kind === "close") {
        await closeQuiz(id);
        setNotice("Quiz closed. Students can no longer start new attempts; attempts already in progress can still be submitted.");
      } else if (action.kind === "delete") {
        await deleteQuiz(id);
        navigate("/admin/quizzes", { replace: true, state: { notice: "Draft deleted." } });
        return;
      } else if (action.kind === "question") {
        await deleteQuestion(action.question.id);
        setNotice("Question deleted.");
      }
      setProblem(null);
      setFieldErrors({});
      await load();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (loading) return <LoadingBlock label="Loading quiz..." />;
  if (loadError) {
    return (
      <section className="mx-auto max-w-4xl space-y-4">
        <Alert>{loadError}</Alert>
        <div className="flex gap-3">
          <button type="button" className={primaryButton} onClick={() => { setLoading(true); load(); }}>
            Try again
          </button>
          <Link to="/admin/quizzes" className={secondaryButton}>
            Back to quizzes
          </Link>
        </div>
      </section>
    );
  }

  const blockers = quiz ? publishBlockers(quiz) : [];
  const readOnlyGrading = !isNew && !isDraft;
  const lockAll = unknownStatus;
  const fieldProps = (name) => ({
    "aria-invalid": Boolean(fieldErrors[name]),
    "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined,
  });
  const errorText = (name) => (Array.isArray(fieldErrors[name]) ? fieldErrors[name].join(" ") : fieldErrors[name]);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-800 lg:text-3xl">{isNew ? "New quiz" : quiz.title || "Quiz"}</h1>
          {!isNew && <StatusBadge status={status} />}
        </div>
        <div className="flex gap-3">
          <Link to="/admin/quizzes" className={secondaryButton}>
            All quizzes
          </Link>
          {!isNew && !isDraft && !unknownStatus && (
            <Link to={`/admin/quizzes/${id}/results`} className={primaryButton}>
              View results
            </Link>
          )}
        </div>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {problem && <Alert>{problem}</Alert>}
      {unknownStatus && (
        <Alert>
          The server returned an unrecognised quiz status, so this quiz is shown read-only and no actions are offered. Reload the page; if it persists, contact the developers.
        </Alert>
      )}
      {readOnlyGrading && !unknownStatus && (
        <Alert tone="info">
          {status === "published"
            ? "This quiz is published. Questions, options, points, correct answers, duration, deadline and links are locked. You can still correct the title and description; saved results are not affected."
            : "This quiz is closed. It cannot be reopened and its grading content is locked. You can still correct the title and description; saved results are not affected."}
        </Alert>
      )}

      <form noValidate onSubmit={saveDetails} aria-label="Quiz details" className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <h2 className="text-xl font-semibold text-[#111827]">Quiz details</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-3">
            <label htmlFor="quiz-title" className="mb-2 block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              id="quiz-title"
              value={form.title}
              disabled={lockAll}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className={inputClass(fieldErrors.title)}
              {...fieldProps("title")}
            />
            <FieldError id="title-error">{errorText("title")}</FieldError>
          </div>
          <div className="md:col-span-3">
            <label htmlFor="quiz-description" className="mb-2 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="quiz-description"
              rows={3}
              value={form.description}
              disabled={lockAll}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className={`${inputClass(fieldErrors.description)} resize-none`}
              {...fieldProps("description")}
            />
            <FieldError id="description-error">{errorText("description")}</FieldError>
          </div>
          <div>
            <label htmlFor="quiz-time-limit" className="mb-2 block text-sm font-medium text-gray-700">
              Time limit (minutes, {TIME_LIMIT_MIN}-{TIME_LIMIT_MAX})
            </label>
            <input
              id="quiz-time-limit"
              inputMode="numeric"
              value={form.time_limit}
              disabled={readOnlyGrading}
              onChange={(event) => setForm({ ...form, time_limit: event.target.value })}
              className={inputClass(fieldErrors.time_limit)}
              {...fieldProps("time_limit")}
            />
            <FieldError id="time_limit-error">{errorText("time_limit")}</FieldError>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="quiz-deadline" className="mb-2 block text-sm font-medium text-gray-700">
              Deadline (Lagos time)
            </label>
            <input
              id="quiz-deadline"
              type="datetime-local"
              value={form.deadline}
              disabled={readOnlyGrading}
              onChange={(event) => setForm({ ...form, deadline: event.target.value })}
              className={inputClass(fieldErrors.deadline)}
              {...fieldProps("deadline")}
            />
            <FieldError id="deadline-error">{errorText("deadline")}</FieldError>
            {readOnlyGrading && quiz.deadline && <p className="mt-1 text-xs text-gray-500">Locked: {formatLagos(quiz.deadline)}</p>}
          </div>
          <div className="md:col-span-3">
            <RelatedCourseSelect
              value={form.related_course}
              disabled={readOnlyGrading}
              onChange={(value) => setForm({ ...form, related_course: value })}
              error={errorText("related_course")}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="submit" className={primaryButton} disabled={saving || lockAll || (!isNew && !dirty)}>
            {saving ? "Saving..." : isNew ? "Save draft" : isDraft ? "Save draft details" : "Save title and description"}
          </button>
        </div>
      </form>

      {!isNew && (
        <section aria-label="Questions" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              Questions ({quiz.questions.length}) <span className="text-base font-normal text-gray-500">· {totalPoints(quiz.questions)} points in total</span>
            </h2>
            {isDraft && !questionMode && (
              <button type="button" className={primaryButton} onClick={() => setQuestionMode({ question: null })}>
                Add question
              </button>
            )}
          </div>

          {quiz.questions.length === 0 && !questionMode && (
            <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">No questions yet.</p>
          )}

          <ol className="space-y-4">
            {quiz.questions.map((question, index) =>
              questionMode?.question?.id === question.id ? (
                <li key={question.id}>
                  <QuestionEditor
                    heading={`Edit question ${index + 1}`}
                    saveLabel="Save question"
                    initial={draftFromQuestion(question)}
                    onSave={saveQuestion}
                    onCancel={() => setQuestionMode(null)}
                  />
                </li>
              ) : (
                <li key={question.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <p className="font-medium text-gray-800">
                      {index + 1}. {question.text}
                    </p>
                    <span className="w-fit shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {question.points} {question.points === 1 ? "point" : "points"}
                    </span>
                  </div>
                  {question.legacy && (
                    <p className="mt-2 text-sm font-medium text-amber-800">
                      Legacy question: {question.type === "mcq" ? "it does not have exactly four options with one correct answer" : `type "${question.type}" is not supported`}. It cannot be edited or published in this release.
                    </p>
                  )}
                  <ul className="mt-3 space-y-1 text-sm text-gray-700">
                    {question.options.map((option, optionIndex) => (
                      <li key={option.id} className={option.isCorrect ? "font-semibold text-[#2A742F]" : ""}>
                        {letter(optionIndex)}. {option.text}
                        {option.isCorrect && <span className="ml-2 text-xs">(correct)</span>}
                      </li>
                    ))}
                  </ul>
                  {isDraft && !questionMode && (
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      {!question.legacy && (
                        <button type="button" className={secondaryButton} onClick={() => setQuestionMode({ question })}>
                          Edit question {index + 1}
                        </button>
                      )}
                      <button type="button" className={secondaryButton} onClick={() => setConfirm({ kind: "question", question })}>
                        Delete question {index + 1}
                      </button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ol>

          {questionMode && !questionMode.question && (
            <QuestionEditor
              heading="New question"
              saveLabel="Add question"
              initial={blankQuestionDraft()}
              onSave={saveQuestion}
              onCancel={() => setQuestionMode(null)}
            />
          )}
        </section>
      )}

      {!isNew && !unknownStatus && (
        <section aria-label="Lifecycle" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-semibold text-gray-800">Publication</h2>
          {isDraft && (
            <>
              <p className="text-sm text-gray-600">
                Publishing makes the quiz available to students until its deadline and locks questions, options, points, correct answers, duration, deadline and links.
                Only the title and description can be corrected afterwards.
              </p>
              {dirty && <Alert tone="warn">Save your detail changes before publishing.</Alert>}
              {blockers.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800" aria-label="Before you can publish">
                  {blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button type="button" className={secondaryButton} onClick={() => setConfirm({ kind: "delete" })}>
                  Delete draft
                </button>
                <button type="button" className={primaryButton} disabled={dirty || blockers.length > 0 || Boolean(questionMode)} onClick={() => setConfirm({ kind: "publish" })}>
                  Publish quiz
                </button>
              </div>
            </>
          )}
          {status === "published" && (
            <>
              <p className="text-sm text-gray-600">
                Published {formatLagos(quiz.publishedAt)}. Closing stops new attempts. Attempts already started can still be submitted before their own expiry. Closing cannot be undone.
              </p>
              <div className="flex justify-end">
                <button type="button" className={secondaryButton} onClick={() => setConfirm({ kind: "close" })}>
                  Close quiz
                </button>
              </div>
            </>
          )}
          {status === "closed" && <p className="text-sm text-gray-600">This quiz is closed and cannot be reopened. Results remain available.</p>}
        </section>
      )}

      {confirm?.kind === "publish" && (
        <ConfirmDialog title="Publish this quiz?" confirmLabel="Publish quiz" busy={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>
          <p>
            {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"}, {totalPoints(quiz.questions)} points in total, {quiz.timeLimit} minutes, deadline {formatLagos(quiz.deadline)}.
          </p>
          <p>After publishing, questions, options, points, correct answers, duration, deadline and links cannot be changed. Only the title and description can be corrected.</p>
        </ConfirmDialog>
      )}
      {confirm?.kind === "close" && (
        <ConfirmDialog title="Close this quiz?" confirmLabel="Close quiz" tone="danger" busy={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>
          <p>Students will not be able to start new attempts. Attempts already in progress can still be submitted before their original expiry.</p>
          <p>Closing is permanent in this release.</p>
        </ConfirmDialog>
      )}
      {confirm?.kind === "delete" && (
        <ConfirmDialog title="Delete this draft?" confirmLabel="Delete draft" tone="danger" busy={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>
          <p>The draft and its questions are removed permanently.</p>
        </ConfirmDialog>
      )}
      {confirm?.kind === "question" && (
        <ConfirmDialog title="Delete this question?" confirmLabel="Delete question" tone="danger" busy={busy} onConfirm={runConfirmed} onCancel={() => setConfirm(null)}>
          <p>{confirm.question.text}</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
