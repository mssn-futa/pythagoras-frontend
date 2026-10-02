import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faCalendar } from "@fortawesome/free-solid-svg-icons";
import welcomeImg from "../../../assets/i.png";


export default function WelcomeSection() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: Welcome Card */}
      <div
        className="lg:col-span-2 flex items-center justify-between
                   bg-linear-to-r from-[#2A742F] to-[#04AF43]
                   rounded-2xl p-6 text-white"
      >
        <div className="max-w-xl">
          <p className="font-semibold text-2xl md:text-3xl">
            Today is a new opportunity
          </p>

          <p className="mt-2 text-sm md:text-base opacity-90">
            Continue your journey of faith, knowledge, and growth
          </p>

          <div className="flex flex-wrap gap-4 mt-6 text-sm">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCalendar} />
              <span>9:49 AM</span>
            </div>

            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faClock} />
              <span>Friday, October 25, 2024</span>
            </div>
          </div>
        </div>

        {/* Image */}
        <div className="hidden md:block">
          <img
            src={welcomeImg}
            alt="Welcome Illustration"
            className="h-36 w-auto object-contain"
          />
        </div>
      </div>

      {/* RIGHT: Daily Hadith */}
      <div
        className="rounded-2xl p-5
                   bg-[#04AF4326] dark:bg-[#04AF434D]"
      >
        <div className="flex items-center gap-2 mb-3">
          <FontAwesomeIcon
            icon={faClock}
            className="text-[#2A742F] dark:text-white"
          />
          <p className="font-semibold text-lg text-[#374151] dark:text-white">
            Daily Hadith
          </p>
        </div>

        <p className="text-sm md:text-base text-[#374151] dark:text-white max-w-[280px] py-2.5">
          “The believer is not one who eats his fill while his neighbor goes
          hungry.”
        </p>

        <p className="mt-2 text-sm text-[#6B7280] dark:text-gray-200">
          — Prophet Muhammad (SAW)
        </p>
      </div>
    </section>
  );
}
