export const ROLES = Object.freeze({ STUDENT: "student", ADMIN: "admin" });

export function hasRole(user, role) {
  return Boolean(user && user.is_active !== false && user.role === role);
}

export function isAdmin(user) {
  return hasRole(user, ROLES.ADMIN);
}

export function isStudent(user) {
  return hasRole(user, ROLES.STUDENT);
}

/** Where a user lands after sign-in when no valid return path was supplied. */
export function defaultHomeFor(user) {
  return isAdmin(user) ? "/admin" : "/";
}
