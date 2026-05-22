import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Bot, FileText, Megaphone, ShieldAlert, UserCog, X } from "lucide-react";
import { getRole, hasAuthSession } from "@/lib/auth";

const TOUR_STORAGE_KEY = "bayantrack_resident_quick_tour_seen";

const tourSteps = [
  {
    title: "Ask the chatbot",
    body: "Use the chat button for quick help, service questions, reports, rumors, and emergency guidance.",
    icon: <Bot size={22} />,
    actionLabel: "Open home",
    path: "/home",
  },
  {
    title: "Check barangay updates",
    body: "Open Announcements to see barangay news, city advisories, PHIVOLCS alerts, hotlines, and fact checks.",
    icon: <Megaphone size={22} />,
    actionLabel: "View updates",
    path: "/announcements",
  },
  {
    title: "Send requests and reports",
    body: "Use Services for barangay documents and Report Issue for complaints, hazards, or rumors that need attention.",
    icon: <FileText size={22} />,
    actionLabel: "See services",
    path: "/services",
  },
  {
    title: "Keep your profile correct",
    body: "Go to Profile Settings to update your phone number, Mambog II address, password, and linked child access.",
    icon: <UserCog size={22} />,
    actionLabel: "Profile settings",
    path: "/ProfileSettings",
  },
  {
    title: "Emergency live help",
    body: "During urgent situations, the chatbot can guide you to share current location and start live chat with barangay staff.",
    icon: <ShieldAlert size={22} />,
    actionLabel: "Got it",
    path: "",
  },
];

export function ResidentQuickTour() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const blockedRoutes = ["/", "/login", "/admin-dashboard", "/super-admin-dashboard"];
    const isBlocked = blockedRoutes.includes(location.pathname);
    const alreadySeen = window.localStorage.getItem(TOUR_STORAGE_KEY) === "true";

    if (!isBlocked && hasAuthSession() && getRole() === "resident" && !alreadySeen) {
      const timer = window.setTimeout(() => setIsOpen(true), 650);
      return () => window.clearTimeout(timer);
    }
  }, [location.pathname]);

  if (!isOpen) return null;

  const currentStep = tourSteps[stepIndex];
  const isLastStep = stepIndex === tourSteps.length - 1;

  const closeTour = () => {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setIsOpen(false);
  };

  const handleAction = () => {
    if (currentStep.path) {
      navigate(currentStep.path);
    }
    if (isLastStep) {
      closeTour();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, tourSteps.length - 1));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-500">Quick Tour</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Want to learn BayanTrack?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Optional guide para mabilis mong makita kung saan gagamitin ang main features.</p>
          </div>
          <button
            type="button"
            onClick={closeTour}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
            aria-label="Close quick tour"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm">
              {currentStep.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-950">{currentStep.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{currentStep.body}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {tourSteps.map((step, index) => (
              <button
                key={step.title}
                type="button"
                onClick={() => setStepIndex(index)}
                className={`h-2.5 rounded-full transition-all ${index === stepIndex ? "w-8 bg-blue-600" : "w-2.5 bg-slate-200"}`}
                aria-label={`Go to tour step ${index + 1}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={closeTour} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50">
              Skip
            </button>
            <button type="button" onClick={handleAction} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800">
              {isLastStep ? "Finish" : currentStep.actionLabel}
              {!isLastStep ? <ArrowRight size={14} /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
