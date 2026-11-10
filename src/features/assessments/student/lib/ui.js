export const cardClass = "py-8 px-5 md:px-8 bg-white rounded-2xl dark:bg-black";
export const headingClass = "text-2xl font-semibold text-[#1F2937] dark:text-white";
export const mutedClass = "text-sm text-[#6B7280] dark:text-gray-400";
export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium text-white bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#2A742F] focus:ring-offset-2";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-medium border border-gray-300 text-[#1F2937] bg-white hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#2A742F]";

/** Plain-language message for an ApiError raised by a student assessment call. */
export function describeAssessmentError(error) {
  if (!error) return "Something went wrong. Try again.";
  if (error.status === 403) return "You do not have access to this quiz.";
  if (error.status === 404) return "This quiz or attempt is not available. It may be closed, past its deadline, or not yours.";
  return error.message || "Something went wrong. Try again.";
}

export const pageFromParams = (params) => {
  const page = Number.parseInt(params.get("page"), 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
};
