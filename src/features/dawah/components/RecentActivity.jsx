import playImg from "../../../assets/play.png";
import userImg from "../../../assets/user.png";
import ebookImg from "../../../assets/ebook.png";

const activities = [
  {
    id: 1,
    name: "Listened to Jumu'ah Khutbah",
    time: "2 hours ago",
    icon: playImg,
    iconBg: "bg-[#2D7D32]",
  },
  {
    id: 2,
    name: "Downloaded past questions",
    time: "Yesterday",
    icon: ebookImg,
    iconBg: "bg-[#0EA5E9]",
  },
  {
    id: 3,
    name: "Connected with mentor",
    time: "3 days ago",
    icon: userImg,
    iconBg: "bg-[#FFB300]",
  },
];

export default function RecentActivity() {
  return (
    <section className="pt-7 w-full min-w-0">
      <h2 className="text-[#1F2937] dark:text-white text-xl font-bold mb-4">
        Recent Activity
      </h2>

      {/* Container */}
      <div
        className="
          bg-white dark:bg-[#000000]
          rounded-2xl p-4 sm:p-5
          shadow-2xl w-full
        "
      >
        <div className="flex flex-col gap-3">
          {activities.map((item) => (
            <div
              key={item.id}
              className="
                flex items-center gap-3
                p-3 sm:p-4
                bg-[#F9FAFB] dark:bg-[#111111]
                rounded-lg
                min-w-0
              "
            >
              {/* Icon */}
              <div
                className={`
                  w-11 h-11 sm:w-12 sm:h-12
                  flex items-center justify-center
                  rounded-full shrink-0
                  ${item.iconBg}
                `}
              >
                <img
                  src={item.icon}
                  alt={item.name}
                  className="w-5 h-5 object-contain"
                />
              </div>

              {/* Text */}
              <div className="flex flex-col min-w-0">
                <span
                  className="
                    text-[#1F2937] dark:text-white
                    text-sm sm:text-[16px]
                    font-medium
                    truncate
                  "
                >
                  {item.name}
                </span>

                <span className="text-[#6B7280] text-xs sm:text-[14px]">
                  {item.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
