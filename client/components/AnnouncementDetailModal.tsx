import { Calendar, Clock, MapPin, X } from "lucide-react";

export type AnnouncementDetailItem = {
  _id?: string;
  title: string;
  content?: string;
  module?: string;
  category?: string;
  source?: string;
  image?: string;
  createdAt?: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
  status?: string;
};

const moduleLabels: Record<string, string> = {
  "all-news-updates": "All News & Updates",
  "barangay-updates": "Barangay Updates",
  "emergency-hotlines": "Emergency Hotlines",
  "phivolcs-alerts": "PHIVOLCS Alerts",
  "fact-check": "Fact Check",
};

function formatDate(value?: string) {
  if (!value) return "Not specified";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatDateTime(value?: string) {
  if (!value) return "Not specified";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function AnnouncementDetailModal({
  item,
  onClose,
}: {
  item: AnnouncementDetailItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const moduleLabel = moduleLabels[item.module || ""] || item.module || "Announcement";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {item.image ? (
          <div className="aspect-[16/9] w-full bg-slate-100">
            <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">{moduleLabel}</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">{item.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{item.category || "Advisory"}</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{item.status || "published"}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              aria-label="Close announcement details"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Calendar size={14} /> Event Date</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(item.eventDate)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><Clock size={14} /> Time</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{item.eventTime || "Not specified"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><MapPin size={14} /> Location</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{item.location || "Not specified"}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 p-4">
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{item.content || "No details provided."}</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Source: <strong className="text-slate-700">{item.source || "Barangay Office"}</strong></span>
            <span>Posted: {formatDateTime(item.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
