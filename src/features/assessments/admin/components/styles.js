export const inputClass = (invalid) =>
  `w-full rounded-lg border px-4 py-2.5 transition focus:outline-none focus:ring-2 disabled:bg-gray-100 disabled:text-gray-500 ${
    invalid ? "border-red-400 focus:ring-red-400" : "border-gray-300 focus:border-[#2A742F] focus:ring-[#2A742F]"
  }`;

export const primaryButton =
  "rounded-lg bg-[#2A742F] px-5 py-2.5 text-white shadow-sm transition hover:bg-[#1f5a24] disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButton =
  "rounded-lg border border-gray-300 px-5 py-2.5 text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60";
export const dangerButton =
  "rounded-lg bg-red-600 px-5 py-2.5 text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60";
