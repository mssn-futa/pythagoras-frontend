import { describeFormError } from "../../auth/formErrors.js";

const IMMUTABLE_MESSAGE =
  "This quiz has been published, so its questions, options, points, correct answers, duration, deadline and links can no longer change. Only the title and description can be corrected.";

/**
 * Maps an ApiError to what the admin screens show. `fields` holds errors for
 * the named form fields; everything else is folded into the message.
 */
export function describeAssessmentError(error, formFields = []) {
  const { message, fields } = describeFormError(error, formFields);
  const code = error?.code;
  if (code === "QUIZ_IMMUTABLE") return { message: IMMUTABLE_MESSAGE, fields, code, immutable: true };
  if (error?.status === 0) {
    return { message: "We couldn't reach the server. Nothing was saved. Check your connection and try again.", fields, code, immutable: false };
  }
  if (error?.status === 403) return { message: "You don't have permission to do that.", fields, code, immutable: false };
  if (error?.status === 404) return { message: "This quiz or question no longer exists or is not visible to you.", fields, code, immutable: false };
  if (error?.status === 429) return { message: "Too many requests. Wait a moment and try again.", fields, code, immutable: false };
  return { message: message ?? "Something went wrong. Try again.", fields, code, immutable: false };
}

export const QUIZ_IMMUTABLE_MESSAGE = IMMUTABLE_MESSAGE;
