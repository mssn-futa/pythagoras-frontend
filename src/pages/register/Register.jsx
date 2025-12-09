import React, { useState } from "react";
import bgImage from "/src/assets/imageOne.jpg";
import smallLogo from "/src/assets/imageOne.jpg";
import sideImage from "/src/assets/imageTen.png";


const Register = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (value) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleContinue = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>

      <div className="hidden lg:flex relative z-10 min-h-screen items-center justify-center px-10">
        <div className="w-full max-w-6xl bg-white/95 shadow-2xl rounded-2xl grid grid-cols-2 overflow-hidden border border-gray-200">
          <div className="p-12 flex flex-col justify-between bg-gradient-to-br from-[#2A742F] to-[#04AF43] text-white">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <img
                  src={smallLogo}
                  alt="logo"
                  className="h-10 w-10 object-contain"
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
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4">
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
            </div>

            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
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
            </div>
          </div>

          <div className="flex items-center justify-center p-12 bg-white">
            <div className="w-full max-w-md space-y-6">
              <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                <button className="flex-1 py-2 px-4 rounded-md text-sm font-medium text-[#4B5563] hover:bg-white transition-all">
                  Sign In
                </button>
                <button className="flex-1 py-2 px-4 rounded-md text-sm font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43] text-white shadow-sm">
                  Sign Up
                </button>
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-semibold text-[#000000]">
                  Create your account with Pythagoras
                </h2>
                <p className="text-sm text-[#4B5563]">
                  Enter your email to continue
                </p>
              </div>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#2A742F] focus:border-[#2A742F] focus:outline-none transition-all"
              />

              <button
                onClick={handleContinue}
                disabled={loading || !isValidEmail(email)}
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
                    <span>Loading...</span>
                  </>
                ) : (
                  "Continue"
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-300"></div>
                <span className="text-xs text-[#4B5563]">or continue with</span>
                <div className="h-px flex-1 bg-gray-300"></div>
              </div>

              <div className="space-y-3">
                <button className="w-full border border-gray-300 rounded-lg py-3 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-3">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </button>
                <button className="w-full border border-gray-300 rounded-lg py-3 text-sm font-medium hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-3">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Continue with Apple
                </button>
              </div>

              <p className="text-center text-sm text-[#4B5563]">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="text-[#2A742F] font-medium hover:underline transition-all"
                >
                  Login
                </a>
              </p>

              <p className="text-center text-xs text-[#4B5563] leading-relaxed">
                By continuing you agree to our{" "}
                <a className="text-[#2A742F] hover:underline transition-all cursor-pointer">
                  Terms & Conditions
                </a>{" "}
                and{" "}
                <a className="text-[#2A742F] hover:underline transition-all cursor-pointer">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden relative z-10 w-full min-h-screen px-4 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6">
          <div className="flex items-center gap-3 justify-center">
            <img
              src={smallLogo}
              alt="logo"
              className="h-10 w-10 object-contain"
            />
            <h1 className="text-2xl font-bold text-[#000000]">Pythagoras</h1>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-[#000000]">
              Create your account with Pythagoras
            </h2>
            <p className="text-sm text-[#4B5563]">
              Enter your email to continue
            </p>
          </div>

          <input
            type="email"
            placeholder="Enter your email"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-[#2A742F] focus:outline-none"
          />

          <button className="w-full py-3 rounded-lg text-white font-medium bg-gradient-to-r from-[#2A742F] to-[#04AF43]">
            Continue
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-300"></div>
            <span className="text-xs text-[#4B5563]">or continue with</span>
            <div className="h-px flex-1 bg-gray-300"></div>
          </div>

          <div className="space-y-3">
            <button className="w-full border border-gray-300 rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
            <button className="w-full border border-gray-300 rounded-lg py-3 text-sm font-medium flex items-center justify-center gap-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </button>
          </div>

          <p className="text-center text-sm text-[#4B5563]">
            Already have an account?{" "}
            <a href="/login" className="text-[#2A742F] font-medium">
              Login
            </a>
          </p>

          <p className="text-center text-xs text-[#4B5563] leading-relaxed">
            By continuing you agree to our{" "}
            <a className="text-[#2A742F]">Terms & Conditions</a> and{" "}
            <a className="text-[#2A742F]">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
