import * as React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogoutConfirmation } from '@/components/LogoutConfirmation';

import { Button } from "@/components/ui/button";
import { User, ChevronDown, Menu, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearAuthSession, getToken } from "@/lib/auth";
import { api } from "@/lib/api";
import brandLogo from "../../assets/brandlogo/brand_logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

function normalizeBrandText(value?: string) {
  const cleaned = String(value || "BayanTrack").replace(/\s*\+\s*$/g, "").replace(/\s+/g, " ").trim();
  return cleaned.toLowerCase() === "bayantrack" || !cleaned ? "BayanTrack" : cleaned;
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [user, setUser] = React.useState<any>(null);
  const [showLogoutDialog, setShowLogoutDialog] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [isAnnouncementsMenuOpen, setIsAnnouncementsMenuOpen] = React.useState(false);
  const [brandText, setBrandText] = React.useState("BayanTrack");

  React.useEffect(() => {
    const fetchUser = async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await api.get("/api/auth/user", {
            headers: { "x-auth-token": token },
          });
          setUser(res.data);
        } catch (err) {
          console.error("Failed to fetch user", err);
        }
      }
    };
    fetchUser();
  }, []);

  React.useEffect(() => {
    const fetchNotifications = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await api.get("/api/auth/notifications", {
          headers: { "x-auth-token": token },
        });
        setNotifications(res.data?.items || []);
      } catch (_err) {
        setNotifications([]);
      }
    };
    void fetchNotifications();
    const timer = window.setInterval(() => {
      void fetchNotifications();
    }, 8000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const fetchBrand = async () => {
      try {
        const res = await api.get("/api/content/site");
        setBrandText(normalizeBrandText(res.data?.navbarBrandText));
      } catch {
        setBrandText("BayanTrack");
      }
    };
    void fetchBrand();
  }, []);

  const navLinks = [
    { label: "Home", href: "/home" }, // ✅ FIXED
    { label: "About", href: "/about" },
    { label: "Officials", href: "/officials" },
    { label: "Services", href: "/services" },
    { label: "Weather", href: "/weather" },
    { label: "Contact", href: "/contact" },
  ];

  const announcementsItems = [
    { label: "All News & Updates", path: "/announcements" },
    { label: "Barangay Updates", path: "/announcements/barangay-updates" },
    { label: "Emergency Hotlines", path: "/announcements/emergency-hotlines" },
    { label: "PHIVOLCS Alerts", path: "/announcements/phivolcs-alerts" },
    { label: "Fact Check", path: "/announcements/fact-check" },
  ];

  const isAnnouncementsActive =
    location.pathname.startsWith("/announcements");

  const isReportActive = location.pathname.startsWith("/ReportIssue");

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      clearAuthSession();
      setUser(null);
      navigate("/login");
    }, 3000);
  };

  return (
    <>
    <header className="fixed top-0 z-50 w-full border-b border-gray-100 bg-white shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-3 sm:h-20 sm:px-4">

        {/* Logo */}
        <Link to="/home" className="flex shrink-0 items-center gap-2 sm:gap-3">
          <img src={brandLogo} alt="BayanTrack logo" className="h-12 w-12 rounded-full object-contain" />
          <div className="hidden sm:block">
            <span className="font-extrabold text-primary text-lg">
              {brandText}
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden xl:flex items-center gap-6">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.label}
                to={link.href}
                className={cn(
                  "text-sm font-semibold transition-colors hover:text-primary relative py-1",
                  isActive ? "text-primary" : "text-gray-500"
                )}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Announcements Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-1 text-sm font-semibold",
                  isAnnouncementsActive
                    ? "text-primary"
                    : "text-gray-500 hover:text-primary"
                )}
              >
                Announcements <ChevronDown className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60 p-2">
              {announcementsItems.map((item) => (
                <DropdownMenuItem key={item.label} asChild>
                  <Link to={item.path}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">

          <Link to="/ReportIssue" className="hidden md:block">
            <Button variant="destructive">Report Issue</Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                {user?.avatarImage ? (
                  <img src={user.avatarImage} alt="Profile" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5" />
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 p-2">
              {user && (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-bold text-slate-900">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    {user.actingChild ? (
                      <p className="mt-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">
                        Child user: {user.actingChild.fullName || user.actingChild.email}
                      </p>
                    ) : null}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <Link to="/ProfileSettings">Profile Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/ProfileSettings" className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notifications
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    {notifications.length}
                  </span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleLogoutClick}
                className="text-red-600"
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            className="p-2 xl:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle navigation menu"
            type="button"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 xl:hidden">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={cn("rounded-md px-3 py-2 text-sm font-semibold", location.pathname === link.href ? "bg-slate-100 text-primary" : "text-slate-600")}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => setIsAnnouncementsMenuOpen((v) => !v)}
              type="button"
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold",
                isAnnouncementsActive ? "bg-slate-100 text-primary" : "text-slate-600",
              )}
            >
              <span>Announcements</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isAnnouncementsMenuOpen ? "rotate-180" : "")} />
            </button>
            {isAnnouncementsMenuOpen && (
              <div className="ml-2 flex flex-col gap-1 border-l border-slate-200 pl-3">
                {announcementsItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm",
                      location.pathname === item.path ? "bg-slate-100 text-primary" : "text-slate-600",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
            <Link
              to="/ReportIssue"
              onClick={() => setIsMenuOpen(false)}
              className={cn("rounded-md px-3 py-2 text-sm font-semibold", isReportActive ? "bg-red-50 text-red-700" : "text-slate-600")}
            >
              Report Issue
            </Link>
            <Link
              to="/ProfileSettings"
              onClick={() => setIsMenuOpen(false)}
              className={cn("rounded-md px-3 py-2 text-sm font-semibold", location.pathname === "/ProfileSettings" ? "bg-slate-100 text-primary" : "text-slate-600")}
            >
              Profile Settings
            </Link>
          </nav>
        </div>
      )}

      <LogoutConfirmation 
        isOpen={showLogoutDialog}
        isLoggingOut={isLoggingOut}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={confirmLogout}
      />
    </header>
    <div className="h-16 sm:h-20" />
    </>
  );
}
