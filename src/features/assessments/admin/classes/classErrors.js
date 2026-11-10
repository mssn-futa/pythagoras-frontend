import { describeFormError } from "../../../auth/formErrors.js";

/**
 * Maps an ApiError to what the class screens show. `fields` holds errors for the named
 * form fields; everything else is folded into the message. 409s keep the server's
 * explanation (closed class, referenced record, ...) because D3 names no codes for them.
 */
export function describeClassError(error, formFields = []) {
  const { message, fields } = describeFormError(error, formFields);
  const code = error?.code;
  const base = { fields, code, conflict: error?.status === 409, gone: error?.status === 404 };
  if (error?.status === 0 && code === "TIMEOUT") {
    return { ...base, message: "The server took too long to respond. The change may have been saved; reload the page to check before trying again." };
  }
  if (error?.status === 0) return { ...base, message: "We couldn't reach the server. Nothing was saved. Check your connection and try again." };
  if (error?.status === 403) return { ...base, message: "You don't have permission to do that." };
  if (error?.status === 404) return { ...base, message: "This class, module or record no longer exists or is not visible to you." };
  if (error?.status === 429) return { ...base, message: "Too many requests. Wait a moment and try again." };
  if (error?.status === 409) {
    const detail = message ? ` ${message}` : "";
    if (code === "RESOURCE_REFERENCED") return { ...base, message: `This record is referenced elsewhere and cannot be deleted. Unpublish or close it instead.${detail}` };
    return { ...base, message: `The change conflicts with the current state.${detail} The page shows the latest saved version.` };
  }
  return { ...base, message: message ?? "Something went wrong. Try again." };
}
