import React from "react";
import smallLogo from "/src/assets/imageOne.jpg";
import sideImage from "/src/assets/imageTen.png";

const ProfileVerification = () => {
  return (
    <main
      className="
        min-h-screen w-full relative 
        bg-white
        lg:bg-cover lg:bg-center
        lg:bg-[url('/src/assets/imageOne.jpg')]
      "
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>

      <section className="hidden lg:flex relative z-10 min-h-screen items-center justify-center px-10">
        <div className="w-full max-w-6xl bg-white/95 shadow-2xl rounded-2xl grid grid-cols-2 overflow-hidden border border-gray-200">
          <section className="p-12 flex flex-col justify-between bg-gradient-to-br from-[#2A742F] to-[#04AF43] text-white">
            <header className="space-y-4">
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <img
                  src={smallLogo}
                  alt="logo"
                  className="h-10 w-10 object-contain rounded-full"
                />
                Pythagoras
              </h1>
              <h2 className="text-xl font-semibold leading-relaxed">
                Welcome back to the central hub of productivity
              </h2>
              <p className="text-white/90 text-base">
                Join thousands of Muslim students benefitting from a unified
                ecosystem for Da'wah and Academics every day.
              </p>
            </header>

            <article className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4 mt-5">
              <div className="flex items-start gap-4">
                <img
                  src={sideImage}
                  alt="user"
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-semibold text-lg">Abdulwarith Salman</h3>
                  <p className="text-sm text-white/80">
                    Product Manager at Pythagoras
                  </p>
                </div>
              </div>
              <p className="text-white/90 text-sm italic leading-relaxed">
                "Pythagoras has completely transformed how our team
                collaborates. Intuitive interface and powerful features make
                complex projects feel effortless."
              </p>
            </article>

            <footer className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
              <div>
                <div className="text-3xl font-bold">50K+</div>
                <div className="text-sm text-white/80">Active Users</div>
              </div>
              <div>
                <div className="text-3xl font-bold">99.9%</div>
                <div className="text-sm text-white/80">Uptime</div>
              </div>
              <div>
                <div className="text-3xl font-bold">24/7</div>
                <div className="text-sm text-white/80">Support</div>
              </div>
            </footer>
          </section>

          <section className="flex items-center justify-center p-12 bg-white">
            <article className="w-full max-w-md space-y-8 text-center">
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full bg-[#2A742F]/20 flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-[#2A742F]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>

              <h2 className="text-3xl font-semibold text-[#000]">
                Profile Verified!
              </h2>

              <p className="text-[#4B5563] text-sm leading-relaxed max-w-sm mx-auto">
                Your profile has been successfully verified. You can now proceed
                to access all features of the platform, complete additional
                details if needed, or upload any remaining documents.
              </p>

              <button className="w-full py-3 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:shadow-lg cursor-pointer hover:scale-[1.02] transition-all">
                Continue
              </button>
            </article>
          </section>
        </div>
      </section>

      <section className="lg:hidden relative z-10 min-h-screen w-full flex flex-col justify-between px-4 py-10">
        <article className="flex-1 flex flex-col justify-center space-y-10 max-w-md mx-auto">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-[#2A742F]/20 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-[#2A742F]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <h2 className="text-3xl font-semibold text-center text-[#2A742F]">
            Profile Verified!
          </h2>

          <p className="text-center text-sm text-[#2A742F]/90 leading-relaxed">
            Your profile has been successfully verified. You can now continue to
            complete additional details or upload any remaining documents.
          </p>
        </article>

        <button className="w-full max-w-md mx-auto py-3 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:shadow-lg transition-all">
          Continue
        </button>
      </section>
    </main>
  );
};

export default ProfileVerification;
