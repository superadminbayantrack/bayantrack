import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Maximize2, MessageCircle, Minimize2, Send, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

type ActionDef = {
  label: string;
  type: "link" | "call" | "location";
  payload: string;
};

type Message = {
  id: number;
  text: string;
  isBot: boolean;
  actions?: ActionDef[];
  showOptions?: boolean;
  isEmergency?: boolean;
};

type Intent = {
  name: string;
  keywords: string[];
  response: string | ((ctx: LiveKnowledge) => string);
  actions?: ActionDef[] | ((ctx: LiveKnowledge) => ActionDef[]);
  showOptions?: boolean;
};

type EmergencyIntent = {
  keywords: string[];
  response: string;
  actions: ActionDef[];
};

type LiveAnnouncement = { title: string; content?: string; module?: string };
type LiveService = { code: string; title: string; requirements?: string[]; desc?: string };
type LiveDepartment = { name: string; localNumber?: string; contactPerson?: string };
type LiveKnowledge = {
  announcements: LiveAnnouncement[];
  services: LiveService[];
  departments: LiveDepartment[];
};

const EMERGENCY_INTENTS: EmergencyIntent[] = [
  {
    keywords: ["help", "help!", "help!!", "tulong", "saklolo", "emergency", "urgent"],
    response: [
      "Mukhang emergency ito.",
      "",
      "1. Pumunta muna sa ligtas na lugar kung kaya.",
      "2. Sabihin ang eksaktong lokasyon o pinakamalapit na landmark.",
      "3. Sabihin kung kailangan ng pulis, ambulansya, bumbero, o barangay responder.",
      "",
      "Kung hindi ka makapag-type, gamitin ang call o share location sa ibaba.",
    ].join("\n"),
    actions: [
      { label: "Call 911", type: "call", payload: "911" },
      { label: "Call Barangay Hotline", type: "call", payload: "0464170000" },
      { label: "Share Location", type: "location", payload: "" },
    ],
  },
  {
    keywords: ["sunog", "fire", "usok", "baha", "flood", "lindol", "earthquake", "evacuate", "likas"],
    response: [
      "Para sa sunog, baha, lindol, o paglikas:",
      "",
      "Lumayo agad sa panganib. Huwag bumalik sa loob ng bahay o building kung hindi pa ligtas. Kung baha, iwasan ang malalim o mabilis na tubig.",
      "",
      "Sabihin ang lokasyon, uri ng sakuna, at kung may na-trap o nasaktan.",
    ].join("\n"),
    actions: [
      { label: "Call Fire Department", type: "call", payload: "0464176060" },
      { label: "Find Evacuation Center", type: "link", payload: "/announcements/barangay-updates" },
      { label: "Share Location", type: "location", payload: "" },
    ],
  },
  {
    keywords: ["magnanakaw", "holdap", "baril", "nanakawan", "threat", "crime", "snatcher", "stalker", "natatakot"],
    response: [
      "Kung may krimen o banta sa seguridad:",
      "",
      "Unahin ang kaligtasan. Lumayo, magtago kung kailangan, at huwag makipag-away. Kapag ligtas na, tumawag sa pulis o barangay responder.",
      "",
      "Ihanda ang lokasyon, description ng nangyari, at kung may nasaktan.",
    ].join("\n"),
    actions: [
      { label: "Call Police", type: "call", payload: "0464176366" },
      { label: "Call Barangay Hotline", type: "call", payload: "0464170000" },
      { label: "Report Issue", type: "link", payload: "/ReportIssue" },
    ],
  },
  {
    keywords: ["ambulance", "medical", "nahihilo", "di makahinga", "dugo", "nasaktan", "seizure", "stroke", "heart"],
    response: [
      "Para sa medical emergency:",
      "",
      "Tumawag agad ng ambulansya o 911. Kung may posibleng injury sa leeg o likod, huwag galawin ang pasyente maliban kung nasa mas malaking panganib.",
      "",
      "Sabihin ang lokasyon, edad kung alam, sintomas, at kung gising at humihinga ang pasyente.",
    ].join("\n"),
    actions: [
      { label: "Call 911", type: "call", payload: "911" },
      { label: "Call Health Center", type: "call", payload: "0464173693" },
      { label: "Share Location", type: "location", payload: "" },
    ],
  },
];

const FAQ_INTENTS: Intent[] = [
  {
    name: "greeting",
    keywords: ["hello", "hi", "hey", "magandang", "good morning", "good afternoon", "kumusta"],
    response: "Magandang araw. Ako ang BayanTrack Help Assistant. Pwede kitang gabayan sa services, reports, contact, announcements, child access, at emergency information.",
    showOptions: true,
  },
  {
    name: "services",
    keywords: ["service", "services", "clearance", "indigency", "certificate", "barangay id", "document", "requirements", "kumuha", "request"],
    response: (ctx) => {
      if (ctx.services.length === 0) {
        return "Pwede kang mag-request ng barangay documents sa Services page. Piliin ang kailangan mong document, basahin ang requirements, at i-submit ang form.";
      }
      const list = ctx.services.slice(0, 4).map((service) => {
        const reqs = service.requirements?.length ? ` - Requirements: ${service.requirements.join(", ")}` : "";
        return `- ${service.title}${reqs}`;
      }).join("\n");
      return `Ito ang available online services ngayon:\n${list}\n\nKung may reference number ka na, pwede mo rin i-track ang request sa Services page.`;
    },
    actions: [{ label: "Open Services", type: "link", payload: "/services" }],
  },
  {
    name: "child-access",
    keywords: ["child", "children", "anak", "dependent", "relationship", "parent", "linked", "access", "otp"],
    response: [
      "Para sa child access:",
      "",
      "1. Sa Profile Settings, ilagay ang child name, child email, birth date, at relationship.",
      "2. Mag-send ng OTP sa parent email para makumpirma ang request.",
      "3. Pag na-approve ng barangay staff, ang child ay makaka-login gamit ang registered child email at parent account password.",
      "",
      "Pag naka-login, pwede siyang gumamit ng Services, Contact, at Report Issue under the parent account.",
    ].join("\n"),
    actions: [{ label: "Open Profile Settings", type: "link", payload: "/ProfileSettings" }],
  },
  {
    name: "report",
    keywords: ["report", "complain", "issue", "sumbong", "reklamo", "problem", "sirang", "streetlight", "garbage", "basura"],
    response: "Pwede kang mag-submit ng report online. Ilagay ang detalye, lokasyon, at photo kung meron para mas madaling maaksyunan ng barangay staff.",
    actions: [{ label: "Report an Issue", type: "link", payload: "/ReportIssue" }],
  },
  {
    name: "contact",
    keywords: ["contact", "message", "department", "office", "local number", "phone", "email", "tawag", "punta"],
    response: (ctx) => {
      const departments = ctx.departments.slice(0, 3).map((dept) => `- ${dept.name}${dept.localNumber ? `: local ${dept.localNumber}` : ""}`).join("\n");
      return departments
        ? `Pwede kang mag-send ng message sa barangay office. Mga madalas hanapin:\n${departments}`
        : "Pwede kang mag-send ng message sa Contact page at piliin ang department na kailangan mo.";
    },
    actions: [{ label: "Open Contact Page", type: "link", payload: "/contact" }],
  },
  {
    name: "announcements",
    keywords: ["announcement", "announcements", "balita", "update", "latest", "advisory", "schedule", "meeting", "ayuda", "relief"],
    response: (ctx) => {
      const top = ctx.announcements[0];
      if (!top) return "Tingnan ang Announcements page para sa latest barangay updates, advisories, schedules, at public notices.";
      return `Latest update:\n${top.title}\n${top.content || ""}\n\nBuksan ang Announcements page para makita ang iba pang notices.`;
    },
    actions: [{ label: "View Announcements", type: "link", payload: "/announcements" }],
  },
  {
    name: "evacuation",
    keywords: ["evacuation", "evacuation center", "likasan", "lilikasan", "saan lilikas", "nearest evacuation", "malapit na evacuation"],
    response: "Pwede mong gamitin ang Find Nearest Evacuation Center sa Barangay Updates. Kung hindi pinayagan ang location, gagamit ito ng Mambog II reference location para makapagbigay pa rin ng gabay.",
    actions: [{ label: "Find Evacuation Center", type: "link", payload: "/announcements/barangay-updates" }],
  },
  {
    name: "hotlines",
    keywords: ["hotline", "number", "emergency number", "pulis", "bumbero", "ambulansya", "rescue"],
    response: "Para sa urgent concerns, tumawag agad sa emergency hotlines. Nasa Emergency Hotlines page ang updated numbers ng barangay at nearby responders.",
    actions: [{ label: "Emergency Hotlines", type: "link", payload: "/announcements/emergency-hotlines" }],
  },
  {
    name: "privacy",
    keywords: ["privacy", "terms", "password", "safe", "account", "data", "personal information"],
    response: "Gamitin ang account nang responsable. Huwag ipasa ang password sa hindi approved na tao. Ang information na isusubmit mo ay ginagamit para ma-verify ang requests, magpadala ng updates, at matulungan kang ma-process ng barangay staff.",
    actions: [
      { label: "Privacy Policy", type: "link", payload: "/privacy" },
      { label: "Terms", type: "link", payload: "/terms" },
    ],
  },
];

const QUICK_ACTIONS = ["Request clearance", "Report an issue", "Child access", "Emergency hotlines"];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreIntent(text: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => {
    const term = keyword.toLowerCase();
    if (text === term) return score + 4;
    if (text.includes(term)) return score + 2;
    return score;
  }, 0);
}

function pickIntent<T extends { keywords: string[] }>(text: string, intents: T[]) {
  return intents
    .map((intent) => ({ intent, score: scoreIntent(text, intent.keywords) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.intent;
}

// Canvas requires a default export named App to render the preview correctly.
export default function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 font-sans">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-3xl font-bold text-[#3b528a]">BayanTrack Help Assistant</h1>
        <p className="mb-4 text-slate-500">Click the floating button in the bottom right corner to interact.</p>
      </div>
      <Chatbot />
    </div>
  );
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [liveAnnouncements, setLiveAnnouncements] = useState<LiveAnnouncement[]>([]);
  const [liveServices, setLiveServices] = useState<LiveService[]>([]);
  const [liveDepartments, setLiveDepartments] = useState<LiveDepartment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Magandang araw. Paano kita matutulungan sa BayanTrack?",
      isBot: true,
      showOptions: true,
    },
  ]);

  const liveKnowledge = useMemo<LiveKnowledge>(() => ({
    announcements: liveAnnouncements,
    services: liveServices,
    departments: liveDepartments,
  }), [liveAnnouncements, liveServices, liveDepartments]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const loadKnowledge = async () => {
      try {
        const [announcementsRes, servicesRes, departmentsRes] = await Promise.all([
          api.get("/api/announcements?limit=10"),
          api.get("/api/services/catalog"),
          api.get("/api/contact/departments"),
        ]);
        setLiveAnnouncements(Array.isArray(announcementsRes.data) ? announcementsRes.data : []);
        setLiveServices(Array.isArray(servicesRes.data) ? servicesRes.data : []);
        setLiveDepartments(Array.isArray(departmentsRes.data) ? departmentsRes.data : []);
      } catch {
        setLiveAnnouncements([]);
        setLiveServices([]);
        setLiveDepartments([]);
      }
    };
    void loadKnowledge();
  }, [isOpen]);

  const processMessage = (text: string): Message => {
    const cleaned = normalize(text);
    const emergency = pickIntent(cleaned, EMERGENCY_INTENTS);
    if (emergency) {
      return {
        id: Date.now() + 1,
        text: emergency.response,
        isBot: true,
        actions: emergency.actions,
        isEmergency: true,
      };
    }

    const faq = pickIntent(cleaned, FAQ_INTENTS);
    if (faq) {
      const response = typeof faq.response === "function" ? faq.response(liveKnowledge) : faq.response;
      const actions = typeof faq.actions === "function" ? faq.actions(liveKnowledge) : faq.actions;
      return {
        id: Date.now() + 1,
        text: response,
        isBot: true,
        actions,
        showOptions: faq.showOptions,
      };
    }

    return {
      id: Date.now() + 1,
      text: "Hindi ko pa sigurado ang ibig mong sabihin. Pwede mong i-type ang mas specific na tanong, halimbawa: paano kumuha ng clearance, paano mag-report, child access, hotlines, o latest announcements.",
      isBot: true,
      showOptions: true,
    };
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now(), text, isBot: false };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    window.setTimeout(() => {
      setMessages((prev) => [...prev, processMessage(text)]);
    }, 450);
  };

  const handleActionClick = (action: ActionDef) => {
    if (action.type === "call") {
      window.location.href = `tel:${action.payload}`;
      return;
    }

    if (action.type === "location") {
      const shared: Message = { id: Date.now(), text: "I want to share my current location.", isBot: false };
      setMessages((prev) => [...prev, shared]);
      if (!navigator.geolocation) {
        setMessages((prev) => [...prev, {
          id: Date.now() + 1,
          text: "Location sharing is not available on this device. Please type your address or nearest landmark.",
          isBot: true,
          isEmergency: true,
        }]);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMessages((prev) => [...prev, {
            id: Date.now() + 1,
            text: `Location captured. Latitude: ${position.coords.latitude.toFixed(5)}, Longitude: ${position.coords.longitude.toFixed(5)}. Please also send your nearest landmark so responders can find you faster.`,
            isBot: true,
            isEmergency: true,
          }]);
        },
        () => {
          setMessages((prev) => [...prev, {
            id: Date.now() + 1,
            text: "Location permission was not granted. Please type your exact address or nearest landmark.",
            isBot: true,
            isEmergency: true,
          }]);
        },
      );
      return;
    }

    window.location.href = action.payload;
  };

  return (
    <div className="fixed bottom-4 right-3 z-[100] sm:bottom-6 sm:right-6">
      <button
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
            setIsExpanded(false);
            return;
          }
          setIsOpen(true);
        }}
        className={cn(
          "flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-105",
          isOpen ? "bg-red-500" : "bg-[#3b528a]",
        )}
        type="button"
        aria-label={isOpen ? "Close help assistant" : "Open help assistant"}
      >
        {isOpen ? <X className="h-8 w-8 text-white" /> : <MessageCircle className="h-8 w-8 text-white" />}
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute bottom-20 right-0 flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.2)] transition-all",
            isExpanded ? "h-[82vh] max-h-[82vh] w-[92vw] max-w-[560px]" : "h-[600px] max-h-[85vh] w-[min(92vw,380px)] md:w-[420px]",
          )}
        >
          <div className="relative shrink-0 bg-[#3b528a] p-5 text-white">
            <div className="mb-1 flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-blue-200" />
              <h3 className="text-lg font-bold">BayanTrack Help</h3>
              <button
                className="ml-auto inline-flex rounded-md p-1 text-white/70 transition-colors hover:text-white"
                onClick={() => setIsExpanded((value) => !value)}
                title={isExpanded ? "Minimize chat" : "Maximize chat"}
                type="button"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">Resident guide</p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-5">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.isBot ? "items-start" : "items-end"}`}>
                <div
                  className={cn(
                    "max-w-[90%] whitespace-pre-wrap rounded-2xl p-4 text-[14.5px] font-medium leading-relaxed shadow-sm",
                    msg.isBot
                      ? msg.isEmergency
                        ? "rounded-tl-sm border border-red-200 bg-red-50 text-red-900"
                        : "rounded-tl-sm border border-gray-100 bg-white text-slate-700"
                      : "rounded-tr-sm bg-[#3b528a] text-white",
                  )}
                >
                  <p>{msg.text}</p>
                  {msg.actions?.length ? (
                    <div className="mt-4 flex flex-col gap-2">
                      {msg.actions.map((action) => (
                        <button
                          key={`${action.type}-${action.label}`}
                          onClick={() => handleActionClick(action)}
                          className={cn(
                            "inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm font-bold shadow-sm transition-all",
                            action.type === "call"
                              ? "bg-red-600 text-white hover:bg-red-700"
                              : action.type === "location"
                                ? "bg-slate-800 text-white hover:bg-slate-900"
                                : "bg-[#638ECB] text-white hover:bg-[#4b77b8]",
                          )}
                          type="button"
                        >
                          {action.label}
                          {action.type === "link" ? <ArrowRight size={14} strokeWidth={2.5} /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {msg.showOptions ? (
                  <div className="mt-3 flex max-w-[90%] flex-wrap gap-2 pl-1">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action}
                        onClick={() => handleSendMessage(action)}
                        className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-bold text-slate-600 shadow-sm transition-all hover:border-[#3b528a] hover:text-[#3b528a]"
                        type="button"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t border-gray-100 bg-white p-4">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage(inputValue);
                }}
                placeholder="I-type ang tanong mo dito..."
                className="w-full rounded-2xl border border-gray-200 bg-slate-50 px-5 py-3.5 pr-14 text-sm font-medium transition-all focus:border-[#3b528a] focus:outline-none focus:ring-1 focus:ring-[#3b528a]"
              />
              <button
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim()}
                className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#3b528a] text-white transition-colors hover:bg-[#2e4170] disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                aria-label="Send message"
              >
                <Send className="ml-0.5 h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1 text-center text-[10px] font-medium text-gray-400">
              <AlertTriangle size={12} className="text-red-500" />
              Para sa emergency, type "help" o tumawag agad sa 911.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
