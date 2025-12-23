import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMapMarkerAlt,
  faCalendar,
  faDownload,
  faArchive,
  faPlay,
  faHeart,
  faComment,
  faChevronLeft,
  faMosque,
} from "@fortawesome/free-solid-svg-icons";
import DailyHadith from "./DailyHadith";
import PrayerTimes from "./PrayerTimes";
import HijriCalendar from "./HijriCalendar";
import SearchLectures from "./SearchLectures";
import AnonymousSuggestionBox from "./AnonymousSuggestionBox";
import ArabicLearning from "./ArabicLearning";
import FeedFastingSoul from "./FeedFastingSoul";
import summitImg from "../../assets/imageSix.jpg";
import jihad from "../../assets/imageNine.jpg";

const Dawah = () => {
  const [currentView, setCurrentView] = useState("main");
  const [selectedLecture, setSelectedLecture] = useState(null);

  const pastLectures = [
    {
      id: 1,
      title: "The Importance of Seeking Knowledge",
      description:
        "Seeking Islamic knowledge is one of the greatest acts of worship a Muslim can do. It strengthens one's faith, purifies the heart, and brings a person closer to Allah. Through knowledge, a believer understands how to worship correctly, and how to live a life pleasing to Allah.",
      image: summitImg,
      location: "Main Auditorium",
      date: "March 15, 2024",
      likes: 234,
      comments: 45,
    },
    {
      id: 2,
      title: "Building Character in Islam",
      description:
        "A comprehensive discussion on how Islam shapes and molds the character of believers through its teachings.",
      image: jihad,
      location: "Main Auditorium",
      date: "March 15, 2024",
      likes: 189,
      comments: 32,
    },
  ];

  const jumahKhutbahs = [
    {
      id: 1,
      title: "Gratitude in Times of Hardship",
      speaker: "Sheikh Abdullah",
      duration: "35 min",
      likes: 456,
      comments: 78,
    },
    {
      id: 2,
      title: "The Power of Dua",
      speaker: "Sheikh Muhammad",
      duration: "28 min",
      likes: 398,
      comments: 61,
    },
    {
      id: 3,
      title: "Patience and Perseverance",
      speaker: "Sheikh Ibrahim",
      duration: "32 min",
      likes: 412,
      comments: 54,
    },
  ];

  const handleViewAllLectures = () => {
    setCurrentView("all-lectures");
  };

  const handleViewAllKhutbahs = () => {
    setCurrentView("all-khutbahs");
  };

  const handleLectureClick = (lecture) => {
    setSelectedLecture(lecture);
    setCurrentView("lecture-detail");
  };

  const handleKhutbahClick = (khutbah) => {
    setSelectedLecture(khutbah);
    setCurrentView("khutbah-detail");
  };

  const handleBackToMain = () => {
    setCurrentView("main");
    setSelectedLecture(null);
  };

  if (currentView === "main") {
    return (
      <div className="space-y-6">
        <div className="lg:hidden">
          <SearchLectures />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <article className="bg-gradient-to-r from-[#C002C0] to-[#FF31FF] rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <h1 className="text-2xl font-bold mb-3 flex items-center gap-2">
                  Campus Da'wah Hub
                  <span className="text-2xl"></span>
                </h1>
                <p className="text-white/90 text-1xl">
                  Today, knowledge is a light, and Allah grants it to those whom
                  He loves...
                </p>
              </div>
              <div className="absolute right-0 top-0 opacity-10">
                <FontAwesomeIcon icon={faMosque} className="text-[150px]" />
              </div>
            </article>

            <section className="bg-white dark:bg-gray-800 rounded-xl p-5">
              <header className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Past Lectures
                </h2>
                <button
                  onClick={handleViewAllLectures}
                  className="text-[#FF31FF] hover:text-[#C002C0] font-medium transition-colors"
                >
                  View All
                </button>
              </header>

              <div className="grid gap-6 md:grid-cols-2">
                {pastLectures.slice(0, 2).map((lecture) => (
                  <article
                    key={lecture.id}
                    onClick={() => handleLectureClick(lecture)}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <img
                      src={lecture.image}
                      alt={lecture.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {lecture.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-3">
                        {lecture.description}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faMapMarkerAlt} />
                          {lecture.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faCalendar} />
                          {lecture.date}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="bg-white dark:bg-gray-800 rounded-xl p-6">
              <header className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Jumu'ah Khutbahs
                </h2>
                <button
                  onClick={handleViewAllKhutbahs}
                  className="text-[#FF31FF] hover:text-[#C002C0] font-medium transition-colors"
                >
                  View All
                </button>
              </header>

              <div className="space-y-4">
                {jumahKhutbahs.slice(0, 2).map((khutbah) => (
                  <article
                    key={khutbah.id}
                    onClick={() => handleKhutbahClick(khutbah)}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                          {khutbah.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {khutbah.speaker} • {khutbah.duration}
                        </p>
                        <div className="flex gap-4 mt-2">
                          <button className="flex items-center gap-2 px-4 py-2 bg-[#FF31FF] text-white rounded-lg text-sm hover:bg-[#C002C0] transition-colors">
                            <FontAwesomeIcon icon={faDownload} />
                            Download
                          </button>
                        </div>
                      </div>
                      <button className="text-[#FF31FF] hover:text-[#C002C0] transition-colors ml-4">
                        <FontAwesomeIcon icon={faPlay} size="1x" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <ArabicLearning />

            <footer className="bg-gradient-to-r from-[#C002C0] to-[#FF31FF] rounded-xl p-8 text-center text-white">
              <h2 className="text-3xl font-bold mb-2">
                PYTHAGORAS MUSLIM STUDENT HUB
              </h2>
              <p className="text-lg opacity-90">
                Empowering Muslim Students Through Knowledge
              </p>
            </footer>
          </div>

          <aside className="space-y-6">
            <div className="hidden lg:block">
              <SearchLectures />
            </div>
            <DailyHadith />
            <PrayerTimes />
            <HijriCalendar />
            <FeedFastingSoul />
            <AnonymousSuggestionBox />
          </aside>
        </div>
      </div>
    );
  }

  if (currentView === "all-lectures") {
    return (
      <div className="space-y-6">
        <div className="lg:hidden">
          <SearchLectures />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <header className="flex items-center gap-4">
              <button
                onClick={handleBackToMain}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
              >
                <FontAwesomeIcon icon={faChevronLeft} size="lg" />
              </button>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                Past Lectures
              </h1>
            </header>

            <div className="grid gap-6 md:grid-cols-2">
              {pastLectures.map((lecture) => (
                <article
                  key={lecture.id}
                  onClick={() => handleLectureClick(lecture)}
                  className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <img
                    src={lecture.image}
                    alt={lecture.title}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                      {lecture.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
                      {lecture.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faMapMarkerAlt} />
                        {lecture.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faCalendar} />
                        {lecture.date}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faHeart} />
                        {lecture.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <FontAwesomeIcon icon={faComment} />
                        {lecture.comments}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="hidden lg:block">
              <SearchLectures />
            </div>
            <DailyHadith />
            <PrayerTimes />
            <HijriCalendar />
            <FeedFastingSoul />
            <AnonymousSuggestionBox />
          </aside>
        </div>
      </div>
    );
  }

  if (currentView === "all-khutbahs") {
    return (
      <div className="space-y-6">
        <div className="lg:hidden">
          <SearchLectures />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <header className="flex items-center gap-4">
              <button
                onClick={handleBackToMain}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
              >
                <FontAwesomeIcon icon={faChevronLeft} size="lg" />
              </button>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                Jumu'ah Khutbahs
              </h1>
            </header>

            <div className="space-y-4">
              {jumahKhutbahs.map((khutbah) => (
                <article
                  key={khutbah.id}
                  onClick={() => handleKhutbahClick(khutbah)}
                  className="bg-white dark:bg-gray-800 rounded-lg p-6 cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {khutbah.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 mb-3">
                        {khutbah.speaker} • {khutbah.duration}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faHeart} />
                          {khutbah.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faComment} />
                          {khutbah.comments}
                        </span>
                      </div>
                      <div className="flex gap-4">
                        <button className="flex items-center gap-2 px-4 py-2 bg-[#FF31FF] text-white rounded-lg hover:bg-[#C002C0] transition-colors">
                          <FontAwesomeIcon icon={faDownload} />
                          Download
                        </button>
                      </div>
                    </div>
                    <button className="text-[#FF31FF] hover:text-[#C002C0] transition-colors ml-4">
                      <FontAwesomeIcon icon={faPlay} size="1x" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="hidden lg:block">
              <SearchLectures />
            </div>
            <DailyHadith />
            <PrayerTimes />
            <HijriCalendar />
            <FeedFastingSoul />
            <AnonymousSuggestionBox />
          </aside>
        </div>
      </div>
    );
  }

  if (currentView === "lecture-detail" && selectedLecture) {
    return (
      <div className="space-y-6">
        <div className="lg:hidden">
          <SearchLectures />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <header className="flex items-center gap-4">
              <button
                onClick={handleBackToMain}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-800 cursor-pointer dark:hover:text-white"
              >
                <FontAwesomeIcon icon={faChevronLeft} size="lg"/>
              </button>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                Lecture Details
              </h1>
            </header>

            <article className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
              <img
                src={selectedLecture.image}
                alt={selectedLecture.title}
                className="w-full h-96 object-cover"
              />
              <div className="p-8">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
                  {selectedLecture.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 text-lg mb-6 leading-relaxed">
                  {selectedLecture.description}
                </p>
                <div className="flex items-center gap-6 text-gray-500 dark:text-gray-400 mb-6">
                  <span className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faMapMarkerAlt} />
                    {selectedLecture.location}
                  </span>
                  <span className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faCalendar} />
                    {selectedLecture.date}
                  </span>
                </div>

                <section className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                  <header className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                      Comments
                    </h3>
                    <button className="text-[#FF31FF] hover:text-[#C002C0] font-medium">
                      Ask Question
                    </button>
                  </header>

                  <div className="space-y-6">
                    <article className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#C002C0] to-[#FF31FF] flex items-center justify-center text-white font-bold">
                        MA
                      </div>
                      <div className="flex-1">
                        <header className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-gray-800 dark:text-white">
                            Muhammad Ali
                          </h4>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            30 min
                          </span>
                        </header>
                        <p className="text-gray-600 dark:text-gray-300 mb-2">
                          Read Hadji Understanding the concept of Jihad in
                          Islamic jurisprudence. Can someone explain with
                          examples?
                        </p>
                        <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <button className="hover:text-[#FF31FF]">
                            <FontAwesomeIcon icon={faHeart} /> 5
                          </button>
                          <button className="hover:text-[#FF31FF]">
                            <FontAwesomeIcon icon={faComment} /> 2
                          </button>
                        </div>
                      </div>
                    </article>

                    <article className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#0284C7] to-[#0EA5E9] flex items-center justify-center text-white font-bold">
                        AR
                      </div>
                      <div className="flex-1">
                        <header className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-gray-800 dark:text-white">
                            Aisha Rahman
                          </h4>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            45 min
                          </span>
                        </header>
                        <p className="text-gray-600 dark:text-gray-300 mb-2">
                          Study group forming for Arabic Literature this sem.
                          Anyone interested in joining our weekend sessions?
                        </p>
                        <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <button className="hover:text-[#FF31FF]">
                            <FontAwesomeIcon icon={faHeart} /> 8
                          </button>
                          <button className="hover:text-[#FF31FF]">
                            <FontAwesomeIcon icon={faComment} /> 4
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                </section>
              </div>
            </article>
          </div>

          <aside className="space-y-6">
            <div className="hidden lg:block">
              <SearchLectures />
            </div>
            <DailyHadith />
            <PrayerTimes />
            <HijriCalendar />
            <FeedFastingSoul />
            <AnonymousSuggestionBox />
          </aside>
        </div>
      </div>
    );
  }

  if (currentView === "khutbah-detail" && selectedLecture) {
    return (
      <div className="space-y-6">
        <div className="lg:hidden">
          <SearchLectures />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <header className="flex items-center gap-4">
              <button
                onClick={handleBackToMain}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
              >
                <FontAwesomeIcon icon={faChevronLeft} size="lg" />
              </button>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                Khutbah Details
              </h1>
            </header>

            <article className="bg-white dark:bg-gray-800 rounded-xl p-8">
              <div className="flex items-center justify-center mb-8">
                <button className="w-32 h-32 rounded-full bg-gradient-to-r from-[#C002C0] to-[#FF31FF] flex items-center justify-center text-white hover:scale-105 transition-transform">
                  <FontAwesomeIcon icon={faPlay} size="3x" />
                </button>
              </div>

              <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4 text-center">
                {selectedLecture.title}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-lg mb-6 text-center">
                {selectedLecture.speaker} • {selectedLecture.duration}
              </p>

              <div className="flex justify-center gap-4 mb-8">
                <button className="flex items-center gap-2 px-6 py-3 bg-[#FF31FF] text-white rounded-lg hover:bg-[#C002C0] transition-colors">
                  <FontAwesomeIcon icon={faDownload} />
                  Download
                </button>
                <button className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                  <FontAwesomeIcon icon={faArchive} />
                  Archive
                </button>
              </div>

              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 mb-8">
                <div className="flex items-center gap-4">
                  <button className="w-12 h-12 rounded-full bg-[#FF31FF] flex items-center justify-center text-white hover:bg-[#C002C0] transition-colors">
                    <FontAwesomeIcon icon={faPlay} />
                  </button>
                  <div className="flex-1">
                    <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded-full">
                      <div className="h-2 bg-[#FF31FF] rounded-full w-1/3"></div>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mt-2">
                      <span>12:45</span>
                      <span>{selectedLecture.duration}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-8 text-gray-600 dark:text-gray-300 mb-8">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faHeart} className="text-red-500" />
                  <span>{selectedLecture.likes} Likes</span>
                </div>
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faComment} className="text-blue-500" />
                  <span>{selectedLecture.comments} Comments</span>
                </div>
              </div>

              <section className="pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
                  Comments
                </h3>
                <div className="space-y-6">
                  <article className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#2A742F] to-[#04AF43] flex items-center justify-center text-white font-bold">
                      FH
                    </div>
                    <div className="flex-1">
                      <header className="flex items-center gap-2 mb-2">
                        <h4 className="font-bold text-gray-800 dark:text-white">
                          Fatima Hassan
                        </h4>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          1 hour
                        </span>
                      </header>
                      <p className="text-gray-600 dark:text-gray-300 mb-2">
                        MashaAllah, very beneficial khutbah. May Allah reward
                        the Sheikh.
                      </p>
                      <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <button className="hover:text-[#FF31FF]">
                          <FontAwesomeIcon icon={faHeart} /> 12
                        </button>
                        <button className="hover:text-[#FF31FF]">
                          <FontAwesomeIcon icon={faComment} /> Reply
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              </section>
            </article>
          </div>

          <aside className="space-y-6">
            <div className="hidden lg:block">
              <SearchLectures />
            </div>
            <DailyHadith />
            <PrayerTimes />
            <HijriCalendar />
            <FeedFastingSoul />
            <AnonymousSuggestionBox />
          </aside>
        </div>
      </div>
    );
  }

  return null;
};

export default Dawah;