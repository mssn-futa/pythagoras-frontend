import { Link } from "react-router-dom";
import bgImage from "../../../assets/imageOne.jpg";
import smallLogo from "../../../assets/imageOne.jpg";
import sideImage from "../../../assets/imageTen.png";

const tabBase = "flex-1 text-center py-2 px-4 rounded-md text-sm font-medium transition-all";
const tabActive = `${tabBase} bg-gradient-to-r from-[#2A742F] to-[#04AF43] text-white shadow-sm`;
const tabIdle = `${tabBase} text-[#4B5563] dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700`;

/**
 * Shared sign-in/sign-up frame: the existing branded two-column card on
 * large screens and the single card on small screens, with ONE form instance.
 */
export default function AuthShell({ active, title, subtitle, children, footer }) {
  return (
    <main className="min-h-screen w-full bg-cover bg-center relative" style={{ backgroundImage: `url(${bgImage})` }}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8 lg:px-10">
        <div className="w-full max-w-md lg:max-w-6xl bg-white dark:bg-black rounded-xl lg:rounded-2xl shadow-lg lg:shadow-2xl lg:grid lg:grid-cols-2 overflow-hidden lg:border lg:border-gray-200 dark:lg:border-gray-700">
          <aside className="hidden lg:flex p-12 flex-col justify-between bg-gradient-to-br from-[#2A742F] to-[#04AF43] text-white">
            <header className="space-y-4">
              <p className="text-4xl font-bold flex items-center gap-3">
                <img src={smallLogo} alt="" className="h-10 w-10 object-contain" />
                Pythagoras
              </p>
              <p className="text-xl text-white font-semibold leading-relaxed">
                Welcome to the central hub of productivity
              </p>
              <p className="text-white/90 text-base">
                A unified ecosystem for Muslim students' Da'wah and learning.
              </p>
            </header>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-4">
                <img src={sideImage} alt="" className="h-12 w-12 rounded-full object-cover" />
                <p className="flex-1 font-semibold text-lg">Your Islamic student hub</p>
              </div>
              <p className="text-white/90 text-sm leading-relaxed">
                Da'wah events, lectures and Arabic learning in one place.
              </p>
            </div>
          </aside>

          <div className="flex items-center justify-center p-8 lg:p-12">
            <section className="w-full max-w-md space-y-6">
              <div className="lg:hidden flex items-center gap-3 justify-center">
                <img src={smallLogo} alt="" className="h-10 w-10 object-contain" />
                <p className="text-2xl font-bold text-[#000000] dark:text-white">Pythagoras</p>
              </div>

              <nav aria-label="Account" className="hidden lg:flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <Link to="/sign-in" className={active === "sign-in" ? tabActive : tabIdle} aria-current={active === "sign-in" ? "page" : undefined}>
                  Sign In
                </Link>
                <Link to="/sign-up" className={active === "sign-up" ? tabActive : tabIdle} aria-current={active === "sign-up" ? "page" : undefined}>
                  Sign Up
                </Link>
              </nav>

              <div className="space-y-1">
                <h1 className="text-xl lg:text-2xl font-semibold text-[#000000] dark:text-white">{title}</h1>
                <p className="text-sm text-[#4B5563] dark:text-gray-300">{subtitle}</p>
              </div>

              {children}

              {footer && <p className="text-center text-sm text-[#4B5563] dark:text-gray-300">{footer}</p>}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
