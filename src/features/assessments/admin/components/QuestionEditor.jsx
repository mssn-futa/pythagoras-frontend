import { useState } from "react";
import { hasErrors, OPTION_COUNT, parsePoints, validateQuestionDraft } from "../quizRules.js";
import { inputClass, primaryButton, secondaryButton } from "./styles.js";
import { Alert, FieldError } from "./ui.jsx";

const LETTERS = ["A", "B", "C", "D"];

/**
 * Admin-only MCQ editor (D3: exactly four distinct non-empty options, exactly
 * one correct, positive integer points). Deliberately not shared with the
 * student taker. `onSave(draft)` resolves to {message, fields} on failure.
 */
export default function QuestionEditor({ initial, heading, saveLabel, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState({ optionTexts: [] });
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  const setOption = (index, text) =>
    setDraft((current) => ({ ...current, options: current.options.map((option, i) => (i === index ? { ...option, text } : option)) }));

  async function submit(event) {
    event.preventDefault();
    const found = validateQuestionDraft(draft);
    setErrors(found);
    setServerError(null);
    if (hasErrors(found)) return;
    setSaving(true);
    const failure = await onSave({ ...draft, points: parsePoints(draft.points) });
    setSaving(false);
    if (failure) setServerError(failure);
  }

  const fieldErrors = serverError?.fields ?? {};
  const textError = errors.text ?? fieldErrors.text?.join(" ");
  const pointsError = errors.points ?? fieldErrors.points?.join(" ");
  const optionsError = errors.options ?? fieldErrors.options?.join(" ");

  return (
    <form noValidate onSubmit={submit} aria-label={heading} className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-gray-800">{heading}</h3>
      {serverError?.message && <Alert>{serverError.message}</Alert>}

      <div>
        <label htmlFor="question-text" className="mb-2 block text-sm font-medium text-gray-700">
          Question
        </label>
        <textarea
          id="question-text"
          rows={3}
          value={draft.text}
          onChange={(event) => setDraft({ ...draft, text: event.target.value })}
          aria-invalid={Boolean(textError)}
          aria-describedby={textError ? "question-text-error" : undefined}
          className={`${inputClass(textError)} resize-none`}
        />
        <FieldError id="question-text-error">{textError}</FieldError>
      </div>

      <div className="sm:w-40">
        <label htmlFor="question-points" className="mb-2 block text-sm font-medium text-gray-700">
          Points
        </label>
        <input
          id="question-points"
          inputMode="numeric"
          value={draft.points}
          onChange={(event) => setDraft({ ...draft, points: event.target.value })}
          aria-invalid={Boolean(pointsError)}
          aria-describedby={pointsError ? "question-points-error" : undefined}
          className={inputClass(pointsError)}
        />
        <FieldError id="question-points-error">{pointsError}</FieldError>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700">
          Options ({OPTION_COUNT}, all different). Select the radio button next to the correct answer.
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {draft.options.map((option, index) => {
            const message = errors.optionTexts[index];
            return (
              <div key={index}>
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct-option"
                    aria-label={`Option ${LETTERS[index]} is correct`}
                    checked={draft.correctIndex === index}
                    onChange={() => setDraft({ ...draft, correctIndex: index })}
                    className="h-5 w-5 shrink-0 accent-[#2A742F]"
                  />
                  <input
                    type="text"
                    aria-label={`Option ${LETTERS[index]}`}
                    placeholder={`Option ${LETTERS[index]}`}
                    value={option.text}
                    onChange={(event) => setOption(index, event.target.value)}
                    aria-invalid={Boolean(message)}
                    className={inputClass(message)}
                  />
                </div>
                <FieldError>{message}</FieldError>
              </div>
            );
          })}
        </div>
        <FieldError>{optionsError}</FieldError>
        <FieldError>{errors.correct}</FieldError>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" className={secondaryButton} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? "Saving..." : saveLabel}
        </button>
      </div>
    </form>
  );
}
