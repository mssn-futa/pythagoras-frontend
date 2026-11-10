import { Link } from "react-router-dom";
import Spinner from "./Spinner.jsx";

/** Full-page placeholder shown while the session is being restored. */
export function SessionLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E5E7EB] dark:bg-gray-700">
      <div role="status" className="flex items-center gap-3 text-[#4B5563] dark:text-white">
        <Spinner className="h-5 w-5 text-[#2A742F] dark:text-white" />
        <span>Checking your session…</span>
      </div>
    </div>
  );
}

/** Shown to signed-in users who lack the required role. */
export function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#E5E7EB] dark:bg-gray-700 px-4">
      <section className="w-full max-w-md bg-white dark:bg-black rounded-2xl p-8 space-y-4 text-center shadow-lg">
        <h1 className="text-2xl font-semibold text-[#000000] dark:text-white">Access denied</h1>
        <p className="text-sm text-[#4B5563] dark:text-gray-300">
          Your account does not have permission to open this page.
        </p>
        <Link
          to="/"
          className="inline-block py-3 px-6 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43]"
        >
          Go to home
        </Link>
      </section>
    </div>
  );
}
