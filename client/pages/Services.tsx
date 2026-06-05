import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { Reveal } from "@/components/Reveal";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle, Clock, FileText, History, Search, X } from "lucide-react";
import { api, authHeaders } from "@/lib/api";
import { hasAuthSession } from "@/lib/auth";
import { FeedbackModal } from "@/components/FeedbackModal";
import { cleanPersonNameInput, isValidPersonName, personNameMessage } from "@/lib/validation";

type ServiceCatalog = {
  code: string;
  title: string;
  desc: string;
  usage: string;
  requirements: string[];
  time: string;
};

type ServiceRequest = {
  _id: string;
  referenceNo: string;
  serviceType: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

const HISTORY_PAGE_SIZE = 5;

const REQUIRED_SERVICES: ServiceCatalog[] = [
  {
    code: "barangay-clearance",
    title: "Barangay Clearance",
    desc: "Official document certifying good moral character and residency.",
    usage: "Employment, Bank Accounts",
    requirements: ["Valid ID", "Recent Cedula"],
    time: "15 Mins",
  },
  {
    code: "certificate-of-indigency",
    title: "Certificate of Indigency",
    desc: "Certification of financial status for assistance programs.",
    usage: "Medical Assistance, Scholarships",
    requirements: ["Valid ID", "Purok Leader Endorsement"],
    time: "15 Mins",
  },
  {
    code: "barangay-id",
    title: "Barangay ID",
    desc: "Identification card for verified barangay residents.",
    usage: "Barangay Transactions, Identity Verification",
    requirements: ["Valid ID", "Proof of Residency", "2x2 Photo"],
    time: "20 Mins",
  },
];

const iconMap: Record<string, typeof FileText> = {
  "barangay-clearance": FileText,
  "certificate-of-indigency": FileText,
  "barangay-id": FileText,
};

export default function Services() {
  const [services, setServices] = useState<ServiceCatalog[]>([]);
  const [content, setContent] = useState<{ servicesHeroTitle: string; servicesHeroSubtitle: string }>({
    servicesHeroTitle: "Online Services Portal",
    servicesHeroSubtitle: "Certificate of Indigency, Barangay Clearance, and Barangay ID requests with clear request tracking.",
  });
  const [history, setHistory] = useState<ServiceRequest[]>([]);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historySortOrder, setHistorySortOrder] = useState<"newest" | "oldest">("newest");
  const [historyPage, setHistoryPage] = useState(1);
  const [trackRef, setTrackRef] = useState("");
  const [tracked, setTracked] = useState<ServiceRequest | null>(null);
  const [formData, setFormData] = useState({ fullName: "", contactNumber: "", address: "", purpose: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [trackProgress, setTrackProgress] = useState(0);
  const [feedback, setFeedback] = useState<{ isOpen: boolean; title: string; message: string; type: "success" | "error" }>({
    isOpen: false,
    title: "",
    message: "",
    type: "error",
  });

  const activeService = useMemo(() => services.find((s) => s.code === activeCode), [activeCode, services]);
  const sortedHistory = useMemo(() => (
    [...history].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  ), [history]);
  const previewHistory = sortedHistory.slice(0, 3);
  const visiblePreviewHistory = previewHistory.slice(0, 1);
  const blurredPreviewHistory = previewHistory.slice(1);
  const extraHistoryCount = Math.max(0, sortedHistory.length - previewHistory.length);
  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return sortedHistory
      .filter((item) => !query || [item.referenceNo, item.serviceType, item.status].some((value) => String(value || "").toLowerCase().includes(query)))
      .sort((a, b) => {
        const diff = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        return historySortOrder === "newest" ? diff : -diff;
      });
  }, [historySearch, historySortOrder, sortedHistory]);
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistory = filteredHistory.slice(
    (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
    currentHistoryPage * HISTORY_PAGE_SIZE,
  );

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historySortOrder]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [catalogRes, contentRes] = await Promise.all([
        api.get("/api/services/catalog"),
        api.get("/api/content/site"),
      ]);
      const incoming = Array.isArray(catalogRes.data) ? catalogRes.data : [];
      const byCode = new Map(incoming.map((item: ServiceCatalog) => [item.code, item]));
      setServices(REQUIRED_SERVICES.map((svc) => byCode.get(svc.code) || svc));
      if (hasAuthSession()) {
        try {
          const historyRes = await api.get("/api/services/requests/me", { headers: authHeaders() });
          setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
        } catch {
          setHistory([]);
        }
      } else {
        setHistory([]);
      }
      setContent((prev) => ({
        servicesHeroTitle: contentRes?.data?.servicesHeroTitle || prev.servicesHeroTitle,
        servicesHeroSubtitle: contentRes?.data?.servicesHeroSubtitle || prev.servicesHeroSubtitle,
      }));
    } catch (err) {
      console.error("Failed to load services data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCode) return;
    if (!hasAuthSession()) {
      setFeedback({ isOpen: true, title: "Login Required", message: "Please log in as a resident before submitting a service request.", type: "error" });
      return;
    }
    if (!isValidPersonName(formData.fullName)) {
      setFeedback({ isOpen: true, title: "Invalid Name", message: personNameMessage("Full name"), type: "error" });
      return;
    }
    if (!/^09\d{9}$/.test(formData.contactNumber)) {
      setFeedback({ isOpen: true, title: "Invalid Contact", message: "Phone number must be 11 digits and start with 09.", type: "error" });
      return;
    }
    setIsSubmitting(true);
    setSubmitProgress(25);

    try {
      const res = await api.post(
        "/api/services/requests",
        {
          serviceType: activeCode,
          fullName: formData.fullName,
          contactNumber: formData.contactNumber,
          address: formData.address,
          purpose: formData.purpose,
        },
        { headers: authHeaders() },
      );

      setActiveCode(null);
      setShowRequestModal(false);
      setFormData({ fullName: "", contactNumber: "", address: "", purpose: "" });
      setFeedback({
        isOpen: true,
        title: "Request Submitted",
        message: `Your request was submitted successfully. Reference Number: ${res.data.referenceNo}`,
        type: "success",
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ isOpen: true, title: "Submit Failed", message: err.response?.data?.msg || "Failed to submit request", type: "error" });
    } finally {
      setSubmitProgress(100);
      setTimeout(() => { setIsSubmitting(false); setSubmitProgress(0); }, 300);
    }
  };

  const trackRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAuthSession()) {
      setFeedback({ isOpen: true, title: "Login Required", message: "Please log in as a resident before tracking private request records.", type: "error" });
      return;
    }
    setIsTracking(true);
    setTrackProgress(30);
    try {
      const res = await api.get(`/api/services/requests/track/${trackRef}`, { headers: authHeaders() });
      setTracked(res.data);
      setTrackRef("");
    } catch (err: any) {
      setFeedback({ isOpen: true, title: "Tracking Failed", message: err.response?.data?.msg || "Request not found", type: "error" });
    } finally {
      setTrackProgress(100);
      setTimeout(() => { setIsTracking(false); setTrackProgress(0); }, 250);
    }
  };

  useEffect(() => {
    if (!isSubmitting) return;
    const t = setInterval(() => setSubmitProgress((p) => (p >= 90 ? p : p + 8)), 220);
    return () => clearInterval(t);
  }, [isSubmitting]);

  useEffect(() => {
    if (!isTracking) return;
    const t = setInterval(() => setTrackProgress((p) => (p >= 90 ? p : p + 12)), 220);
    return () => clearInterval(t);
  }, [isTracking]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-12">
          <Reveal>
            <div className="mb-10 rounded-2xl bg-[#395886] p-6 text-white sm:p-10">
              <h1 className="text-2xl font-bold sm:text-3xl">{content.servicesHeroTitle}</h1>
              <p className="mt-2 text-blue-100">{content.servicesHeroSubtitle}</p>
            </div>
          </Reveal>

          {loading && <div className="mb-6 rounded-xl border bg-white p-4 text-sm text-slate-500">Loading services...</div>}


          <div className="mb-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-3 inline-flex rounded-md bg-blue-50 p-2 text-blue-700"><Search size={18} /></div>
              <h3 className="text-lg font-semibold text-slate-900">Track Your Request</h3>
              <p className="mt-1 text-sm text-slate-600">Track any submitted service request reference number.</p>
              <button className="mt-4 rounded-md border px-4 py-2 text-sm font-semibold" onClick={() => setShowTrackModal(true)} type="button">Track Now</button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-3 inline-flex rounded-md bg-blue-50 p-2 text-blue-700"><History size={18} /></div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Request History</h3>
                  <p className="mt-1 text-sm text-slate-600">Your latest submitted requests.</p>
                </div>
                {sortedHistory.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryPage(1);
                      setShowHistoryModal(true);
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    View All
                  </button>
                ) : null}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                {visiblePreviewHistory.map((item) => (
                  <div key={item._id} className="rounded border border-slate-200 p-2">
                    <p className="font-semibold text-slate-900">{item.referenceNo}</p>
                    <p className="text-slate-500">{item.serviceType} • {item.status}</p>
                  </div>
                ))}
                {blurredPreviewHistory.map((item) => (
                  <div key={item._id} className="pointer-events-none rounded border border-slate-200 bg-slate-50 p-2 opacity-70 blur-[1px]">
                    <p className="font-semibold text-slate-900">{item.referenceNo}</p>
                    <p className="text-slate-500">{item.serviceType} • {item.status}</p>
                  </div>
                ))}
                {extraHistoryCount > 0 ? (
                  <div className="rounded border border-dashed border-slate-200 bg-slate-50 p-2 text-center text-xs text-slate-500">
                    +{extraHistoryCount} more requests in View All
                  </div>
                ) : null}
                {history.length === 0 && <p className="text-slate-500">No requests yet.</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {services.map((service, idx) => {
              const Icon = (iconMap as any)[service.code] || FileText;
              return (
                <button
                  key={service.code}
                  className={`h-full rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
                    idx === 2 ? "md:col-span-2 md:w-full md:max-w-2xl md:justify-self-center" : ""
                  }`}
                  onClick={() => {
                    if (!hasAuthSession()) {
                      setFeedback({ isOpen: true, title: "Login Required", message: "Please log in as a resident before starting a barangay service request.", type: "error" });
                      return;
                    }
                    setActiveCode(service.code);
                    setShowRequestModal(true);
                  }}
                  type="button"
                >
                  <div className="mb-4 inline-flex rounded-full bg-slate-100 p-3 text-slate-800"><Icon size={20} /></div>
                  <h3 className="text-xl font-bold text-slate-900">{service.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{service.desc}</p>
                  <p className="mt-5 text-xs font-bold text-slate-700">Commonly used for:</p>
                  <p className="mt-1 text-xs text-slate-500">{service.usage}</p>
                  <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1"><Clock size={12} /> {service.time}</span>
                    <span className="inline-flex items-center gap-1 text-slate-900">Start <ArrowRight size={12} /></span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {showTrackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6">
            <button className="mb-2 ml-auto block text-slate-500" onClick={() => setShowTrackModal(false)} type="button"><X size={18} /></button>
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Track Request</h3>
            {isTracking && <div className="mb-3"><p className="mb-1 text-xs text-slate-500">Checking request... {trackProgress}%</p><div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-blue-600 transition-all" style={{ width: `${trackProgress}%` }} /></div></div>}
            <form onSubmit={trackRequest}>
              <input className="mb-3 w-full rounded-lg border px-3 py-2" placeholder="BT-SVC-YYYY-XXXXXX" value={trackRef} onChange={(e) => setTrackRef(e.target.value)} required />
              <button disabled={isTracking} type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isTracking ? "Checking..." : "Check Status"}</button>
            </form>
            {tracked && (
              <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-900">{tracked.referenceNo}</p>
                <p className="text-slate-600">{tracked.serviceType}</p>
                <p className="text-slate-600">Status: {tracked.status}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {showRequestModal && activeService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6">
            <button className="mb-2 ml-auto block text-slate-500" onClick={() => setShowRequestModal(false)} type="button"><X size={18} /></button>
            <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{activeService.title} Request</h2>
                <p className="mt-1 text-sm text-slate-600">{activeService.desc}</p>
                {isSubmitting && <div className="mt-3"><p className="mb-1 text-xs text-slate-500">Submitting request... {submitProgress}%</p><div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-emerald-600 transition-all" style={{ width: `${submitProgress}%` }} /></div></div>}
                <form className="mt-6 space-y-3" onSubmit={submitRequest}>
                  <input required className="w-full rounded-lg border px-3 py-2" placeholder="Full Name" value={formData.fullName} onChange={(e) => setFormData((p) => ({ ...p, fullName: cleanPersonNameInput(e.target.value) }))} />
                  <input required className="w-full rounded-lg border px-3 py-2" placeholder="09XXXXXXXXX" type="tel" inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} value={formData.contactNumber} onChange={(e) => setFormData((p) => ({ ...p, contactNumber: e.target.value.replace(/\D/g, "").slice(0, 11) }))} />
                  <input required className="w-full rounded-lg border px-3 py-2" placeholder="Address" value={formData.address} onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))} />
                  <select required className="w-full rounded-lg border px-3 py-2" value={formData.purpose} onChange={(e) => setFormData((p) => ({ ...p, purpose: e.target.value }))}>
                    <option value="">Purpose of Request</option>
                    <option value="employment">Employment</option>
                    <option value="school">School Requirement</option>
                    <option value="benefits">Government Assistance</option>
                    <option value="other">Other</option>
                  </select>
                  <button disabled={isSubmitting} type="submit" className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? "Submitting..." : "Submit Request"}</button>
                </form>
              </div>
              <aside className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 font-semibold text-slate-900">Requirements</h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {activeService.requirements.map((req) => (
                      <li key={req} className="flex items-center gap-2"><CheckCircle size={14} /> {req}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-900">Processing Time</h3>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{activeService.time}</p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-500">Resident service records</p>
                <h3 className="text-xl font-bold text-slate-900">Request History</h3>
                <p className="mt-1 text-sm text-slate-500">Search and review your submitted barangay service requests.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                aria-label="Close request history"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr,220px]">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search reference, service, or status..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <select
                value={historySortOrder}
                onChange={(e) => setHistorySortOrder(e.target.value as "newest" | "oldest")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400"
              >
                <option value="newest">Newest date/time first</option>
                <option value="oldest">Oldest date/time first</option>
              </select>
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((item) => {
                    const date = new Date(item.createdAt);
                    const invalidDate = Number.isNaN(date.getTime());
                    return (
                      <tr key={item._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.referenceNo}</td>
                        <td className="px-4 py-3 text-slate-700">{item.serviceType}</td>
                        <td className="px-4 py-3 text-slate-600">{invalidDate ? "N/A" : date.toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-slate-600">{invalidDate ? "N/A" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{item.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredHistory.length === 0 ? <p className="p-5 text-sm text-slate-500">No request matched the selected search.</p> : null}
            </div>
            {filteredHistory.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  Showing {(currentHistoryPage - 1) * HISTORY_PAGE_SIZE + 1}-{Math.min(currentHistoryPage * HISTORY_PAGE_SIZE, filteredHistory.length)} of {filteredHistory.length}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={currentHistoryPage <= 1}
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700">
                    Page {currentHistoryPage} of {historyTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentHistoryPage >= historyTotalPages}
                    onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <FeedbackModal
        isOpen={feedback.isOpen}
        onClose={() => setFeedback((prev) => ({ ...prev, isOpen: false }))}
        title={feedback.title}
        message={feedback.message}
        type={feedback.type}
      />
      <Footer />
      <Chatbot />
    </div>
  );
}
