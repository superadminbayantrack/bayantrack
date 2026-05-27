import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { clearAuthSession, getRole, hasAuthSession, hasChildSession } from "@/lib/auth";

const RESIDENT_FOCUS_TIMEOUT_MS = 2 * 60 * 1000;
const CHILD_FOCUS_TIMEOUT_MS = 2 * 60 * 1000;
const ADMIN_FOCUS_TIMEOUT_MS = 3 * 60 * 1000;
const SUPERADMIN_FOCUS_TIMEOUT_MS = 3 * 60 * 1000;

export function ResidentSessionSafety() {
  const location = useLocation();
  const navigate = useNavigate();
  const awaySinceRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const isLoginRoute = location.pathname === "/" || location.pathname === "/login";
    const role = getRole();
    const isChildSession = hasChildSession();
    const timeoutMs = isChildSession
      ? CHILD_FOCUS_TIMEOUT_MS
      : role === "admin"
        ? ADMIN_FOCUS_TIMEOUT_MS
        : role === "superadmin"
          ? SUPERADMIN_FOCUS_TIMEOUT_MS
          : role === "resident"
            ? RESIDENT_FOCUS_TIMEOUT_MS
            : null;

    if (isLoginRoute || !hasAuthSession() || !timeoutMs) return;

    const clearTimer = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const logoutForSafety = () => {
      clearTimer();
      void api.post("/api/auth/logout").catch(() => undefined).finally(() => {
        clearAuthSession();
        navigate("/login?reason=session-timeout", { replace: true });
      });
    };

    const startAwayTimer = () => {
      if (!awaySinceRef.current) awaySinceRef.current = Date.now();
      clearTimer();
      timeoutRef.current = window.setTimeout(logoutForSafety, timeoutMs);
    };

    const checkReturn = () => {
      if (!awaySinceRef.current) return;
      const awayMs = Date.now() - awaySinceRef.current;
      awaySinceRef.current = null;
      clearTimer();
      if (awayMs >= timeoutMs) logoutForSafety();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        startAwayTimer();
      } else {
        checkReturn();
      }
    };

    window.addEventListener("blur", startAwayTimer);
    window.addEventListener("focus", checkReturn);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimer();
      window.removeEventListener("blur", startAwayTimer);
      window.removeEventListener("focus", checkReturn);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [location.pathname, navigate]);

  return null;
}
