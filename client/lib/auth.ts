export type UserRole = "resident" | "admin" | "superadmin";

export type AuthSessionChild = {
  id?: string;
  fullName?: string;
  email?: string;
};

export type AuthSessionMeta = {
  actingChild?: AuthSessionChild | null;
  loginAt?: string;
};

const ROLE_KEY = "role";
const SESSION_KEY = "auth_session";
const SESSION_META_KEY = "auth_session_meta";
let activeRole: UserRole | null = null;
let activeSession = false;
let activeSessionMeta: AuthSessionMeta | null = null;

function getStoredValue(key: string): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
  } catch (_err) {
    return null;
  }
}

function setStoredValue(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch (_err) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (_fallbackErr) {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }
}

function clearPersistentAuthStorage() {
  if (typeof window === "undefined") return;

  try {
    // Remove legacy token keys from older builds. Current auth uses an httpOnly
    // cookie, so JavaScript should never store the JWT.
    window.localStorage.removeItem("token");
    window.localStorage.removeItem(ROLE_KEY);
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(SESSION_META_KEY);
    window.sessionStorage.removeItem("token");
    window.sessionStorage.removeItem(ROLE_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_META_KEY);
  } catch (_err) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export function normalizeRole(value: unknown): UserRole | null {
  const role = String(value || "").trim().toLowerCase();
  if (role === "resident" || role === "admin" || role === "superadmin") {
    return role;
  }
  return null;
}

function hydrateAuthSession() {
  activeRole = normalizeRole(getStoredValue(ROLE_KEY));
  activeSession = getStoredValue(SESSION_KEY) === "true";
  const storedMeta = getStoredValue(SESSION_META_KEY);
  if (!storedMeta) {
    activeSessionMeta = null;
    return;
  }

  try {
    const parsed = JSON.parse(storedMeta) as AuthSessionMeta;
    activeSessionMeta = {
      actingChild: normalizeChildSession(parsed?.actingChild) || null,
      loginAt: parsed?.loginAt || "",
    };
  } catch (_err) {
    activeSessionMeta = null;
  }
}

hydrateAuthSession();

export function getRole(): UserRole | null {
  if (!activeRole) activeRole = normalizeRole(getStoredValue(ROLE_KEY));
  return activeRole;
}

export function hasAuthSession(): boolean {
  if (!activeSession) activeSession = getStoredValue(SESSION_KEY) === "true";
  return activeSession;
}

export function getAuthSessionMeta(): AuthSessionMeta | null {
  if (!activeSessionMeta) hydrateAuthSession();
  return activeSessionMeta;
}

export function hasChildSession(): boolean {
  return Boolean(getAuthSessionMeta()?.actingChild?.id);
}

function normalizeChildSession(child?: AuthSessionChild | null): AuthSessionChild | null {
  if (!child) return null;
  const id = String(child.id || "").trim();
  const fullName = String(child.fullName || "").trim();
  const email = String(child.email || "").trim().toLowerCase();
  return {
    ...(id ? { id } : {}),
    ...(fullName ? { fullName } : {}),
    ...(email ? { email } : {}),
  };
}

export function setAuthSession(_token: string | undefined, role: UserRole, meta?: AuthSessionMeta) {
  activeRole = role;
  activeSession = true;
  activeSessionMeta = {
    actingChild: normalizeChildSession(meta?.actingChild) || null,
    loginAt: new Date().toISOString(),
  };
  clearPersistentAuthStorage();
  setStoredValue(ROLE_KEY, role);
  setStoredValue(SESSION_KEY, "true");
  setStoredValue(SESSION_META_KEY, JSON.stringify(activeSessionMeta));

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("bayantrack:user-updated"));
  }
}

export function clearAuthSession() {
  activeRole = null;
  activeSession = false;
  activeSessionMeta = null;
  clearPersistentAuthStorage();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("bayantrack:user-updated"));
  }
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
