import React, { useState, useRef } from "react";
import bgImage from "/src/assets/imageOne.jpg";
import smallLogo from "/src/assets/imageOne.jpg";
import sideImage from "/src/assets/imageTen.png";

const VerificationCode = () => {
  const [code, setCode] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(null);

  const inputRefs = useRef([]);
  if (inputRefs.current.length === 0) {
    for (let i = 0; i < 4; i++) inputRefs.current.push(React.createRef());
  }

  const handleChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 3) inputRefs.current[index + 1].current.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData("text");
    if (!/^\d{4}$/.test(paste)) return;
    const digits = paste.split("");
    setCode(digits);
    inputRefs.current[3].current.focus();
  };

  const handleVerify = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const handleResend = () => {
    console.log("Resending code...");
  };

  const isDisabled = loading || code.some((d) => !d);

  return (
    <main
      className="
    min-h-screen w-full relative 
    bg-[#ffffff]
    lg:bg-cover lg:bg-center
    lg:bg-[url('/src/assets/imageOne.jpg')]
  "
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>

      <section className="hidden lg:flex relative z-10 min-h-screen items-center justify-center px-10">
        <div className="w-full max-w-6xl bg-white/95 shadow-2xl rounded-2xl grid grid-cols-2 overflow-hidden border border-gray-200">
          <aside className="p-12 flex flex-col justify-between bg-gradient-to-br from-[#2A742F] to-[#04AF43] text-white">
            <header className="space-y-4">
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <img
                  src={smallLogo}
                  alt="logo"
                  className="h-10 w-10 object-contain rounded-full"
                />
                Pythagoras
              </h1>

              <h2 className="text-xl text-white font-semibold leading-relaxed">
                Welcome back to the central hub of productivity
              </h2>

              <p className="text-white/90 text-base">
                Join thousands of Muslim students benefitting from a unified
                ecosystem for Da'wah and Academics everyday.
              </p>
            </header>

            <section className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4 mt-5">
              <div className="flex items-start gap-4">
                <img
                  src={sideImage}
                  alt="user"
                  className="h-12 w-12 rounded-full object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Abdulwarith Salman</h3>
                  <p className="text-sm text-white/80">
                    Product Manager at Pythagoras
                  </p>
                </div>
              </div>
              <p className="text-white/90 text-sm leading-relaxed italic">
                "Pythagoras has completely transformed how our team
                collaborates. Intuitive interface and powerful features make
                complex projects feel effortless."
              </p>
            </section>

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
          </aside>

          <section className="flex items-center justify-center p-12 bg-white">
            <div className="w-full max-w-md space-y-6">
              <header className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2A742F]/20 to-[#04AF43]/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-[#2A742F]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              </header>

              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-semibold text-[#000000]">
                  Verify Your Email
                </h2>
                <p className="text-sm text-[#4B5563]">
                  We've sent a verification code to your email. Please enter it
                  below.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerify();
                }}
              >
                <div
                  className="flex gap-3 justify-center py-4"
                  onPaste={handlePaste}
                >
                  {code.map((digit, index) => {
                    const isFocused = focusedIndex === index;
                    return (
                      <input
                        key={index}
                        ref={inputRefs.current[index]}
                        type="text"
                        inputMode="numeric"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onFocus={() => setFocusedIndex(index)}
                        onBlur={() => setFocusedIndex(null)}
                        className={`w-14 h-14 text-center text-2xl font-semibold border-2 rounded-lg focus:ring-2 focus:ring-[#6a9e6d] focus:border-[#6a9e6d] focus:outline-none transition-all ${
                          isFocused
                            ? "border-[#6a9e6d] text-[#6a9e6d]"
                            : "border-gray-300 text-gray-700"
                        }`}
                      />
                    );
                  })}
                </div>

                <footer className="text-center text-sm text-[#4B5563] mb-1">
                  Didn't receive code?{" "}
                  <button
                    onClick={handleResend}
                    className="text-[#2A742F] font-medium hover:underline transition-all"
                  >
                    Resend it
                  </button>
                </footer>

                <button
                  onClick={handleVerify}
                  disabled={isDisabled}
                  className="w-full py-3 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    "Continue"
                  )}
                </button>
              </form>
            </div>
          </section>
        </div>
      </section>

      <section className="lg:hidden relative z-10 w-full min-h-screen flex flex-col items-center justify-between px-4 py-10">
        <div className="w-full max-w-md space-y-10 flex-1 flex flex-col justify-center">
          <header className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-[#2A742F]/15 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#2A742F]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </header>

          <section className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold text-[#2A742F]">
              Verify Your Email
            </h2>
            <p className="text-sm text-[#2A742F]/80">
              We've sent a verification code to your email. Please enter it
              below.
            </p>
          </section>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="space-y-6"
          >
            <div className="flex gap-3 justify-center" onPaste={handlePaste}>
              {code.map((digit, index) => {
                const isFocused = focusedIndex === index;
                return (
                  <input
                    key={index}
                    ref={inputRefs.current[index]}
                    type="text"
                    inputMode="numeric"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onFocus={() => setFocusedIndex(index)}
                    onBlur={() => setFocusedIndex(null)}
                    className={`w-14 h-14 text-center text-2xl font-semibold border-2 rounded-lg bg-white text-[#2A742F] focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all ${
                      isFocused
                        ? "border-[#2A742F] text-[#2A742F]"
                        : "border-gray-300 text-gray-700"
                    }`}
                  />
                );
              })}
            </div>

            <footer className="text-center text-sm text-[#2A742F]">
              Didn't receive code?
              <button
                onClick={handleResend}
                className="text-[#04AF43] font-semibold hover:underline transition-all"
              >
                Resend it
              </button>
            </footer>

            <button
              onClick={handleVerify}
              disabled={isDisabled}
              className="w-full max-w-md py-3 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] hover:shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Verifying..." : "Continue"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default VerificationCode;
