import { assessmentAdminRoutes } from "../features/assessments/adminRoutes.jsx";
import { assessmentStudentRoutes } from "../features/assessments/studentRoutes.jsx";
import { communicationRoutes } from "../features/communication/routes.jsx";
import { dawahAdminRoutes } from "../features/dawah/adminRoutes.jsx";
import { dawahStudentRoutes } from "../features/dawah/studentRoutes.jsx";

/** Domain route slots, mounted under /admin + RequireAdmin by App. */
export const adminSlotRoutes = [...dawahAdminRoutes, ...assessmentAdminRoutes, ...communicationRoutes];

/** Domain route slots, mounted in the student Layout (RequireAuth unless `public`). */
export const studentSlotRoutes = [...dawahStudentRoutes, ...assessmentStudentRoutes];
