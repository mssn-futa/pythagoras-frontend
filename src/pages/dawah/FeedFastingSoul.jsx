import fasting from "../../assets/imageSeven.jpg";

const FeedFastingSoul = () => {
  return (
    <article className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm cursor-pointer hover:shadow-lg transition-shadow">
      <img 
        src={fasting} 
        alt="Feed a Fasting Soul - Ramadan 2025"
        className="w-full h-full object-cover"
      />
    </article>
  );
};

export default FeedFastingSoul;