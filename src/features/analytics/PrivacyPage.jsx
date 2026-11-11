import AnalyticsSettings from "./AnalyticsSettings.jsx";

/** /privacy — public page to review, give or withdraw analytics consent. */
export default function PrivacyPage() {
  return (
    <div className="space-y-6 pt-22">
      <section className="py-8 px-5 md:px-8 bg-white rounded-2xl dark:bg-black space-y-4">
        <h1 className="text-2xl font-semibold text-[#1F2937] dark:text-white">Privacy settings</h1>
        <div className="space-y-2 text-sm text-[#4B5563] dark:text-gray-300 max-w-3xl">
          <p>
            If you allow it, Pythagoras uses Google Analytics to count which kinds of pages are visited (for example &ldquo;Event details&rdquo;, never which
            event) and how many accounts are created. Google sets first-party cookies (<code>_ga</code>) to tell visits apart.
          </p>
          <p>
            Analytics never receives your name, email, matric number, quiz answers, search terms or any page content, and is not used for advertising.
            Declining or withdrawing changes nothing else in the app.
          </p>
        </div>
        <h2 className="text-lg font-semibold text-[#1F2937] dark:text-white pt-2">Analytics</h2>
        <AnalyticsSettings />
      </section>
    </div>
  );
}
