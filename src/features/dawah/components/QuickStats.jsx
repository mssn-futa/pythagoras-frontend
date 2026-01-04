import dawahImg from "../../../assets/dawah.png";
import academicImg from "../../../assets/academic.png";
import empowermentImg from "../../../assets/empowerment.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";

const stats = [
  {
    label: "Dawah",
    value: "Khutbahs, Lectures & More",
    image: dawahImg,
    gradient: "from-[#C002C0] to-[#FF31FF]",
  },
  {
    label: "Academics",
    value: "Learning resources & study materials",
    image: academicImg,
    gradient: "from-[#0284C7] to-[#0EA5E9]",
  },
  {
    label: "Empowerment",
    value: "Career, skill & entrepreneurship",
    image: empowermentImg,
    gradient: "from-[#FFB300] to-[#EAB308]",
  },
];

const prayerTimes = [
  ["Fajr", "5:45 AM"],
  ["Dhuhr", "12:30 PM"],
  ["Asr", "4:15 PM"],
  ["Maghrib", "6:45 PM"],
  ["Isha", "8:00 PM"],
];

export default function QuickStats() {
  return (
    <section className="pt-7 space-y-4 w-full min-w-0">
      <h2 className="text-[#1F2937] dark:text-white text-xl font-bold">
        Quick Access
      </h2>

      {/* MAIN GRID */}
      <div
        className="
          grid gap-4
          grid-cols-1
          lg:grid-cols-[1fr_300px]
          xl:grid-cols-[1fr_320px]
          min-w-0
        "
      >
        {/* LEFT — STAT CARDS */}
        <div
          className="
            grid gap-4
            grid-cols-1
            sm:grid-cols-2
            xl:grid-cols-3
            min-w-0
          "
        >
          {stats.map((stat, index) => (
            <div
              key={index}
              className={`
                bg-linear-to-r ${stat.gradient}
                text-white
                p-5
                rounded-2xl
                shadow-2xl
                flex
                min-w-0
              `}
            >
              <div className="flex flex-col justify-between w-full">
                <div className="space-y-3">
                  <img
                    src={stat.image}
                    alt={stat.label}
                    className="w-10 h-10 object-contain"
                  />

                  <p className="text-lg font-semibold truncate">
                    {stat.label}
                  </p>
                </div>

                <p className="text-sm opacity-90 mt-4 line-clamp-2">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT — PRAYER TIMES */}
        <div
          className="
            bg-white dark:bg-black
            p-5
            rounded-2xl
            shadow-2xl
            flex flex-col
            min-w-0
          "
        >
          <div className="flex items-center gap-2 mb-4">
            <FontAwesomeIcon
              icon={faCalendar}
              className="text-[#00695C]"
            />
            <span className="text-[#1F2937] dark:text-white font-semibold text-lg">
              Prayer Times
            </span>
          </div>

          <div className="flex flex-col gap-3 text-sm mt-auto">
            {prayerTimes.map(([name, time]) => (
              <div
                key={name}
                className="flex justify-between text-[#4B5563] dark:text-gray-300"
              >
                <span>{name}</span>
                <span className="font-medium">{time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
