export const retryButton =
  "mt-3 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-[#1F2937] hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2A742F] dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700";

export function describeLoadError(error) {
  if (error?.status === 0) return "The server could not be reached. Check your connection and try again.";
  if (error?.status === 403) return "You do not have access to this information.";
  return error?.message || "Something went wrong. Try again.";
}
