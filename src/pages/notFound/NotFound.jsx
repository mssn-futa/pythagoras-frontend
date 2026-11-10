import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#E5E7EB] dark:bg-gray-700 px-4">
    <section className="w-full max-w-md bg-white dark:bg-black rounded-2xl p-8 space-y-4 text-center shadow-lg">
      <h1 className="text-2xl font-semibold text-[#000000] dark:text-white">Page not found</h1>
      <p className="text-sm text-[#4B5563] dark:text-gray-300">This page is not available.</p>
      <Link to="/" className="inline-block py-3 px-6 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43]">
        Go to home
      </Link>
    </section>
  </div>
);

export default NotFound;
