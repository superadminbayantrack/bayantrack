export type UserRole = "resident" | "admin" | "superadmin";

const ROLE_KEY = "role";
const TOKEN_KEY = "token";

export function normalizeRole(value: unknown): UserRole | null {
  const role = String(value || "").trim().toLowerCase();
  if (role === "resident" || role === "admin" || role === "superadmin") {
    return role;
  }
  return null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): UserRole | null {
  return normalizeRole(localStorage.getItem(ROLE_KEY));
}

export function setAuthSession(token: string, role: UserRole) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
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
