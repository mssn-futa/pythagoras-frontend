import { Link } from "react-router-dom";

/**
 * Feature-owned entry point for the Da'wah area and PLAT-07 navigation, so those
 * pages link to the student quizzes without this package editing them.
 */
export default function QuizzesEntryLink({ children = "Quizzes", className = "" }) {
  return (
    <Link to="/dawah/quizzes" className={className}>
      {children}
    </Link>
  );
}
