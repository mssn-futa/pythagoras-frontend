/* Button classes matching the existing auth/profile forms (brand gradient + outlined secondary). */
const base =
  "inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2A742F] disabled:opacity-70";

export const primaryButton = `${base} text-white bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:opacity-95`;
export const secondaryButton = `${base} border border-[#2A742F] text-[#2A742F] dark:text-green-300 dark:border-green-300 hover:bg-green-50 dark:hover:bg-gray-800`;
