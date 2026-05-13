export type UserRole = "resident" | "admin" | "superadmin";

const ROLE_KEY = "role";
const TOKEN_KEY = "token";
let activeToken: string | null = null;
let activeRole: UserRole | null = null;

function clearPersistentAuthStorage() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(ROLE_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(ROLE_KEY);
  } catch (_err) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

clearPersistentAuthStorage();

export function normalizeRole(value: unknown): UserRole | null {
  const role = String(value || "").trim().toLowerCase();
  if (role === "resident" || role === "admin" || role === "superadmin") {
    return role;
  }
  return null;
}

export function getToken(): string | null {
  return activeToken;
}

export function getRole(): UserRole | null {
  return activeRole;
}

export function setAuthSession(token: string, role: UserRole) {
  activeToken = token;
  activeRole = role;
  clearPersistentAuthStorage();
}

export function clearAuthSession() {
  activeToken = null;
  activeRole = null;
  clearPersistentAuthStorage();
}

export function getRoleHome(role: UserRole | null): string {
  if (role === "admin") return "/admin-dashboard";
  if (role === "superadmin") return "/super-admin-dashboard";
  return "/home";
}

export function hasAllowedRole(
  currentRole: UserRole | null,
  allowedRoles?: UserRole[],
): boolean {
  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }
  return currentRole ? allowedRoles.includes(currentRole) : false;
}
