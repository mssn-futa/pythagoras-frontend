import peopleImg from "../../../assets/people.png";
import eduImg from "../../../assets/edu.png";
import meetImg from "../../../assets/meet.png";
import clockImg from "../../../assets/clock.png";

const events = [
  {
    id: 1,
    icon: peopleImg,
    iconBg: "bg-[#2D7D321A]",
    badgeText: "Tomorrow",
    badgeBg: "bg-[#DCFCE7]",
    badgeColor: "text-[#166534]",
    title: "Weekly Usroh",
    description: "Join us for our weekly Islamic study circle",
    time: "7:00 PM - 8:30 PM",
  },
  {
    id: 2,
    icon: eduImg,
    iconBg: "bg-[#0EA5E91A]",
    badgeText: "This Week",
    badgeBg: "bg-[#DBEAFE]",
    badgeColor: "text-[#1E40AF]",
    title: "Study Group",
    description: "Mathematics collaborative learning session",
    time: "Saturday 2:00 PM",
  },
  {
    id: 3,
    icon: meetImg,
    iconBg: "bg-[#FFB3001A]",
    badgeText: "Next Week",
    badgeBg: "bg-[#FEF9C3]",
    badgeColor: "text-[#854D0E]",
    title: "Career Workshop",
    description: "Professional development and networking",
    time: "Friday 4:00 PM",
  },
];

export default function UpcomingEvents() {
  return (
    <section className="pt-7 w-full min-w-0 space-y-5">
      <h2 className="text-[#1F2937] dark:text-white text-xl font-bold">
        Upcoming Events
      </h2>

      {/* Responsive Grid */}
      <div
        className="
          grid gap-4 sm:gap-5
          grid-cols-1
          md:grid-cols-2
          xl:grid-cols-3
        "
      >
        {events.map((event) => (
          <div
            key={event.id}
            className="
              bg-white dark:bg-[#000000]
              p-4 sm:p-5
              rounded-2xl
              flex flex-col gap-3
              shadow-2xl
              min-w-0
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`${event.iconBg} p-3 rounded-lg shrink-0`}
              >
                <img
                  src={event.icon}
                  alt={event.title}
                  className="w-5 h-5 object-contain"
                />
              </span>

              <span
                className={`
                  text-xs font-medium
                  px-2.5 py-1
                  rounded-full
                  whitespace-nowrap
                  ${event.badgeBg}
                  ${event.badgeColor}
                `}
              >
                {event.badgeText}
              </span>
            </div>

            {/* Title */}
            <h3
              className="
                text-[#1F2937] dark:text-white
                text-base sm:text-[18px]
                font-bold
                truncate
              "
            >
              {event.title}
            </h3>

            {/* Description */}
            <p
              className="
                text-sm sm:text-[15px]
                text-[#4B5563] dark:text-[#9CA3AF]
                leading-relaxed
                line-clamp-2
              "
            >
              {event.description}
            </p>

            {/* Time */}
            <div className="flex items-center gap-2 mt-auto">
              <img
                src={clockImg}
                alt="time"
                className="w-4 h-4 object-contain"
              />
              <span className="text-xs sm:text-[14px] text-[#6B7280]">
                {event.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
