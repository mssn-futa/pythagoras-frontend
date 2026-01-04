import eventOneImg from "../../../assets/eventOne.png";
import eventTwoImg from "../../../assets/eventTwo.png";
import eventThreeImg from "../../../assets/eventThree.png";
import eventFourImg from "../../../assets/eventFour.png";

const events = [
  eventOneImg,
  eventTwoImg,
  eventThreeImg,
  eventFourImg,
];

export default function ContinueListening() {
  return (
    <section className="py-10 px-5 bg-white rounded-2xl dark:bg-black">
      <div
        className="
          grid 
          grid-cols-1 
          sm:grid-cols-2 
          lg:grid-cols-4 
          gap-4 
          place-items-center
        "
      >
        {events.map((img, index) => (
          <img
            key={index}
            src={img}
            alt={`Continue listening ${index + 1}`}
            className="
              w-full 
              max-w-[300px] 
              h-auto 
              object-contain
            "
          />
        ))}
      </div>
    </section>
  );
}
