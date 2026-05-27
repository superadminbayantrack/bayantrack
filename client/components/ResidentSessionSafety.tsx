import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { clearAuthSession, getRole, hasAuthSession, hasChildSession } from "@/lib/auth";

const RESIDENT_FOCUS_TIMEOUT_MS = 3 * 60 * 1000;

export function ResidentSessionSafety() {
  const location = useLocation();
  const navigate = useNavigate();
  const awaySinceRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const isLoginRoute = location.pathname === "/" || location.pathname === "/login";
    const isResidentSession = !isLoginRoute && hasAuthSession() && getRole() === "resident";
    const isChildSession = hasChildSession();
    if (!isResidentSession || isChildSession) return;

    const clearTimer = () => {
      if (timeoutRef.current) {
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
      timeoutRef.current = window.setTimeout(logoutForSafety, RESIDENT_FOCUS_TIMEOUT_MS);
    };

    const checkReturn = () => {
      if (!awaySinceRef.current) return;
      const awayMs = Date.now() - awaySinceRef.current;
      awaySinceRef.current = null;
      clearTimer();
      if (awayMs >= RESIDENT_FOCUS_TIMEOUT_MS) logoutForSafety();
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
