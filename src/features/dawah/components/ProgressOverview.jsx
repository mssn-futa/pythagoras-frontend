import { useMemo } from "react";
import bookImg from "../../../assets/book.png";
import cupImg from "../../../assets/cup.png";
import starImg from "../../../assets/star.png";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCalendar } from "@fortawesome/free-solid-svg-icons";

const progressStats = [
  {
    id: 1,
    label: "Lectures",
    value: "24",
    icon: bookImg,
    textColor: "text-[#04AF43]",
    bgColor: "bg-[#04AF4333]",
  },
  {
    id: 2,
    label: "Completed",
    value: "18",
    icon: cupImg,
    textColor: "text-[#4C90FF]",
    bgColor: "bg-[#4C90FF33]",
  },
  {
    id: 3,
    label: "Points",
    value: "420",
    icon: starImg,
    textColor: "text-[#FFB300]",
    bgColor: "bg-[#FFB30033]",
  },
];

export default function ProgressOverview() {
  const today = new Date();

  const calendarData = useMemo(() => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return { firstDay, daysInMonth };
  }, [today]);

  return (
    <section className="pt-7 flex flex-col xl:flex-row gap-4 w-full">
      
      {/* LEFT SIDE */}
      <div className="flex flex-col gap-3 w-full min-w-0">
        <h2 className="text-[#1F2937] dark:text-white text-xl font-bold">
          Your Progress
        </h2>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {progressStats.map((item) => (
            <div
              key={item.id}
              className="
                bg-white dark:bg-[#000000]
                p-6 rounded-2xl
                flex flex-col items-center justify-center
                gap-3.5 shadow-2xl
              "
            >
              <span className={`${item.bgColor} rounded-xl p-3.5`}>
                <img
                  src={item.icon}
                  alt={item.label}
                  className="w-7 h-7 object-contain"
                />
              </span>

              <span className={`${item.textColor} text-[18px] font-bold`}>
                {item.label}
              </span>

              <span className={`${item.textColor} text-[16px]`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE — CALENDAR */}
      <div
        className="
          bg-white dark:bg-[#000000]
          rounded-2xl p-6
          w-full xl:w-[340px]
          shrink-0 shadow-2xl
        "
      >
        <h3 className="text-[#1F2937] font-bold text-[18px] py-2.5 flex items-center gap-1.5 dark:text-white">
          <FontAwesomeIcon icon={faCalendar} className="text-[#04AF43]" />
          <span>Hijri Calendar</span>
        </h3>

        {/* Weekdays */}
        <div className="grid grid-cols-7 text-xs text-center text-[#6B7280] mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-7 gap-1 text-sm text-center">
          {Array(calendarData.firstDay)
            .fill(null)
            .map((_, i) => (
              <span key={`empty-${i}`} />
            ))}

          {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === today.getDate();

            return (
              <span
                key={day}
                className={`py-1 rounded-lg ${
                  isToday
                    ? "bg-[#04AF43] text-white font-medium"
                    : "text-[#1F2937] dark:text-white"
                }`}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
