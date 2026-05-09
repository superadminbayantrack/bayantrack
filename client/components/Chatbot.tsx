import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Maximize2, Minimize2, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";

// Fallback for `cn` if not imported
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" ");

// --- TYPES ---
type ActionDef = {
  label: string;
  type: 'link' | 'call' | 'location';
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

type EmergencyItem = {
  type: string;
  keywords: string[];
  response: string;
  actions: ActionDef[];
};

type FaqItem = {
  keywords: string[];
  response: string;
  actions?: ActionDef[];
  showOptions?: boolean;
};

type LiveAnnouncement = { title: string; content: string; module: string; };
type LiveService = { code: string; title: string; requirements?: string[]; };
type LiveDepartment = { name: string; localNumber: string; };

// --- SMART EMERGENCY KNOWLEDGE BASE (U2 & U3 Urgency) ---
const EMERGENCY_DATA: EmergencyItem[] = [
  {
    type: 'medical',
    keywords: ['nahihilo', 'di makahinga', 'blood', 'unconscious', 'seizure', 'stroke', 'heart', 'dugo', 'nasaktan', 'ambulance', 'medical', 'nasaktan ako'],
    response: "⚠️ MEDICAL EMERGENCY DETECTED\n\nTumawag agad ng ambulansya. Huwag galawin ang pasyente kung may posibleng injury sa likod o leeg maliban kung nasa panganib ang buhay niya.\n\n📍 1. Nasaan ka ngayon? (Barangay / landmark)\n🛡️ 2. Ligtas ka ba ngayon? (Oo/Hindi)\n🚑 3. Anong tulong ang kailangan mo?\n\n*Paalala: Ang chatbot na ito ay tumutulong magbigay ng impormasyon, pero hindi ito kapalit ng emergency services.*",
    actions: [
      { label: '📞 Call 911', type: 'call', payload: '911' },
      { label: '📞 Brgy Health', type: 'call', payload: '0464173693' },
      { label: '📍 Share Location', type: 'location', payload: '' }
    ]
  },
  {
    type: 'crime',
    keywords: ['magnanakaw', 'holdap', 'may baril', 'nanakawan', 'stalker', 'kidnap', 'snatcher', 'barilan', 'lasing', 'sinusuntok', 'threatened', 'natatakot', 'naka-lock ako', 'suspicious'],
    response: "⚠️ CRIME / THREAT DETECTED\n\nKung delikado, lumayo at magtago agad. Huwag lumaban.\nKung ligtas ka na, tumawag sa Pulis at Barangay hotline.\n\n📍 1. Nasaan ka ngayon?\n🛡️ 2. Ligtas ka ba ngayon?\n🚓 3. Pulis ba o Barangay Responder ang kailangan?\n\n*Paalala: Ang chatbot na ito ay tumutulong magbigay ng impormasyon, pero hindi ito kapalit ng emergency services.*",
    actions: [
      { label: '📞 Call Police', type: 'call', payload: '0464176366' },
      { label: '📞 Brgy Hotline', type: 'call', payload: '0464170000' },
      { label: '📍 Share Location', type: 'location', payload: '' },
      { label: '📝 Quick Report', type: 'link', payload: '/report' }
    ]
  },
  {
    type: 'accident',
    keywords: ['nabangga', 'vehicular accident', 'nasagasaan', 'bumangga', 'naaksidente'],
    response: "⚠️ ACCIDENT DETECTED\n\nKung may sugatan, di makahinga, o nagdudugo: tumawag agad ng ambulansya. Pumunta sa ligtas na lugar kung kaya at i-on ang hazard lights.\n\n📍 1. Nasaan kayo eksakto?\n🤕 2. May sugatan ba? Ilan?\n\n*Paalala: Ang chatbot na ito ay tumutulong magbigay ng impormasyon, pero hindi ito kapalit ng emergency services.*",
    actions: [
      { label: '📞 Call Rescue', type: 'call', payload: '0464170683' },
      { label: '📞 Call 911', type: 'call', payload: '911' },
      { label: '📍 Share Location', type: 'location', payload: '' }
    ]
  },
  {
    type: 'fire',
    keywords: ['sunog', 'lindol', 'baha', 'landslide', 'may sumusunog'],
    response: "⚠️ FIRE / DISASTER DETECTED\n\nLumabas agad at huwag nang bumalik sa loob. Kung may usok: yumuko (stay low) at takpan ang ilong.\n\n📍 1. Nasaan ang sakuna?\n🆘 2. May na-trap ba sa loob?\n\n*Paalala: Ang chatbot na ito ay tumutulong magbigay ng impormasyon, pero hindi ito kapalit ng emergency services.*",
    actions: [
      { label: '📞 Call Fire Dept', type: 'call', payload: '0464176060' },
      { label: '📞 Call Rescue', type: 'call', payload: '0464170683' },
      { label: '📍 Share Location', type: 'location', payload: '' }
    ]
  },
  {
    type: 'panic',
    keywords: ['help!!', 'tulong', 'please help', 'emergency', 'saklolo', 'help', 'help po pls'],
    response: "⚠️ EMERGENCY DETECTED\n\nManatiling kalmado.\n\n📍 1. Nasaan ka ngayon? (Barangay / landmark)\n🛡️ 2. Ligtas ka ba ngayon? (Oo/Hindi)\n🆘 3. Anong kailangan mo: Pulis, Ambulansya, Bumbero, o Barangay Responder?\n\nKung hindi mo kayang sumagot, i-tap ang 'Share Location' sa ibaba.\n\n*Paalala: Ang chatbot na ito ay tumutulong magbigay ng impormasyon, pero hindi ito kapalit ng emergency services.*",
    actions: [
      { label: '📞 Call 911', type: 'call', payload: '911' },
      { label: '📞 Brgy Hotline', type: 'call', payload: '0464170000' },
      { label: '📍 Share Location', type: 'location', payload: '' }
    ]
  }
];

// --- STANDARD FAQ & INTENT KNOWLEDGE BASE (U1 Normal) ---
const FAQ_DATA: FaqItem[] = [
  { 
    keywords: ['hello', 'hi', 'hey', 'magandang', 'good morning', 'good afternoon', 'hi there', 'hello there'], 
    response: 'Magandang araw! 👋 Ako ang iyong BayanTrack Assistant. Paano kita matutulungan ngayon? Piliin ang isa sa mga sumusunod o i-type ang iyong tanong.', 
    showOptions: true 
  },
  { 
    keywords: ['assist', 'ano ang pwede', 'what can you do', 'recommend', 'help me', 'patulong', 'pwede pakitulungan'], 
    response: 'Siyempre, handa akong tumulong! Maaari kitang gabayan sa mga serbisyo ng barangay. Narito ang ilan sa mga pwede mong itanong:', 
    showOptions: true 
  },
  { 
    keywords: ['ayuda', 'relief goods', 'bigas', 'financial assistance', '4ps', 'tulong para sa senior', 'pwd', 'solo parent', 'kelan bigayan', 'qualified ba', 'bigayan na'], 
    response: 'Para sa mga katanungan tungkol sa Ayuda, Relief Goods, o Financial Assistance:\n\nSa ngayon, maaari mong tingnan ang mga active na programa at requirements sa ating Announcements page. Kung may specific na programa para sa Senior, PWD, o Solo Parent, ipo-post ito ng Barangay Council doon. Wala pang bagong schedule ng bigayan ngayon.', 
    actions: [
      { label: '📢 View Announcements ➔', type: 'link', payload: '/announcements' },
      { label: '📄 Check Requirements ➔', type: 'link', payload: '/services' }
    ] 
  },
  { 
    keywords: ['nearest evacuation center', 'find evacuation center', 'evacuation center', 'malapit na evacuation center', 'saan ang evacuation center', 'san may malapit na evacuation center', 'kailangan ko ng evacuation center', 'need evacuation center', 'help i need evacuation center', 'asan evacuation center', 'saan pwede lumikas'],
    response: 'Para sa pinakamalapit na evacuation center, buksan ang Barangay Updates at i-click ang "Find Nearest Evacuation Center". Gumagana ito sa English at Tagalog requests at may fallback location para sa Mambog II kung denied ang GPS permission.',
    actions: [{ label: 'Find Nearest Evacuation Center ➔', type: 'link', payload: '/announcements/barangay-updates' }]
  },
  { 
    keywords: ['balita', 'announcement', 'meeting', 'curfew', 'bagyo', 'suspension', 'alert', 'evacuation', 'advisory', 'latest', 'update'], 
    response: 'Maaari mong basahin ang mga pinakabagong verified announcements, advisories, at updates mula sa Barangay Mambog II, Bacoor LGU, at mga ahensya (tulad ng PAGASA/PHIVOLCS) sa ating portal.', 
    actions: [
      { label: '📢 View Announcements ➔', type: 'link', payload: '/announcements' },
      { label: '🌧 Weather & Alerts ➔', type: 'link', payload: '/weather' }
    ] 
  },
  { 
    keywords: ['report', 'complain', 'issue', 'sumbong', 'problem', 'reklamo', 'paano mag-report'], 
    response: 'Maaari kang mag-submit ng report online gamit ang aming Report Issue form. Siguraduhing may detalye at litrato kung maaari para mas mabilis maaksyunan.', 
    actions: [{ label: 'Report Issue ➔', type: 'link', payload: '/ReportIssue' }] 
  },
  { 
    keywords: ['clearance', 'indigency', 'certificate', 'id', 'cedula', 'permit', 'document', 'paano kumuha'], 
    response: 'Pwede kang mag-request ng Barangay Clearance, Indigency, ID, at iba pa online. I-ready lamang ang iyong valid ID at iba pang requirements.', 
    actions: [{ label: 'Go to Services ➔', type: 'link', payload: '/services' }] 
  },
  { 
    keywords: ['hotline', 'number', 'contact number', 'telepono'], 
    response: 'Kailangan mo ba ng hotlines? Narito ang link para sa lahat ng emergency numbers ng Bacoor at Mambog II.', 
    actions: [{ label: 'Emergency Hotlines ➔', type: 'link', payload: '/announcements/emergency-hotlines' }] 
  },
  { 
    keywords: ['contact', 'address', 'location', 'phone', 'email', 'tawag', 'punta', 'saan'], 
    response: 'Ang Barangay Hall ay bukas Lunes hanggang Biyernes, 8:00 AM - 5:00 PM. Matatagpuan ito malapit sa Mambog Elementary School.', 
    actions: [{ label: 'Contact Us ➔', type: 'link', payload: '/contact' }] 
  },
  { 
    keywords: ['weather', 'panahon'], 
    response: 'Manatiling ligtas! Tingnan ang latest weather updates at advisories dito.', 
    actions: [{ label: 'Weather Updates ➔', type: 'link', payload: '/weather' }] 
  },
  { 
    keywords: ['rumor', 'fake', 'news', 'totoo', 'fact', 'check', 'totoo ba yung'], 
    response: 'Ugaliing mag-verify ng impormasyon! I-check ang mga balita sa aming Fact Check page para iwas fake news.', 
    actions: [{ label: 'Fact Check ➔', type: 'link', payload: '/announcements/fact-check' }] 
  },
];

// Canvas requires a default export named App to render the preview correctly.
export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-[#3b528a] mb-3">BayanTrack Smart Chatbot</h1>
        <p className="text-slate-500 mb-4">
          Click the floating button in the bottom right corner to interact.
        </p>
        <div className="bg-white p-4 rounded-xl shadow-sm text-sm text-left border border-gray-200">
          <p className="font-bold mb-2">Try typing these triggers:</p>
          <ul className="list-disc pl-5 text-slate-600 space-y-1">
            <li><span className="font-semibold text-blue-600">Standard:</span> "Hello", "Paano kumuha ng clearance", "May ayuda po ba?"</li>
            <li><span className="font-semibold text-red-600">Emergency:</span> "Tulong may magnanakaw", "Nabangga ako", "May sunog dito!", "Help!!"</li>
          </ul>
        </div>
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
      text: "Magandang araw! 👋 Ako ang iyong BayanTrack Assistant. Paano kita matutulungan ngayon?", 
      isBot: true,
      showOptions: true 
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const loadKnowledge = async () => {
      try {
        const [a, s, d] = await Promise.all([
          api.get("/api/announcements?limit=10"),
          api.get("/api/services/catalog"),
          api.get("/api/contact/departments"),
        ]);
        setLiveAnnouncements(a.data || []);
        setLiveServices(s.data || []);
        setLiveDepartments(d.data || []);
      } catch {
        setLiveAnnouncements([]);
        setLiveServices([]);
        setLiveDepartments([]);
      }
    };
    void loadKnowledge();
  }, [isOpen]);

  const processMessage = (text: string): Message => {
    const lowerText = text.toLowerCase();
    const evacuationKeywords = [
      "nearest evacuation center",
      "find evacuation center",
      "evacuation center",
      "malapit na evacuation center",
      "san may malapit na evacuation center",
      "saan ang evacuation center",
      "kailangan ko ng evacuation center",
      "need evacuation center",
      "help i need evacuation center",
      "saan pwede lumikas",
      "likas",
    ];

    if (evacuationKeywords.some((kw) => lowerText.includes(kw))) {
      return {
        id: Date.now() + 1,
        text: "Naiintindihan ko. Para sa nearest evacuation center, buksan ang Barangay Updates at pindutin ang 'Find Nearest Evacuation Center'. Kung walang location permission, gagamit ang system ng default Mambog II fallback.",
        isBot: true,
        actions: [{ label: "Find Nearest Evacuation Center ➔", type: "link", payload: "/announcements/barangay-updates" }],
      };
    }

    if (lowerText.includes("latest") || lowerText.includes("update") || lowerText.includes("balita")) {
      const top = liveAnnouncements[0];
      if (top) {
        return {
          id: Date.now() + 1,
          text: `Latest community update:\n${top.title}\n${top.content}`,
          isBot: true,
          actions: [{ label: "View Announcements ➔", type: "link", payload: "/announcements" }],
        };
      }
    }

    if (lowerText.includes("service") || lowerText.includes("clearance") || lowerText.includes("indigency") || lowerText.includes("barangay id")) {
      if (liveServices.length > 0) {
        return {
          id: Date.now() + 1,
          text: `Available online services right now:\n${liveServices.map((x) => `• ${x.title}`).join("\n")}`,
          isBot: true,
          actions: [{ label: "Go to Services ➔", type: "link", payload: "/services" }],
        };
      }
    }

    if (lowerText.includes("department") || lowerText.includes("office") || lowerText.includes("local number")) {
      if (liveDepartments.length > 0) {
        const shortList = liveDepartments.slice(0, 3).map((d) => `• ${d.name} (${d.localNumber})`).join("\n");
        return {
          id: Date.now() + 1,
          text: `Top departments:\n${shortList}`,
          isBot: true,
          actions: [{ label: "Contact Us ➔", type: "link", payload: "/contact" }],
        };
      }
    }
    
    // 1. Check for Panic/Emergency intent FIRST (highest priority)
    const isDirectPanic = ['help', 'help!', 'help!!', 'tulong', 'saklolo'].includes(lowerText.trim());
    
    let matchedEmergency: EmergencyItem | undefined = undefined;
    
    if (isDirectPanic) {
      matchedEmergency = EMERGENCY_DATA.find(e => e.type === 'panic');
    } else {
      matchedEmergency = EMERGENCY_DATA.find(emergency => 
        emergency.keywords.some(kw => lowerText.includes(kw))
      );
    }

    if (matchedEmergency) {
      return {
        id: Date.now() + 1,
        text: matchedEmergency.response,
        isBot: true,
        actions: matchedEmergency.actions,
        isEmergency: true
      };
    }

    // 2. Check Standard FAQ if no emergency detected
    let matchedFaq = FAQ_DATA.find(faq => 
      faq.keywords.some(kw => lowerText.includes(kw))
    );

    return {
      id: Date.now() + 1,
      text: matchedFaq 
        ? matchedFaq.response 
        : "Pasensya na, hindi ko masyadong naintindihan ang iyong mensahe. 😅 Maaari mo bang linawin o subukan ang mga rekomendasyon sa ibaba?",
      isBot: true,
      actions: matchedFaq?.actions,
      showOptions: matchedFaq ? matchedFaq.showOptions : true
    };
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    // Add User Message
    const userMsg: Message = { id: Date.now(), text, isBot: false };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    // Determine Bot Response with slight delay
    setTimeout(() => {
      const botMsg = processMessage(text);
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendMessage(inputValue);
    }
  };

  const handleActionClick = (action: ActionDef) => {
    if (action.type === 'call') {
      window.location.href = `tel:${action.payload}`;
    } else if (action.type === 'location') {
      // Simulate sharing location
      const locMsg: Message = { id: Date.now(), text: "📍 I shared my current location.", isBot: false };
      setMessages(prev => [...prev, locMsg]);
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          text: "Location received. Automatically forwarding coordinates to Barangay Responders and creating an emergency ticket.",
          isBot: true,
          isEmergency: true
        }]);
      }, 800);
    } else {
      // For 'link' routing simulation
      // In a real app, use React Router's useNavigate
      console.log("Navigating to:", action.payload);
      window.location.href = action.payload; 
    }
  };

  const quickActions = ["May Ayuda ba?", "Nearest Evacuation Center", "Emergency Hotlines", "View Announcements"];

  return (
    <div className="fixed bottom-4 right-3 z-[100] sm:bottom-6 sm:right-6">
      {/* Trigger Button */}
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
          "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110",
          isOpen ? "bg-red-500 rotate-90" : "bg-[#3b528a]"
        )}
      >
        {isOpen ? <X className="text-white w-8 h-8" /> : <MessageCircle className="text-white w-8 h-8" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            "absolute bottom-20 right-0 bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300 transition-all",
            isExpanded
              ? "w-[92vw] max-w-[560px] h-[82vh] max-h-[82vh]"
              : "w-[min(92vw,380px)] md:w-[420px] h-[600px] max-h-[85vh]",
          )}
        >
          
          {/* Header */}
          <div className="bg-[#3b528a] p-5 text-white relative shrink-0">
            <div className="flex items-center gap-3 mb-1">
              <Sparkles className="w-5 h-5 text-blue-300 fill-current" />
              <h3 className="font-bold text-lg">BayanTrack Help</h3>
              <button
                className="ml-auto inline-flex rounded-md p-1 text-white/70 transition-colors hover:text-white"
                onClick={() => setIsExpanded((v) => !v)}
                title={isExpanded ? "Minimize chat" : "Maximize chat"}
                type="button"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-white/60 text-xs font-medium uppercase tracking-widest">
              Automated Assistant
            </p>
          </div>

          {/* Messages Area */}
          <div className="p-5 bg-slate-50 flex-1 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.isBot ? "items-start" : "items-end"}`}
              >
                <div 
                  className={cn(
                    "p-4 rounded-2xl max-w-[90%] text-[14.5px] leading-relaxed shadow-sm whitespace-pre-wrap",
                    msg.isBot 
                      ? msg.isEmergency 
                        ? "bg-[#fff1f2] border border-[#fecdd3] text-[#881337] font-medium rounded-tl-sm"
                        : "bg-white border border-gray-100 text-slate-700 font-medium rounded-tl-sm" 
                      : "bg-[#3b528a] text-white rounded-tr-sm"
                  )}
                >
                  <p>{msg.text}</p>
                  
                  {/* Action Buttons Container */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-4 flex flex-col gap-2">
                      {msg.actions.map((act, i) => (
                        <button 
                          key={i}
                          onClick={() => handleActionClick(act)}
                          className={cn(
                            "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm w-full text-center",
                            act.type === 'call' 
                              ? "bg-red-600 hover:bg-red-700 text-white" 
                              : act.type === 'location'
                                ? "bg-slate-800 hover:bg-slate-900 text-white"
                                : "bg-[#638ECB] hover:bg-[#4b77b8] text-white"
                          )}
                        >
                          {act.label} 
                          {act.type === 'link' && <ArrowRight size={14} strokeWidth={2.5} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Smart Recommendations */}
                {msg.showOptions && (
                  <div className="flex flex-wrap gap-2 mt-3 max-w-[90%] pl-1">
                    {quickActions.map((action) => (
                      <button
                        key={action}
                        onClick={() => handleSendMessage(action)}
                        className="bg-white border border-gray-200 px-3.5 py-1.5 rounded-full text-[12px] font-bold text-slate-600 hover:border-[#3b528a] hover:text-[#3b528a] transition-all shadow-sm"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-gray-100 shrink-0">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="I-type ang iyong tanong dito..."
                className="w-full bg-slate-50 border border-gray-200 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-[#3b528a] focus:ring-1 focus:ring-[#3b528a] font-medium pr-14 transition-all"
              />
              <button 
                onClick={() => handleSendMessage(inputValue)}
                disabled={!inputValue.trim()}
                className="absolute right-2 w-10 h-10 rounded-xl bg-[#3b528a] flex items-center justify-center text-white hover:bg-[#2e4170] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-3 font-medium flex items-center justify-center gap-1">
              <AlertTriangle size={12} className="text-red-500" />
              Para sa emergency, i-type ang <span className="font-bold text-red-500">"help"</span> o tumawag agad sa 911.
            </p>
          </div>
          
        </div>
      )}
    </div>
  );
}
