
import { useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent as ReactMouseEvent, type ReactNode, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Archive, Bell, Building2, Check, ChevronDown, CircleUserRound, ClipboardCheck, Eye, EyeOff, FileText, LayoutDashboard, LogOut, Mail, MapPin, MessageCircle, Paperclip, Pencil, RotateCcw, Search, Settings, Star, Trash2, UserCog, UserX, Users, X } from "lucide-react";
import { clearAuthSession, type UserRole } from "@/lib/auth";
import { api, authHeaders } from "@/lib/api";
import { LogoutConfirmation } from "@/components/LogoutConfirmation";
import dashboardLogo from "../../../assets/brandlogo/Brand_Logo_ADMINDASBOARD.png";

interface DashboardProps { role: UserRole; }
type Panel = "overview" | "users" | "officials" | "announcements" | "reports" | "emergencyAlerts" | "services" | "messages" | "subscriptions" | "restore" | "settings" | "notifications" | "audit";
type FilterPanel = "users" | "announcements" | "reports" | "emergencyAlerts" | "services" | "messages" | "subscriptions" | "audit";
type MonthlyDetailKind = "users" | "services" | "reports" | "messages";
type TableFilterState = { search: string; date: string; time: string };
type PermissionFlags = { view: boolean; add: boolean; edit: boolean; archive: boolean; delete: boolean };
type AdminPermissions = {
  officials: PermissionFlags;
  announcements: PermissionFlags;
  reports: PermissionFlags;
  serviceRequests: PermissionFlags;
  messages: PermissionFlags;
  subscribers: PermissionFlags;
};
type UserItem = { _id: string; username: string; firstName?: string; middleName?: string; lastName?: string; email: string; contactNumber?: string; address?: string; addressDetails?: { blk?: string; lot?: string; street?: string; subdivision?: string; barangay?: string; city?: string; province?: string; zipCode?: string; }; preferredContactMethod?: string; gender?: string; civilStatus?: string; marriageContractImage?: string; children?: Array<{ _id?: string; fullName?: string; email?: string; birthDate?: string; relationship?: string; status?: "pending" | "approved" | "rejected"; reviewReason?: string }>; role: string; status: "active" | "pending" | "suspended"; statusReason?: string; validIdType?: string; validIdStatus?: string; validIdImage?: string; avatarImage?: string; createdAt?: string; adminPermissions?: Partial<AdminPermissions>; };
type Official = { _id: string; name: string; role: string; level: "city" | "barangay"; rankOrder: number; committee?: string; description?: string; image?: string; active?: boolean; };
type AnnouncementItem = { _id: string; title: string; content?: string; category: string; module: string; source?: string; image?: string; archived?: boolean; createdAt?: string; };
type HandlerInfo = { adminComment?: string; handledByUser?: string | null; handledByName?: string; handledByRole?: string; handledAt?: string; updatedAt?: string; };
type HandlerOption = { value: string; label: string; category: "Admins" | "Barangay Officials / Staff"; name: string; role: string; userId: string | null };
type ReportItem = HandlerInfo & { _id: string; fullName?: string; contactNumber?: string; address?: string; category: string; description: string; status: string; referenceNo: string; attachments?: Array<{ name?: string; type?: string; size?: number; dataUrl?: string }>; createdAt?: string; };
type AttachmentPreview = { title: string; name?: string; type?: string; dataUrl: string };
type ServiceRequest = HandlerInfo & { _id: string; referenceNo: string; serviceType: string; fullName: string; contactNumber?: string; address?: string; purpose?: string; status: string; createdAt?: string; };
type ContactMessage = HandlerInfo & { _id: string; referenceNo: string; name: string; contact?: string; department: string; message?: string; status: string; createdAt?: string; };
type Department = { _id: string; name: string; contactPerson: string; localNumber: string; active?: boolean };
type EvacuationCenter = { _id: string; name: string; address: string; active: boolean; capacity?: number; hazardsCovered?: string[]; notes?: string; location: { lat: number; lng: number } };
type EmergencyHotline = { _id: string; name: string; type: string; number: string; desc?: string; when?: string[]; prepare?: string[]; active?: boolean };
type Subscription = HandlerInfo & { _id: string; email: string; status: "active" | "unsubscribed"; source?: string; createdAt?: string; };
type AlertChatMessage = {
  _id?: string;
  senderRole: "resident" | "admin" | "superadmin" | "staff" | "system";
  senderName: string;
  message: string;
  attachments?: ChatAttachment[];
  createdAt: string;
};
type ChatAttachment = { name: string; type: string; size: number; dataUrl: string };
type AlertTypingState = {
  resident?: { isTyping?: boolean; name?: string; role?: string; at?: string } | null;
  staff?: { isTyping?: boolean; name?: string; role?: string; at?: string } | null;
};
type EmergencyAlertItem = HandlerInfo & {
  _id: string;
  referenceNo: string;
  situation: string;
  status: "active" | "acknowledged" | "resolved" | "cancelled";
  archived?: boolean;
  chatMessages?: AlertChatMessage[];
  typing?: AlertTypingState;
  chatEndedAt?: string | null;
  chatEndedByName?: string;
  chatEndedByRole?: string;
  residentRating?: number | null;
  residentRatingComment?: string;
  residentRatedAt?: string | null;
  residentSnapshot?: {
    userId?: string;
    username?: string;
    fullName?: string;
    email?: string;
    contactNumber?: string;
    age?: string;
    address?: string;
  };
  currentLocation?: { lat: number; lng: number; accuracy?: number | null; at?: string };
  createdAt?: string;
  updatedAt?: string;
};
type ActivityItem = {
  _id: string;
  title: string;
  type: string;
  createdAt: string;
  referenceNo?: string;
  userId?: string;
  userName?: string;
  userFullName?: string;
  userContact?: string;
  userEmail?: string;
  userAddress?: string;
  userRole?: string;
  metadata?: { module?: string; action?: string; [key: string]: any };
};
type SystemSettings = { autoArchiveReports: boolean; requireAnnouncementReview: boolean; emailDigest: boolean; allowResidentRegistration: boolean; maintenanceMode: boolean; maintenanceMessage: string; sessionTimeoutMinutes: number; lockoutWindowMinutes: number; developerOptionsEnabled: boolean; notificationRecipientMode: "all" | "superadmin" | "admin"; };
type SiteContent = {
  navbarBrandText: string;
  heroEyebrow: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroSubtitle: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  communityCards: Array<{ value: string; label: string; sublabel: string }>;
  governanceTitle: string;
  governanceSubtitle: string;
  governanceItems: Array<{ title: string; description: string }>;
  servicesHeroTitle: string;
  servicesHeroSubtitle: string;
  emergencyHotlinesTitle: string;
  emergencyHotlinesSubtitle: string;
  officialsPageTitle: string;
  officialsPageSubtitle: string;
  footerBrandText: string;
  footerDescription: string;
  footerAddress: string;
  footerPhone: string;
  footerEmail: string;
  aboutHeroTitle: string;
  aboutHeroSubtitle: string;
  aboutSnapshotItems: Array<{ label: string; value: string }>;
  aboutPopulationTrend: Array<{ label: string; value: string }>;
  aboutCoreGovernance: string[];
  aboutHistoryText: string;
  aboutGovernanceText: string;
  contactOfficeHours?: string;
  contactLocationText?: string;
};
type PendingAction = { title: string; message: string; confirmLabel: string; run: () => Promise<void>; };
type Feedback = { type: "success" | "error"; title: string; message: string; };
type SyncOverlayState = { isOpen: boolean; title: string; message: string; progress: number };
type UserReasonPrompt = {
  kind: "user-status" | "child-status";
  title: string;
  userId: string;
  username: string;
  nextStatus: "pending" | "suspended" | "approved" | "rejected";
  validIdStatus?: "pending" | "approved" | "rejected";
  role?: string;
  childId?: string;
  childName?: string;
};
type ChildDetailModalState = {
  parent: UserItem;
  child: NonNullable<UserItem["children"]>[number];
};
type DashboardSearchResult = {
  key: string;
  panel: Panel;
  module: string;
  title: string;
  subtitle: string;
  meta?: string;
  score: number;
};

const defaultPermissionFlags = (): PermissionFlags => ({ view: true, add: true, edit: true, archive: true, delete: true });
const defaultAdminPermissions = (): AdminPermissions => ({
  officials: defaultPermissionFlags(),
  announcements: defaultPermissionFlags(),
  reports: defaultPermissionFlags(),
  serviceRequests: defaultPermissionFlags(),
  messages: defaultPermissionFlags(),
  subscribers: defaultPermissionFlags(),
});

function normalizeAdminPermissions(value?: Partial<AdminPermissions>): AdminPermissions {
  const defaults = defaultAdminPermissions();
  return {
    officials: { ...defaults.officials, ...(value?.officials || {}) },
    announcements: { ...defaults.announcements, ...(value?.announcements || {}) },
    reports: { ...defaults.reports, ...(value?.reports || {}) },
    serviceRequests: { ...defaults.serviceRequests, ...(value?.serviceRequests || {}) },
    messages: { ...defaults.messages, ...(value?.messages || {}) },
    subscribers: { ...defaults.subscribers, ...(value?.subscribers || {}) },
  };
}

function Badge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const tone = v === "active" || v === "approved" || v === "resolved" || v === "completed" || v === "closed" || v === "read"
    ? "bg-emerald-100 text-emerald-700"
    : v === "pending" || v === "new" || v === "in-review"
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{value}</span>;
}

function childReviewProgress(status?: string) {
  const value = String(status || "pending").toLowerCase();
  if (value === "approved" || value === "rejected") return 100;
  return 45;
}

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(6, Math.round((value / max) * 100)) : 6;
  return (
    <div className="grid grid-cols-[minmax(84px,116px),1fr,32px] items-center gap-2 text-xs sm:grid-cols-[140px,1fr,36px]">
      <span className="truncate font-medium text-slate-600">{label}</span>
      <div className="h-2 rounded bg-slate-100"><div className="h-2 rounded bg-slate-900" style={{ width: `${pct}%` }} /></div>
      <span className="text-right text-slate-500">{value}</span>
    </div>
  );
}

function DonutStat({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number; color: string }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-4 text-sm text-slate-500">No data</p>
      </section>
    );
  }
  let cursor = 0;
  const segments = data.map((item) => {
    const start = cursor;
    const sweep = (item.value / total) * 360;
    cursor += sweep;
    return `${item.color} ${start}deg ${cursor}deg`;
  }).join(", ");
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="relative h-28 w-28 rounded-full"
          style={{ background: `conic-gradient(${segments})` }}
        >
          <div className="absolute inset-4 flex items-center justify-center rounded-full bg-white text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">Total</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="min-w-[120px] text-slate-600">{item.label}</span>
              <span className="font-semibold text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryFilter({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt.value} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${value === opt.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>
            <input type="radio" className="h-3 w-3 accent-current" checked={value === opt.value} onChange={() => onChange(opt.value)} />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function LabeledField({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: any;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function PanelSearchFilters({
  value,
  onChange,
  placeholder,
}: {
  value: TableFilterState;
  onChange: (next: Partial<TableFilterState>) => void;
  placeholder: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition focus:border-slate-400"
        />
        {value.search ? (
          <button
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            onClick={() => onChange({ search: "" })}
            type="button"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:w-[320px]">
        <input
          type="date"
          value={value.date}
          onChange={(e) => onChange({ date: e.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
          aria-label="Filter by date"
        />
        <input
          type="time"
          value={value.time}
          onChange={(e) => onChange({ time: e.target.value })}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
          aria-label="Filter by time"
        />
      </div>
    </div>
  );
}

function SyncProgressOverlay({ state }: { state: SyncOverlayState }) {
  if (!state.isOpen) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Saving Progress</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">{state.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{state.message}</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(3, Math.min(100, state.progress))}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Updating your latest records</span>
          <span>{Math.round(state.progress)}%</span>
        </div>
      </div>
    </div>
  );
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function toLocalDateInputValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLocalTimeInputValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function todayInputValue() {
  return toLocalDateInputValue(new Date().toISOString());
}

function formatDateTime(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value?: string) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "2-digit" });
}

function formatTimeOnly(value?: string) {
  if (!value) return "No time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function monthKeyFromDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function userDisplayName(user?: Partial<UserItem>) {
  return [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(" ").trim() || user?.username || user?.email || "Unnamed user";
}

function googleMapsUrl(location?: EmergencyAlertItem["currentLocation"]) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return "";
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
}

function formatCoordinates(location?: EmergencyAlertItem["currentLocation"]) {
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return "No live location yet";
  return `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
}

function normalizeBrandName(value?: string) {
  const cleaned = String(value || "BayanTrack").replace(/\s*\+\s*$/g, "").replace(/\s+/g, " ").trim();
  return cleaned.toLowerCase() === "bayantrack" || !cleaned ? "BayanTrack" : cleaned;
}

function handlerLabel(item?: HandlerInfo) {
  if (!item?.handledByName) return "Not assigned yet";
  return `${item.handledByName}${item.handledByRole ? ` (${item.handledByRole})` : ""}`;
}

function DetailBlock({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/70 p-3 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-1 text-sm leading-5 text-slate-800">{children}</div>
    </div>
  );
}

function HandlerPill({ item }: { item?: HandlerInfo }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
      <span className="mr-1 text-slate-400">Handled by</span>
      <span className="truncate">{handlerLabel(item)}</span>
    </span>
  );
}

function AdminCommentBlock({ value }: { value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
      <p className="font-bold uppercase tracking-[0.14em] text-blue-500">Comment from admins</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}

export default function RoleDashboard({ role }: DashboardProps) {
  const navigate = useNavigate();
  const canManage = role === "superadmin";
  const canReviewUsers = role === "superadmin" || role === "admin";
  const [myPermissions, setMyPermissions] = useState<AdminPermissions>(defaultAdminPermissions());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>("overview");
  const [managementNavOpen, setManagementNavOpen] = useState(false);
  const [systemNavOpen, setSystemNavOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reviewUserPrompt, setReviewUserPrompt] = useState<UserItem | null>(null);
  const [userReasonPrompt, setUserReasonPrompt] = useState<UserReasonPrompt | null>(null);
  const [userReasonChoice, setUserReasonChoice] = useState("Incomplete or invalid documents");
  const [userReasonCustom, setUserReasonCustom] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [syncOverlay, setSyncOverlay] = useState<SyncOverlayState>({ isOpen: false, title: "", message: "", progress: 0 });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [childDetailModal, setChildDetailModal] = useState<ChildDetailModalState | null>(null);
  const [accountControlModal, setAccountControlModal] = useState<UserItem | null>(null);
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [officialEditModal, setOfficialEditModal] = useState<Official | null>(null);
  const [announcementEditModal, setAnnouncementEditModal] = useState<AnnouncementItem | null>(null);
  const [addOfficialOpen, setAddOfficialOpen] = useState(false);
  const [addAnnouncementOpen, setAddAnnouncementOpen] = useState(false);
  const [homeEditOpen, setHomeEditOpen] = useState(false);
  const [aboutEditOpen, setAboutEditOpen] = useState(false);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [servicesEditOpen, setServicesEditOpen] = useState(false);
  const [aboutSnapshotDraft, setAboutSnapshotDraft] = useState("");
  const [aboutTrendDraft, setAboutTrendDraft] = useState("");
  const [aboutGovDraft, setAboutGovDraft] = useState("");

  const [users, setUsers] = useState<UserItem[]>([]);
  const [officials, setOfficials] = useState<Official[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [services, setServices] = useState<ServiceRequest[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState<EmergencyAlertItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<ActivityItem[]>([]);
  const [serviceCatalog, setServiceCatalog] = useState<any[]>([]);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [evacuationCenters, setEvacuationCenters] = useState<EvacuationCenter[]>([]);
  const [emergencyHotlines, setEmergencyHotlines] = useState<EmergencyHotline[]>([]);
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  const [evacuationCenterModalOpen, setEvacuationCenterModalOpen] = useState(false);
  const [editingHotlineId, setEditingHotlineId] = useState<string | null>(null);
  const [manageCentersOpen, setManageCentersOpen] = useState(false);
  const [manageHotlinesOpen, setManageHotlinesOpen] = useState(false);
  const [reportManageModal, setReportManageModal] = useState<ReportItem | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreview | null>(null);
  const [attachmentLoadingId, setAttachmentLoadingId] = useState<string | null>(null);
  const [liveAlertChatModal, setLiveAlertChatModal] = useState<EmergencyAlertItem | null>(null);
  const [liveAlertChatMessages, setLiveAlertChatMessages] = useState<AlertChatMessage[]>([]);
  const [liveAlertChatTyping, setLiveAlertChatTyping] = useState<AlertTypingState>({});
  const [liveAlertChatText, setLiveAlertChatText] = useState("");
  const [liveAlertChatAttachments, setLiveAlertChatAttachments] = useState<ChatAttachment[]>([]);
  const [liveAlertChatSending, setLiveAlertChatSending] = useState(false);
  const liveAlertChatEndRef = useRef<HTMLDivElement | null>(null);
  const liveAlertTypingTimerRef = useRef<number | null>(null);
  const liveAlertFileInputRef = useRef<HTMLInputElement | null>(null);
  const [serviceManageModal, setServiceManageModal] = useState<ServiceRequest | null>(null);
  const [messageManageModal, setMessageManageModal] = useState<ContactMessage | null>(null);
  const [subscriptionManageModal, setSubscriptionManageModal] = useState<Subscription | null>(null);
  const [showClosedMessagesModal, setShowClosedMessagesModal] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [userEditModal, setUserEditModal] = useState<(Partial<UserItem> & { password?: string }) | null>(null);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [addReportOpen, setAddReportOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addMessageOpen, setAddMessageOpen] = useState(false);
  const [addSubscriberOpen, setAddSubscriberOpen] = useState(false);
  const [userCategory, setUserCategory] = useState("all");
  const [userApprovalCategory, setUserApprovalCategory] = useState("all");
  const [userParentCategory, setUserParentCategory] = useState("all");
  const [officialCategory, setOfficialCategory] = useState("all");
  const [subscriberCategory, setSubscriberCategory] = useState("all");
  const [activityRoleCategory, setActivityRoleCategory] = useState("all");
  const [announcementCategory, setAnnouncementCategory] = useState("all");
  const [messageCategory, setMessageCategory] = useState("all");
  const [serviceCategory, setServiceCategory] = useState("all");
  const [reportCategory, setReportCategory] = useState("all");
  const [liveAlertCategory, setLiveAlertCategory] = useState<"unresolved" | "resolved" | "all">("unresolved");
  const [notificationCategory, setNotificationCategory] = useState("all");
  const [monthlyDetailModal, setMonthlyDetailModal] = useState<MonthlyDetailKind | null>(null);
  const [restoreCategory, setRestoreCategory] = useState("users");
  const [reportSortOrder, setReportSortOrder] = useState<"newest" | "oldest">("newest");
  const [serviceSortOrder, setServiceSortOrder] = useState<"newest" | "oldest">("newest");
  const [restoreExpanded, setRestoreExpanded] = useState(false);
  const [restoreSearch, setRestoreSearch] = useState("");
  const [notificationSearch, setNotificationSearch] = useState("");
  const [activityLogDate, setActivityLogDate] = useState(todayInputValue);
  const [notificationLogDate, setNotificationLogDate] = useState(todayInputValue);
  const [tableFilters, setTableFilters] = useState<Record<FilterPanel, TableFilterState>>({
    users: { search: "", date: "", time: "" },
    announcements: { search: "", date: "", time: "" },
    reports: { search: "", date: "", time: "" },
    emergencyAlerts: { search: "", date: todayInputValue(), time: "" },
    services: { search: "", date: "", time: "" },
    messages: { search: "", date: "", time: "" },
    subscriptions: { search: "", date: "", time: "" },
    audit: { search: "", date: todayInputValue(), time: "" },
  });

  const [newOfficial, setNewOfficial] = useState({ name: "", role: "", level: "barangay", rankOrder: 10, committee: "", description: "", image: "" });
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", module: "barangay-updates", category: "Advisory", source: "Barangay Office", image: "" });
  const [newCatalogItem, setNewCatalogItem] = useState({ code: "", title: "", desc: "", usage: "", requirements: "", time: "", active: true, sortOrder: 100 });
  const [newCenter, setNewCenter] = useState({ name: "", address: "", lat: "", lng: "", hazardsCovered: "typhoon,flood,earthquake,fire", capacity: "0", notes: "", active: true });
  const [newHotline, setNewHotline] = useState({ name: "", type: "", number: "", desc: "", when: "", prepare: "", active: true });
  const [newDepartment, setNewDepartment] = useState({ name: "", contactPerson: "", localNumber: "" });
  const [newUser, setNewUser] = useState({ username: "", firstName: "", middleName: "", lastName: "", email: "", contactNumber: "", address: "", role: "resident", status: "active", password: "" });
  const [newReport, setNewReport] = useState({ fullName: "", contactNumber: "", address: "", category: "Garbage / Sanitation", description: "" });
  const [newService, setNewService] = useState({ serviceType: "Barangay Clearance", fullName: "", contactNumber: "", address: "", purpose: "" });
  const [newMessage, setNewMessage] = useState({ name: "", contact: "", department: "Office of the Captain", message: "" });
  const [newSubscriber, setNewSubscriber] = useState({ email: "", source: "dashboard" });
  const defaultSystemSettings: SystemSettings = { autoArchiveReports: true, requireAnnouncementReview: false, emailDigest: true, allowResidentRegistration: true, maintenanceMode: false, maintenanceMessage: "", sessionTimeoutMinutes: 60, lockoutWindowMinutes: 15, developerOptionsEnabled: false, notificationRecipientMode: "all" };
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(defaultSystemSettings);
  const [savedSystemSettings, setSavedSystemSettings] = useState<SystemSettings>(defaultSystemSettings);
  const [siteContent, setSiteContent] = useState<SiteContent>({
    navbarBrandText: "BayanTrack",
    heroEyebrow: "Official Government Portal",
    heroTitleLine1: "Mambog II",
    heroTitleLine2: "Progressive & Safe",
    heroSubtitle: "A growing residential community in Bacoor City, dedicated to transparent governance and efficient public service.",
    heroPrimaryCta: "Online Services",
    heroSecondaryCta: "About The Community",
    communityCards: [
      { value: "4102", label: "Postal Code", sublabel: "Bacoor City" },
      { value: "7,129", label: "Population", sublabel: "2020 Census" },
      { value: "IV-A", label: "Region", sublabel: "CALABARZON" },
      { value: "CAVITE", label: "Province", sublabel: "Philippines" },
    ],
    governanceTitle: "Governance & Participation",
    governanceSubtitle: "How we serve and engage with the community.",
    governanceItems: [
      { title: "Barangay Assemblies", description: "Biannual gatherings mandated by law to discuss financial reports and community projects." },
      { title: "Transparency", description: "Open access to barangay budget, ordinances, and resolutions for public review." },
      { title: "Citizen Reporting", description: "Active channels for feedback, complaints, and emergency reporting via BayanTrack." },
    ],
    servicesHeroTitle: "Online Services Portal",
    servicesHeroSubtitle: "Certificate of Indigency, Barangay Clearance, and Barangay ID requests with clear request tracking.",
    emergencyHotlinesTitle: "Emergency Hotlines",
    emergencyHotlinesSubtitle: "Keep these numbers saved. Know what to do before you call.",
    officialsPageTitle: "Barangay Officials Directory",
    officialsPageSubtitle: "Meet the dedicated public servants of Barangay Mambog II, committed to transparency and efficient public service.",
    footerBrandText: "BayanTrack",
    footerDescription: "The official digital portal of Barangay Mambog II, Bacoor, Cavite. Bridging the gap between the barangay hall and the home through technology and transparency.",
    footerAddress: "Mambog II Barangay Hall, Bacoor City, Cavite 4102",
    footerPhone: "(046) 472-0110",
    footerEmail: "superadminbayantrack@gmail.com",
    aboutHeroTitle: "About Our Community",
    aboutHeroSubtitle: "Mambog II: A progressive residential barangay in the heart of Bacoor.",
    aboutSnapshotItems: [
      { label: "Region", value: "CALABARZON (Region IV-A)" },
      { label: "Population (2020)", value: "7,129 Residents" },
      { label: "City", value: "Bacoor City, Cavite" },
      { label: "Share of Bacoor", value: "Approx. 1.07%" },
    ],
    aboutPopulationTrend: [
      { label: "1990 Census", value: "~2,500" },
      { label: "2010 Census", value: "~5,800" },
      { label: "2020 Census", value: "7,129" },
    ],
    aboutCoreGovernance: [
      "Barangay Assembly: Biannual meetings for resident consultation.",
      "Committees: Peace & Order, Health, Finance, Youth, Infrastructure.",
      "Transparency: Full disclosure of budget and projects.",
    ],
    aboutHistoryText: "",
    aboutGovernanceText: "",
    contactOfficeHours: "Monday - Friday, 8:00 AM - 5:00 PM",
    contactLocationText: "Barangay Mambog II Hall, Bacoor City, Cavite",
  });

  useEffect(() => { void loadDashboardData(); }, [activityLogDate, notificationLogDate]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadDashboardData(true);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [role, userCategory, userApprovalCategory, activityLogDate, notificationLogDate]);
  useEffect(() => { void loadUsers(); }, [userCategory, userApprovalCategory]);
  useEffect(() => { if (!feedback) return; const t = setTimeout(() => setFeedback(null), 2800); return () => clearTimeout(t); }, [feedback]);
  useEffect(() => () => {
    if (liveAlertTypingTimerRef.current !== null) {
      window.clearTimeout(liveAlertTypingTimerRef.current);
    }
  }, []);
  useEffect(() => {
    if (!liveAlertChatModal?._id) return;
    let cancelled = false;
    const loadChat = async () => {
      try {
        const res = await api.get(`/api/emergency-alerts/${liveAlertChatModal._id}/messages`, { headers: authHeaders() });
        if (cancelled) return;
        setLiveAlertChatMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
        setLiveAlertChatTyping(res.data?.typing || {});
        if (res.data?.alert) {
          setLiveAlertChatModal((current) => current?._id === liveAlertChatModal._id ? { ...current, ...(res.data.alert || {}) } : current);
        }
      } catch (_err) {
        if (!cancelled) setLiveAlertChatTyping({});
      }
    };
    void loadChat();
    const timer = window.setInterval(loadChat, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [liveAlertChatModal?._id]);
  useEffect(() => {
    if (liveAlertChatModal) liveAlertChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveAlertChatMessages, liveAlertChatModal]);

  const stats = useMemo(() => ({
    users: users.length,
    pendingUsers: users.filter((u) => u.status === "pending" || u.validIdStatus === "pending").length,
    announcements: announcements.length,
    subscribers: subscriptions.filter((s) => s.status === "active").length,
    openReports: reports.filter((r) => r.status !== "resolved").length,
    liveAlerts: emergencyAlerts.filter((alert) => alert.status === "active" || alert.status === "acknowledged").length,
    pendingServices: services.filter((s) => s.status === "pending" || s.status === "in-review").length,
    unreadMessages: messages.filter((m) => m.status === "new").length,
  }), [users, announcements, subscriptions, reports, emergencyAlerts, services, messages]);

  const chartServices = useMemo(() => {
    const map = new Map<string, number>();
    services.forEach((s) => map.set(s.serviceType, (map.get(s.serviceType) || 0) + 1));
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [services]);

  const chartReports = useMemo(() => {
    const map = new Map<string, number>();
    reports.forEach((r) => map.set(r.category, (map.get(r.category) || 0) + 1));
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [reports]);

  const chartAnnouncements = useMemo(() => {
    const map = new Map<string, number>();
    announcements.forEach((a) => map.set(a.module, (map.get(a.module) || 0) + 1));
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [announcements]);

  const alertRatingSummary = useMemo(() => {
    const rated = emergencyAlerts.filter((alert) => Number(alert.residentRating) > 0);
    const total = rated.reduce((sum, alert) => sum + Number(alert.residentRating || 0), 0);
    return {
      count: rated.length,
      average: rated.length ? total / rated.length : 0,
      comments: rated.filter((alert) => alert.residentRatingComment).slice(0, 3),
    };
  }, [emergencyAlerts]);

  const recentActivityDetails = useMemo(() => activities.slice(0, 5), [activities]);

  const visibleAdminNotifications = adminNotifications;
  const recentAdminNotices = useMemo(() => visibleAdminNotifications.slice(0, 6), [visibleAdminNotifications]);
  const normalizedSearch = normalizeSearch(searchQuery);
  const normalizedRestoreSearch = normalizeSearch(restoreSearch);
  const normalizedNotificationSearch = normalizeSearch(notificationSearch);

  const matchesDashboardSearch = (...values: Array<string | number | undefined | null>) => {
    if (!normalizedSearch) return true;
    return values.some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));
  };
  const matchesLocalSearch = (query: string, ...values: Array<string | number | undefined | null>) => {
    if (!query) return true;
    return values.some((value) => String(value ?? "").toLowerCase().includes(query));
  };
  const updateTableFilter = (panel: FilterPanel, next: Partial<TableFilterState>) => {
    if (panel === "audit" && next.date !== undefined) {
      const nextDate = next.date || todayInputValue();
      setActivityLogDate(nextDate);
      setTableFilters((prev) => ({ ...prev, audit: { ...prev.audit, ...next, date: nextDate } }));
      return;
    }
    setTableFilters((prev) => ({ ...prev, [panel]: { ...prev[panel], ...next } }));
  };
  const matchesTableFilters = (panel: FilterPanel, dateValue: string | undefined, ...values: Array<string | number | undefined | null>) => {
    const filters = tableFilters[panel];
    const localSearch = normalizeSearch(filters.search);
    const textMatch = !localSearch || values.some((value) => String(value ?? "").toLowerCase().includes(localSearch));
    const dateMatch = !filters.date || toLocalDateInputValue(dateValue) === filters.date;
    const timeMatch = !filters.time || toLocalTimeInputValue(dateValue) === filters.time;
    return textMatch && dateMatch && timeMatch;
  };

  const scoreDashboardSearch = (...values: Array<string | number | undefined | null>) => {
    if (!normalizedSearch) return 0;
    return values.reduce<number>((best, value) => {
      const text = String(value ?? "").toLowerCase();
      if (!text) return best;
      if (text === normalizedSearch) return Math.max(best, 120);
      if (text.startsWith(normalizedSearch)) return Math.max(best, 90);
      if (text.includes(normalizedSearch)) return Math.max(best, 60);
      return best;
    }, 0);
  };

  const dashboardSearchResults = useMemo<DashboardSearchResult[]>(() => {
    if (!normalizedSearch) return [];
    const results: DashboardSearchResult[] = [];
    const pushResult = (
      panel: Panel,
      module: string,
      key: string,
      title: string,
      subtitle: string,
      meta: string,
      values: Array<string | number | undefined | null>,
    ) => {
      const score = scoreDashboardSearch(module, title, subtitle, meta, ...values);
      if (score > 0) results.push({ panel, module, key, title, subtitle, meta, score });
    };

    users.forEach((user) => pushResult(
      user.status === "suspended" ? "restore" : "users",
      "Users",
      `user-${user._id}`,
      [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || user.username,
      user.email || user.username,
      `${user.role} | ${user.status}`,
      [user.username, user.contactNumber, user.address, user.validIdStatus],
    ));
    officials.forEach((official) => pushResult(
      official.active === false ? "restore" : "officials",
      "Officials",
      `official-${official._id}`,
      official.name,
      official.role,
      `${official.level}${official.committee ? ` | ${official.committee}` : ""}`,
      [official.description],
    ));
    announcements.forEach((announcement) => pushResult(
      announcement.archived ? "restore" : "announcements",
      "Announcements",
      `announcement-${announcement._id}`,
      announcement.title,
      announcement.content || "No content provided",
      `${announcement.module} | ${announcement.category}`,
      [announcement.source],
    ));
    reports.forEach((report) => pushResult(
      report.status === "rejected" ? "restore" : "reports",
      "Reports",
      `report-${report._id}`,
      report.referenceNo,
      report.description,
      `${report.category} | ${report.status}`,
      [],
    ));
    emergencyAlerts.forEach((alert) => pushResult(
      "emergencyAlerts",
      "Live Alerts",
      `live-alert-${alert._id}`,
      alert.referenceNo,
      alert.situation,
      [alert.status, alert.residentSnapshot?.username, alert.residentSnapshot?.email].filter(Boolean).join(" | "),
      [alert.residentSnapshot?.fullName, alert.residentSnapshot?.contactNumber, alert.residentSnapshot?.address],
    ));
    services.forEach((service) => pushResult(
      service.status === "rejected" ? "restore" : "services",
      "Service Requests",
      `service-${service._id}`,
      service.referenceNo,
      service.fullName,
      `${service.serviceType} | ${service.status}`,
      [],
    ));
    messages.forEach((message) => pushResult(
      message.status === "closed" ? "restore" : "messages",
      "Messages",
      `message-${message._id}`,
      message.referenceNo,
      message.name,
      `${message.department} | ${message.status}`,
      [],
    ));
    subscriptions.forEach((subscription) => pushResult(
      subscription.status === "unsubscribed" ? "restore" : "subscriptions",
      "Subscribers",
      `subscription-${subscription._id}`,
      subscription.email,
      subscription.source || "homepage",
      subscription.status,
      [],
    ));
    adminNotifications.forEach((item) => pushResult(
      "notifications",
      "System Notifications",
      `notification-${item._id}`,
      item.title,
      item.type,
      [item.userRole || "system", item.referenceNo, item.metadata?.module].filter(Boolean).join(" | "),
      [],
    ));
    activities.forEach((activity) => pushResult(
      "audit",
      "My Activity",
      `activity-${activity._id}`,
      activity.title,
      activity.type,
      [activity.userName || "unknown", activity.userRole, activity.referenceNo].filter(Boolean).join(" | "),
      [],
    ));

    return results.sort((a, b) => b.score - a.score || a.module.localeCompare(b.module)).slice(0, 14);
  }, [normalizedSearch, users, officials, announcements, reports, emergencyAlerts, services, messages, subscriptions, adminNotifications, activities]);

  const openDashboardSearchResult = (result: DashboardSearchResult) => {
    if (result.panel === "users") {
      setUserCategory("all");
      setUserApprovalCategory("all");
      setUserParentCategory("all");
    }
    if (result.panel === "officials") setOfficialCategory("all");
    if (result.panel === "announcements") setAnnouncementCategory("all");
    if (result.panel === "reports") setReportCategory("all");
    if (result.panel === "emergencyAlerts") updateTableFilter("emergencyAlerts", { search: "" });
    if (result.panel === "services") setServiceCategory("all");
    if (result.panel === "messages") setMessageCategory("all");
    if (result.panel === "subscriptions") setSubscriberCategory("all");
    if (result.panel === "notifications") setNotificationCategory("all");
    if (result.panel === "audit") setActivityRoleCategory("all");
    setActivePanel(result.panel);
    setIsSearchOpen(false);
  };

  const monthlyOverview = useMemo(() => {
    const monthLabels = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: date.toLocaleString("en-US", { month: "short" }),
      };
    });
    const counts = monthLabels.map((month) => ({ ...month, users: 0, reports: 0, services: 0, messages: 0 }));
    const monthIndex = new Map(counts.map((item) => [item.key, item]));
    const stamp = (dateValue?: string, field: "users" | "reports" | "services" | "messages" = "users") => {
      if (!dateValue) return;
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return;
      const bucket = monthIndex.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (bucket) bucket[field] += 1;
    };
    users.forEach((item) => stamp(item.createdAt, "users"));
    reports.forEach((item) => stamp(item.createdAt, "reports"));
    services.forEach((item) => stamp(item.createdAt, "services"));
    messages.forEach((item) => stamp(item.createdAt, "messages"));
    return counts;
  }, [users, reports, services, messages]);

  const monthlySeries = useMemo(() => ([
    { key: "users" as const, label: "Registered Accounts", color: "bg-blue-600", accent: "text-blue-700", border: "border-blue-100", soft: "bg-blue-50" },
    { key: "services" as const, label: "Service Requests", color: "bg-emerald-600", accent: "text-emerald-700", border: "border-emerald-100", soft: "bg-emerald-50" },
    { key: "reports" as const, label: "Reports", color: "bg-amber-500", accent: "text-amber-700", border: "border-amber-100", soft: "bg-amber-50" },
    { key: "messages" as const, label: "Messages", color: "bg-fuchsia-600", accent: "text-fuchsia-700", border: "border-fuchsia-100", soft: "bg-fuchsia-50" },
  ]), []);

  const monthlyWindowKeys = useMemo(() => new Set(monthlyOverview.map((row) => row.key)), [monthlyOverview]);

  const monthlyDetailRows = useMemo(() => {
    const inWindow = (createdAt?: string) => monthlyWindowKeys.has(monthKeyFromDate(createdAt));
    return {
      users: users
        .filter((item) => inWindow(item.createdAt))
        .map((item) => ({
          id: item._id,
          createdAt: item.createdAt,
          cells: [userDisplayName(item), item.email || "N/A", item.gender || "N/A", item.role || "resident", item.status || "pending"],
        })),
      services: services
        .filter((item) => inWindow(item.createdAt))
        .map((item) => ({
          id: item._id,
          createdAt: item.createdAt,
          cells: [item.referenceNo, item.fullName || "N/A", item.serviceType || "N/A", item.status || "pending"],
        })),
      reports: reports
        .filter((item) => inWindow(item.createdAt))
        .map((item) => ({
          id: item._id,
          createdAt: item.createdAt,
          cells: [item.referenceNo, item.fullName || "N/A", item.category || "N/A", item.status || "new"],
        })),
      messages: messages
        .filter((item) => inWindow(item.createdAt))
        .map((item) => ({
          id: item._id,
          createdAt: item.createdAt,
          cells: [item.referenceNo, item.name || "N/A", item.department || "N/A", item.status || "new"],
        })),
    };
  }, [monthlyWindowKeys, users, services, reports, messages]);

  const monthlyDetailColumns: Record<MonthlyDetailKind, string[]> = {
    users: ["Name", "Email", "Gender", "Role", "Status"],
    services: ["Reference", "Resident", "Service", "Status"],
    reports: ["Reference", "Reporter", "Category", "Status"],
    messages: ["Reference", "Sender", "Department", "Status"],
  };

  const statusDonutData = useMemo(() => ([
    { label: "Active Users", value: users.filter((item) => item.status === "active").length, color: "#0f766e" },
    { label: "Pending Users", value: users.filter((item) => item.status === "pending").length, color: "#d97706" },
    { label: "Suspended Users", value: users.filter((item) => item.status === "suspended").length, color: "#dc2626" },
  ]), [users]);

  const requestDonutData = useMemo(() => ([
    { label: "Services", value: services.length, color: "#2563eb" },
    { label: "Reports", value: reports.length, color: "#7c3aed" },
    { label: "Messages", value: messages.length, color: "#0891b2" },
    { label: "Subscribers", value: subscriptions.length, color: "#16a34a" },
    { label: "Live Alerts", value: emergencyAlerts.length, color: "#dc2626" },
  ]), [services, reports, messages, subscriptions, emergencyAlerts]);

  const announcementCategoryOptions = [
    { value: "all", label: "All" },
    { value: "barangay-updates", label: "Barangay Updates" },
    { value: "emergency-hotlines", label: "Emergency Hotlines" },
    { value: "phivolcs-alerts", label: "PHIVOLCS Alerts" },
    { value: "fact-check", label: "Fact Checks" },
  ];
  const messageCategoryOptions = [
    { value: "all", label: "All" },
    { value: "barangay-secretary", label: "Barangay Secretary" },
    { value: "disaster-drrm", label: "Disaster DRRM" },
    { value: "health-center", label: "Health Center" },
    { value: "office-of-the-captain", label: "Office of the Captain" },
    { value: "senior-citizen-desk", label: "Senior Citizen Desk" },
  ];
  const serviceCategoryOptions = [
    { value: "all", label: "All" },
    { value: "barangay-clearance", label: "Barangay Clearance" },
    { value: "certificate-of-indigency", label: "Certificate of Indigency" },
    { value: "barangay-id", label: "Barangay ID" },
  ];
  const reportCategoryOptions = [
    { value: "all", label: "All" },
    { value: "garbage-sanitation", label: "Garbage / Sanitation" },
    { value: "potholes-road-damage", label: "Potholes / Road Damage" },
    { value: "streetlight-defect", label: "Streetlight Defect" },
    { value: "noise-complaint", label: "Noise Complaint" },
    { value: "suspicious-activity", label: "Suspicious Activity" },
    { value: "misinformation-rumor", label: "Misinformation / Rumor" },
    { value: "stray-animal", label: "Stray Animal" },
  ];
  const liveAlertCategoryOptions = [
    { value: "unresolved", label: "Unresolved" },
    { value: "resolved", label: "Resolved" },
    { value: "all", label: "All" },
  ];
  const userCategoryOptions = [
    { value: "all", label: "All" },
    { value: "superadmin", label: "Superadmin" },
    { value: "admin", label: "Admin" },
    { value: "user", label: "User" },
  ];
  const userApprovalOptions = [
    { value: "all", label: "All" },
    { value: "approved", label: "Approved" },
    { value: "not-approved", label: "Not Approved" },
  ];
  const userParentOptions = [
    { value: "all", label: "All" },
    { value: "with-children", label: "Parents With Account" },
    { value: "without-children", label: "No Child Linked" },
  ];
  const officialCategoryOptions = [
    { value: "all", label: "All" },
    { value: "barangay", label: "Barangay" },
    { value: "city", label: "City" },
  ];
  const subscriberCategoryOptions = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "unsubscribed", label: "Unsubscribed" },
  ];
  const activityRoleOptions = [
    { value: "all", label: "All" },
    { value: "superadmin", label: "Superadmin" },
    { value: "admin", label: "Admin" },
    { value: "resident", label: "Resident" },
  ];
  const notificationCategoryOptions = [
    { value: "all", label: "All" },
    { value: "users", label: "Users" },
    { value: "reports", label: "Reports" },
    { value: "live-alerts", label: "Live Alerts" },
    { value: "services", label: "Services" },
    { value: "messages", label: "Messages" },
    { value: "announcements", label: "Announcements" },
    { value: "child-access", label: "Child Access" },
  ];

  const toKey = (value: string) =>
    String(value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const matchesMessageCategory = (department: string, category: string) => {
    if (category === "all") return true;
    const key = toKey(department);
    if (category === "office-of-the-captain") return key.includes("captain");
    if (category === "disaster-drrm") return key.includes("drrm") || key.includes("disaster");
    if (category === "barangay-secretary") return key.includes("secretary");
    if (category === "health-center") return key.includes("health");
    if (category === "senior-citizen-desk") return key.includes("senior");
    return key.includes(category);
  };

  const matchesServiceCategory = (serviceType: string, category: string) => {
    if (category === "all") return true;
    const key = toKey(serviceType);
    if (category === "certificate-of-indigency") return key.includes("indigency");
    if (category === "barangay-clearance") return key.includes("clearance");
    if (category === "barangay-id") return key.includes("barangay-id") || key.includes("barangayid");
    return key.includes(category);
  };

  const matchesReportCategory = (reportType: string, category: string) => {
    if (category === "all") return true;
    const key = toKey(reportType);
    if (category === "garbage-sanitation") return key.includes("garbage") || key.includes("sanitation");
    if (category === "potholes-road-damage") return key.includes("pothole") || key.includes("road-damage") || key.includes("road");
    if (category === "streetlight-defect") return key.includes("streetlight");
    if (category === "noise-complaint") return key.includes("noise");
    if (category === "suspicious-activity") return key.includes("suspicious");
    if (category === "stray-animal") return key.includes("stray") || key.includes("animal");
    return key.includes(category);
  };

  const filteredAnnouncements = useMemo(
    () => announcements.filter((a) => !a.archived && (announcementCategory === "all" || a.module === announcementCategory) && matchesDashboardSearch(a.title, a.content, a.category, a.module, a.source) && matchesTableFilters("announcements", a.createdAt, a.title, a.content, a.category, a.module, a.source)),
    [announcements, announcementCategory, normalizedSearch, tableFilters],
  );
  const filteredUsers = useMemo(
    () => users.filter((user) => {
      if (user.status === "suspended") return false;
      const matchesParentFilter =
        userParentCategory === "with-children"
          ? Array.isArray(user.children) && user.children.length > 0
          : userParentCategory === "without-children"
            ? !Array.isArray(user.children) || user.children.length === 0
            : true;
      return matchesParentFilter && matchesDashboardSearch(
        user.username,
        user.firstName,
        user.middleName,
        user.lastName,
        user.email,
        user.contactNumber,
        user.address,
        user.role,
        user.status,
      ) && matchesTableFilters("users", user.createdAt, user.username, user.firstName, user.middleName, user.lastName, user.email, user.contactNumber, user.address, user.role, user.status);
    }),
    [users, userParentCategory, normalizedSearch, tableFilters],
  );
  const filteredOfficials = useMemo(
    () => officials.filter((o) => o.active !== false && (officialCategory === "all" || o.level === officialCategory) && matchesDashboardSearch(o.name, o.role, o.committee, o.description, o.level)),
    [officials, officialCategory, normalizedSearch],
  );
  const filteredMessages = useMemo(
    () => messages.filter((m) => m.status !== "closed" && matchesMessageCategory(m.department, messageCategory) && matchesDashboardSearch(m.referenceNo, m.name, m.department, m.status, m.adminComment, m.handledByName) && matchesTableFilters("messages", m.createdAt, m.referenceNo, m.name, m.contact, m.department, m.message, m.status, m.adminComment, m.handledByName)),
    [messages, messageCategory, normalizedSearch, tableFilters],
  );
  const closedMessages = useMemo(
    () => messages
      .filter((m) => m.status === "closed" && matchesMessageCategory(m.department, messageCategory) && matchesDashboardSearch(m.referenceNo, m.name, m.department, m.status, m.adminComment, m.handledByName) && matchesTableFilters("messages", m.createdAt, m.referenceNo, m.name, m.contact, m.department, m.message, m.status, m.adminComment, m.handledByName))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()),
    [messages, messageCategory, normalizedSearch, tableFilters],
  );
  const filteredServices = useMemo(
    () => services
      .filter((s) => s.status !== "rejected" && matchesServiceCategory(s.serviceType, serviceCategory) && matchesDashboardSearch(s.referenceNo, s.serviceType, s.fullName, s.status, s.adminComment, s.handledByName) && matchesTableFilters("services", s.createdAt, s.referenceNo, s.serviceType, s.fullName, s.contactNumber, s.address, s.purpose, s.status, s.adminComment, s.handledByName))
      .sort((a, b) => {
        const diff = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        return serviceSortOrder === "newest" ? diff : -diff;
      }),
    [services, serviceCategory, normalizedSearch, tableFilters, serviceSortOrder],
  );
  const filteredReports = useMemo(
    () => reports
      .filter((r) => r.status !== "rejected" && matchesReportCategory(r.category, reportCategory) && matchesDashboardSearch(r.referenceNo, r.category, r.description, r.status, r.adminComment, r.handledByName) && matchesTableFilters("reports", r.createdAt, r.referenceNo, r.fullName, r.contactNumber, r.address, r.category, r.description, r.status, r.adminComment, r.handledByName))
      .sort((a, b) => {
        const diff = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        return reportSortOrder === "newest" ? diff : -diff;
      }),
    [reports, reportCategory, normalizedSearch, tableFilters, reportSortOrder],
  );
  const filteredEmergencyAlerts = useMemo(
    () => emergencyAlerts
      .filter((alert) => {
        const unresolved = alert.status === "active" || alert.status === "acknowledged";
        const statusMatch = liveAlertCategory === "all"
          || (liveAlertCategory === "unresolved" && unresolved)
          || (liveAlertCategory === "resolved" && alert.status === "resolved");
        return statusMatch && matchesDashboardSearch(
          alert.referenceNo,
          alert.situation,
          alert.status,
          alert.residentSnapshot?.username,
          alert.residentSnapshot?.fullName,
          alert.residentSnapshot?.email,
          alert.residentSnapshot?.contactNumber,
        ) && matchesTableFilters(
          "emergencyAlerts",
          alert.createdAt,
          alert.referenceNo,
          alert.situation,
          alert.status,
          alert.residentSnapshot?.username,
          alert.residentSnapshot?.fullName,
          alert.residentSnapshot?.email,
          alert.residentSnapshot?.contactNumber,
        );
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()),
    [emergencyAlerts, liveAlertCategory, normalizedSearch, tableFilters],
  );
  const filteredSubscriptions = useMemo(
    () => subscriptions.filter((s) => s.status !== "unsubscribed" && (subscriberCategory === "all" || s.status === subscriberCategory) && matchesDashboardSearch(s.email, s.source, s.status, s.adminComment, s.handledByName) && matchesTableFilters("subscriptions", s.createdAt, s.email, s.source, s.status, s.adminComment, s.handledByName)),
    [subscriptions, subscriberCategory, normalizedSearch, tableFilters],
  );
  const filteredActivities = useMemo(
    () => activities.filter((a) => (activityRoleCategory === "all" || a.userRole === activityRoleCategory) && matchesDashboardSearch(a.title, a.type, a.userName, a.userRole, a.referenceNo) && matchesTableFilters("audit", a.createdAt, a.title, a.type, a.userName, a.userRole, a.referenceNo)),
    [activities, activityRoleCategory, normalizedSearch, tableFilters],
  );
  const filteredAdminNotifications = useMemo(
    () => adminNotifications.filter((item) => {
      if (notificationCategory === "all") return true;
      const module = String(item.metadata?.module || item.type || "").toLowerCase();
      if (notificationCategory === "users") return module.includes("user") || module.includes("child");
      if (notificationCategory === "reports") return module.includes("report");
      if (notificationCategory === "live-alerts") return module.includes("emergency-alert") || module.includes("live");
      if (notificationCategory === "services") return module.includes("service");
      if (notificationCategory === "messages") return module.includes("message");
      if (notificationCategory === "announcements") return module.includes("announcement");
      if (notificationCategory === "child-access") return module.includes("child");
      return true;
    }).filter((item) => matchesDashboardSearch(item.title, item.type, item.userRole, item.referenceNo, item.metadata?.module) && matchesLocalSearch(normalizedNotificationSearch, item.title, item.type, item.userName, item.userRole, item.referenceNo, item.metadata?.module)),
    [adminNotifications, notificationCategory, normalizedSearch, normalizedNotificationSearch],
  );
  const archivedUsers = useMemo(() => users.filter((u) => u.status === "suspended" && matchesDashboardSearch(u.username, u.firstName, u.middleName, u.lastName, u.email, u.contactNumber, u.address, u.role) && matchesLocalSearch(normalizedRestoreSearch, u.username, u.firstName, u.middleName, u.lastName, u.email, u.contactNumber, u.address, u.role)), [users, normalizedSearch, normalizedRestoreSearch]);
  const archivedOfficials = useMemo(() => officials.filter((o) => o.active === false && matchesDashboardSearch(o.name, o.role, o.committee, o.description, o.level) && matchesLocalSearch(normalizedRestoreSearch, o.name, o.role, o.committee, o.description, o.level)), [officials, normalizedSearch, normalizedRestoreSearch]);
  const archivedAnnouncements = useMemo(() => announcements.filter((a) => a.archived && matchesDashboardSearch(a.title, a.content, a.category, a.module, a.source) && matchesLocalSearch(normalizedRestoreSearch, a.title, a.content, a.category, a.module, a.source)), [announcements, normalizedSearch, normalizedRestoreSearch]);
  const archivedReports = useMemo(() => reports.filter((r) => r.status === "rejected" && matchesDashboardSearch(r.referenceNo, r.category, r.description, r.status) && matchesLocalSearch(normalizedRestoreSearch, r.referenceNo, r.category, r.description, r.status)), [reports, normalizedSearch, normalizedRestoreSearch]);
  const archivedServices = useMemo(() => services.filter((s) => s.status === "rejected" && matchesDashboardSearch(s.referenceNo, s.serviceType, s.fullName, s.status) && matchesLocalSearch(normalizedRestoreSearch, s.referenceNo, s.serviceType, s.fullName, s.status)), [services, normalizedSearch, normalizedRestoreSearch]);
  const archivedMessages = useMemo(() => messages.filter((m) => m.status === "closed" && matchesDashboardSearch(m.referenceNo, m.name, m.department, m.status) && matchesLocalSearch(normalizedRestoreSearch, m.referenceNo, m.name, m.department, m.message, m.status)), [messages, normalizedSearch, normalizedRestoreSearch]);
  const archivedSubscriptions = useMemo(() => subscriptions.filter((s) => s.status === "unsubscribed" && matchesDashboardSearch(s.email, s.source, s.status) && matchesLocalSearch(normalizedRestoreSearch, s.email, s.source, s.status)), [subscriptions, normalizedSearch, normalizedRestoreSearch]);
  const restoreCategoryOptions = [
    { value: "users", label: "Users", count: archivedUsers.length },
    { value: "officials", label: "Officials", count: archivedOfficials.length },
    { value: "announcements", label: "Announcements", count: archivedAnnouncements.length },
    { value: "reports", label: "Reports", count: archivedReports.length },
    { value: "services", label: "Service Requests", count: archivedServices.length },
    { value: "messages", label: "Messages", count: archivedMessages.length },
    { value: "subscribers", label: "Subscribers", count: archivedSubscriptions.length },
  ];
  const selectedRestore = restoreCategoryOptions.find((item) => item.value === restoreCategory) || restoreCategoryOptions[0];

  const hasModulePermission = (moduleKey: keyof AdminPermissions, action: keyof PermissionFlags) => {
    if (role === "superadmin") return true;
    if (role !== "admin") return false;
    return myPermissions?.[moduleKey]?.[action] !== false;
  };
  const isProtectedSuperadminAccount = (user?: Partial<UserItem> | null) =>
    user?.role === "superadmin" && user?.username === "superAdmin123";

  const setSelectedAdminPermissionsAll = (enabled: boolean) => {
    setSelectedUser((p) => {
      if (!p) return p;
      const current = normalizeAdminPermissions(p.adminPermissions);
      (Object.keys(current) as Array<keyof AdminPermissions>).forEach((moduleKey) => {
        (Object.keys(current[moduleKey]) as Array<keyof PermissionFlags>).forEach((actionKey) => {
          current[moduleKey][actionKey] = enabled;
        });
      });
      return { ...p, adminPermissions: current };
    });
  };

  function startSyncProgress(title: string, message: string) {
    let progress = 12;
    setSyncOverlay({ isOpen: true, title, message, progress });
    const timer = window.setInterval(() => {
      progress = Math.min(92, progress + Math.max(2, Math.round((96 - progress) * 0.12)));
      setSyncOverlay((prev) => prev.isOpen ? { ...prev, progress } : prev);
    }, 280);
    return {
      update(nextMessage: string, nextProgress?: number) {
        if (typeof nextProgress === "number") progress = Math.max(progress, Math.min(96, nextProgress));
        setSyncOverlay((prev) => ({ ...prev, isOpen: true, title, message: nextMessage, progress }));
      },
      finish(finalMessage = "Records are up to date.") {
        window.clearInterval(timer);
        setSyncOverlay((prev) => ({ ...prev, isOpen: true, message: finalMessage, progress: 100 }));
        window.setTimeout(() => {
          setSyncOverlay((prev) => prev.progress >= 100 ? { ...prev, isOpen: false } : prev);
        }, 450);
      },
    };
  }

  function resolveSyncTitle(title: string) {
    const value = title.toLowerCase();
    if (value.includes("delete") || value.includes("deleted") || value.includes("removed")) return "Deleting data";
    if (value.includes("restore") || value.includes("restored")) return "Restoring data";
    if (value.includes("create") || value.includes("created") || value.includes("added")) return "Saving new data";
    if (value.includes("update") || value.includes("updated") || value.includes("save")) return "Saving changes";
    return "Updating data";
  }

  async function loadDashboardData(silent = false) {
    const tracker = silent ? null : startSyncProgress("Retrieving data", "Loading the latest dashboard records...");
    try {
      tracker?.update("Reading the latest saved records...", 28);
      const dashboardRequests = [
        { name: "users", request: api.get("/api/admin/users", { headers: authHeaders(), params: buildUserQueryParams() }) },
        { name: "officials", request: api.get("/api/officials/all", { headers: authHeaders() }) },
        { name: "announcements", request: api.get(canManage ? "/api/announcements/all" : "/api/announcements", { headers: canManage ? authHeaders() : undefined }) },
        { name: "reports", request: api.get("/api/reports", { headers: authHeaders() }) },
        { name: "service requests", request: api.get("/api/services/requests", { headers: authHeaders() }) },
        { name: "messages", request: api.get("/api/contact/messages", { headers: authHeaders() }) },
        { name: "subscribers", request: api.get("/api/subscriptions", { headers: authHeaders() }) },
        { name: "live alerts", request: api.get("/api/emergency-alerts", { headers: authHeaders() }) },
        { name: "activity", request: api.get("/api/admin/activity", { headers: authHeaders(), params: { date: activityLogDate || todayInputValue() } }) },
        { name: "notifications", request: api.get("/api/admin/notifications", { headers: authHeaders(), params: { date: notificationLogDate || todayInputValue() } }) },
        { name: "system settings", request: api.get("/api/admin/system-settings", { headers: authHeaders() }) },
        { name: "site content", request: api.get("/api/content/site") },
        { name: "service catalog", request: api.get("/api/services/catalog/all", { headers: authHeaders() }) },
        { name: "departments", request: api.get("/api/contact/departments") },
        { name: "account", request: api.get("/api/auth/user", { headers: authHeaders() }) },
      ];
      const results = await Promise.allSettled(dashboardRequests.map((item) => item.request));
      const readResult = <T,>(index: number, fallback: T): T => {
        const result = results[index];
        return result.status === "fulfilled" ? (result.value.data || fallback) : fallback;
      };
      tracker?.update("Applying fresh data to the dashboard...", 78);
      setUsers(readResult(0, users));
      setOfficials(readResult(1, officials));
      setAnnouncements(readResult(2, announcements));
      setReports(readResult(3, reports));
      setServices(readResult(4, services));
      setMessages(readResult(5, messages));
      setSubscriptions(readResult(6, subscriptions));
      setEmergencyAlerts(readResult(7, emergencyAlerts));
      const activityData = readResult<any>(8, []);
      const notificationData = readResult<any>(9, { items: [] });
      setActivities(Array.isArray(activityData) ? activityData : activityData?.items || activities);
      setAdminNotifications(notificationData?.items || adminNotifications);
      const nextSettings = { ...systemSettings, ...(readResult(10, {}) || {}) };
      setSystemSettings(nextSettings);
      setSavedSystemSettings(nextSettings);
      setSiteContent((p) => {
        const nextContent = { ...p, ...(readResult(11, {}) || {}) };
        return {
          ...nextContent,
          navbarBrandText: normalizeBrandName(nextContent.navbarBrandText),
          footerBrandText: normalizeBrandName(nextContent.footerBrandText),
        };
      });
      setMyPermissions(normalizeAdminPermissions(readResult<any>(14, {})?.adminPermissions));
      setServiceCatalog(readResult(12, serviceCatalog));
      setDepartments(readResult(13, departments));
      if (canManage) {
        const [evacRes, hotlineRes] = await Promise.allSettled([
          api.get("/api/services/evacuation-centers", { headers: authHeaders() }),
          api.get("/api/services/emergency-hotlines", { headers: authHeaders() }),
        ]);
        if (evacRes.status === "fulfilled") setEvacuationCenters(evacRes.value.data || []);
        if (hotlineRes.status === "fulfilled") setEmergencyHotlines(hotlineRes.value.data || []);
      }
      const failedSections = results
        .map((result, index) => result.status === "rejected" ? dashboardRequests[index].name : "")
        .filter(Boolean);
      tracker?.finish("Dashboard records are up to date.");
      if (failedSections.length > 0 && !silent) {
        setFeedback({
          type: "error",
          title: "Some sections did not load",
          message: `Please refresh if needed. Missing: ${failedSections.join(", ")}.`,
        });
      }
    } catch (err: any) {
      tracker?.finish("Sync failed. Please try again.");
      if (!silent) {
        setFeedback({ type: "error", title: "Load failed", message: err?.response?.data?.msg || "Could not load dashboard data." });
      }
    }
  }

  function buildUserQueryParams() {
    return {
      ...(userCategory !== "all" ? { role: userCategory } : {}),
      ...(userCategory === "user" && userApprovalCategory !== "all" ? { approval: userApprovalCategory } : {}),
    };
  }

  async function loadUsers() {
    try {
      const usersRes = await api.get("/api/admin/users", { headers: authHeaders(), params: buildUserQueryParams() });
      setUsers(usersRes.data || []);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Load failed", message: err?.response?.data?.msg || "Could not load users." });
    }
  }

  async function fetchUserDetails(user: UserItem) {
    try {
      const res = await api.get(`/api/admin/users/${user._id}`, { headers: authHeaders() });
      return { ...user, ...(res.data || {}) };
    } catch (_err) {
      return user;
    }
  }

  async function openSelectedUser(user: UserItem) {
    setSelectedUser(user);
    const detailedUser = await fetchUserDetails(user);
    setSelectedUser((current) => current?._id === user._id ? detailedUser : current);
  }

  async function fetchReportDetails(report: ReportItem) {
    try {
      const res = await api.get(`/api/reports/${report._id}`, { headers: authHeaders() });
      return { ...report, ...(res.data || {}) };
    } catch (_err) {
      return report;
    }
  }

  async function openReportManageModal(report: ReportItem) {
    setReportManageModal(report);
    const detailedReport = await fetchReportDetails(report);
    setReportManageModal((current) => current?._id === report._id ? detailedReport : current);
  }

  async function openReportAttachment(report: ReportItem) {
    const existingAttachment = report.attachments?.find((item) => item.dataUrl);
    if (existingAttachment?.dataUrl) {
      setAttachmentPreview({
        title: report.referenceNo,
        name: existingAttachment.name,
        type: existingAttachment.type,
        dataUrl: existingAttachment.dataUrl,
      });
      return;
    }

    setAttachmentLoadingId(report._id);
    try {
      const detailedReport = await fetchReportDetails(report);
      setReportManageModal((current) => current?._id === report._id ? detailedReport : current);
      const detailedAttachment = detailedReport.attachments?.find((item) => item.dataUrl);
      if (detailedAttachment?.dataUrl) {
        setAttachmentPreview({
          title: detailedReport.referenceNo,
          name: detailedAttachment.name,
          type: detailedAttachment.type,
          dataUrl: detailedAttachment.dataUrl,
        });
        return;
      }
      setFeedback({ type: "error", title: "Attachment unavailable", message: "The uploaded file could not be opened right now." });
    } finally {
      setAttachmentLoadingId(null);
    }
  }

  async function openLiveAlertChat(alert: EmergencyAlertItem) {
    setLiveAlertChatModal(alert);
    setLiveAlertChatText("");
    setLiveAlertChatAttachments([]);
    try {
      const res = await api.get(`/api/emergency-alerts/${alert._id}/messages`, { headers: authHeaders() });
      setLiveAlertChatMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
      setLiveAlertChatTyping(res.data?.typing || {});
      if (res.data?.alert) {
        setLiveAlertChatModal((current) => current?._id === alert._id ? { ...current, ...(res.data.alert || {}) } : current);
      }
    } catch (_err) {
      setLiveAlertChatMessages([]);
      setLiveAlertChatTyping({});
    }
  }

  const fileToDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

  async function addLiveAlertChatFiles(files: FileList | null) {
    if (!files?.length) return;
    const next: ChatAttachment[] = [];
    for (const file of Array.from(files).slice(0, 3)) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        setFeedback({ type: "error", title: "Invalid attachment", message: "Only image and video files can be attached to live chat." });
        continue;
      }
      if (file.size > 4 * 1024 * 1024) {
        setFeedback({ type: "error", title: "Attachment too large", message: `${file.name} must be under 4MB.` });
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      next.push({ name: file.name, type: file.type, size: file.size, dataUrl });
    }
    setLiveAlertChatAttachments((prev) => [...prev, ...next].slice(0, 3));
    if (liveAlertFileInputRef.current) liveAlertFileInputRef.current.value = "";
  }

  function markLiveAlertChatTyping(isTyping: boolean) {
    const alertId = liveAlertChatModal?._id;
    if (!alertId) return;
    void api.patch(`/api/emergency-alerts/${alertId}/typing`, { isTyping }, { headers: authHeaders() }).catch(() => undefined);
    if (liveAlertTypingTimerRef.current !== null) {
      window.clearTimeout(liveAlertTypingTimerRef.current);
    }
    if (isTyping) {
      liveAlertTypingTimerRef.current = window.setTimeout(() => {
        void api.patch(`/api/emergency-alerts/${alertId}/typing`, { isTyping: false }, { headers: authHeaders() }).catch(() => undefined);
      }, 1800);
    }
  }

  async function sendLiveAlertChatMessage() {
    const alertId = liveAlertChatModal?._id;
    const message = liveAlertChatText.trim();
    if (!alertId || (!message && liveAlertChatAttachments.length === 0) || liveAlertChatSending) return;
    setLiveAlertChatSending(true);
    try {
      const res = await api.post(`/api/emergency-alerts/${alertId}/messages`, { message, attachments: liveAlertChatAttachments }, { headers: authHeaders() });
      setLiveAlertChatMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
      setLiveAlertChatTyping(res.data?.typing || {});
      setLiveAlertChatText("");
      setLiveAlertChatAttachments([]);
      markLiveAlertChatTyping(false);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Message failed", message: err?.response?.data?.msg || "Could not send the live chat message." });
    } finally {
      setLiveAlertChatSending(false);
    }
  }

  async function endLiveAlertChat(alert: EmergencyAlertItem) {
    const note = `The live chat was ended by ${role === "superadmin" ? "the superadmin" : "barangay staff"}. Please rate the help you received.`;
    await runActionWithFeedback(
      "Live chat ended",
      () => api.patch(`/api/emergency-alerts/${alert._id}/end-chat`, { message: note }, { headers: authHeaders() }),
    );
    setLiveAlertChatModal((current) => current?._id === alert._id ? { ...current, status: "resolved", chatEndedAt: new Date().toISOString() } : current);
  }

  async function clearAdminNotifications(event?: ReactMouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    try {
      await api.patch("/api/admin/notifications/clear", {}, { headers: authHeaders() });
      setAdminNotifications([]);
      setShowAdminNotifications(false);
      setFeedback({ type: "success", title: "Notifications cleared", message: "Cleared notifications will stay hidden after refresh." });
    } catch (err: any) {
      setFeedback({ type: "error", title: "Clear failed", message: err?.response?.data?.msg || "Could not clear notifications right now." });
    }
  }

  async function runActionWithFeedback(title: string, action: () => Promise<void>) {
    const tracker = startSyncProgress(resolveSyncTitle(title), "Saving your changes...");
    try {
      tracker.update("Saving changes to the official records...", 38);
      await action();
      tracker.update("Refreshing the system view...", 76);
      await loadDashboardData(true);
      tracker.finish("Records are up to date.");
      setFeedback({ type: "success", title, message: `Completed at ${new Date().toLocaleString()}` });
    } catch (err) {
      tracker.finish("Sync failed. No local state was finalized.");
      throw err;
    }
  }

  const reasonOptions = [
    "Incomplete or invalid documents",
    "Fraudulent or mismatched information",
    "Duplicate account or duplicate request",
    "Needs correction or resubmission",
    "Violation of barangay registration rules",
    "Other",
  ];

  const resolveReasonText = () => {
    if (userReasonChoice === "Other") return userReasonCustom.trim();
    return userReasonChoice.trim();
  };

  async function updateUserStatusDirect(target: UserItem, nextStatus: UserItem["status"], nextValidIdStatus: "pending" | "approved" | "rejected", reason = "", nextRole?: string) {
    setActionLoading(true);
    setReviewUserPrompt(null);
    try {
      await runActionWithFeedback(
        nextStatus === "active" ? "User approved" : nextStatus === "suspended" ? "User rejected" : "User updated",
        () => api.patch(`/api/admin/users/${target._id}/status`, {
          status: nextStatus,
          validIdStatus: nextValidIdStatus,
          reason,
          ...(canManage ? { role: nextRole || target.role } : {}),
        }, { headers: authHeaders() }),
      );
      setSelectedUser(null);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Action failed", message: err?.response?.data?.msg || "Please try again." });
    } finally {
      setActionLoading(false);
    }
  }

  function openUserReasonPrompt(prompt: UserReasonPrompt) {
    setUserReasonPrompt(prompt);
    setUserReasonChoice("Incomplete or invalid documents");
    setUserReasonCustom("");
  }

  async function confirmUserReasonPrompt() {
    if (!userReasonPrompt) return;
    const reason = resolveReasonText();
    if (!reason) {
      setFeedback({ type: "error", title: "Reason required", message: "Select a reason or enter a custom reason before continuing." });
      return;
    }
    setActionLoading(true);
    try {
      if (userReasonPrompt.kind === "user-status") {
        await runActionWithFeedback(
          userReasonPrompt.validIdStatus === "rejected" ? "User review updated" : "Resident updated",
          () => api.patch(`/api/admin/users/${userReasonPrompt.userId}/status`, {
            status: userReasonPrompt.nextStatus,
            validIdStatus: userReasonPrompt.validIdStatus,
            role: userReasonPrompt.role,
            reason,
          }, { headers: authHeaders() }),
        );
        setSelectedUser(null);
        setReviewUserPrompt(null);
        setUserEditModal(null);
        setAccountControlModal(null);
      } else {
        await runActionWithFeedback(
          userReasonPrompt.nextStatus === "approved" ? "Child access approved" : userReasonPrompt.nextStatus === "pending" ? "Child access returned to pending" : "Child access rejected",
          () => api.patch(`/api/admin/users/${userReasonPrompt.userId}/children/${userReasonPrompt.childId}/status`, {
            status: userReasonPrompt.nextStatus,
            reason,
          }, { headers: authHeaders() }),
        );
        setSelectedUser(null);
      }
      setUserReasonPrompt(null);
    } catch (err: any) {
      setFeedback({ type: "error", title: "Action failed", message: err?.response?.data?.msg || "Please try again." });
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    try { await pendingAction.run(); setPendingAction(null); } catch (err: any) { setFeedback({ type: "error", title: "Action failed", message: err?.response?.data?.msg || "Please try again." }); }
    finally { setActionLoading(false); }
  }

  async function deleteUserAccount(userId: string) {
    await runActionWithFeedback("User deleted", async () => {
      await api.delete(`/api/admin/users/${userId}`, { headers: authHeaders() });
    });
    setSelectedUser(null);
    setUserEditModal(null);
    setAccountControlModal(null);
  }

  async function saveManagedReport(report: ReportItem) {
    await runActionWithFeedback("Report updated", async () => {
      await api.put(`/api/reports/${report._id}`, report, { headers: authHeaders() });
    });
    setReportManageModal(null);
  }

  async function saveManagedServiceRequest(request: ServiceRequest) {
    await runActionWithFeedback("Service request updated", async () => {
      await api.put(`/api/services/requests/${request._id}`, request, { headers: authHeaders() });
    });
    setServiceManageModal(null);
  }

  async function saveManagedMessage(message: ContactMessage) {
    await runActionWithFeedback("Message updated", async () => {
      await api.put(`/api/contact/messages/${message._id}`, message, { headers: authHeaders() });
    });
    setMessageManageModal(null);
  }

  async function saveManagedSubscriber(subscription: Subscription) {
    await runActionWithFeedback("Subscriber updated", async () => {
      await api.put(`/api/subscriptions/${subscription._id}`, subscription, { headers: authHeaders() });
    });
    setSubscriptionManageModal(null);
  }

  function confirmLogout() { setIsLoggingOut(true); setTimeout(() => { clearAuthSession(); navigate("/login"); }, 3000); }

  function fileToBase64(file: File, cb: (value: string) => void) {
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  function pairsToLines(items: Array<{ label: string; value: string }>) {
    return (items || []).map((x) => `${x.label}|${x.value}`).join("\n");
  }

  function linesToPairs(text: string) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, ...rest] = line.split("|");
        return { label: (label || "").trim(), value: rest.join("|").trim() };
      })
      .filter((x) => x.label && x.value);
  }

  const navGroups: Array<
    | { kind: "item"; id: Panel; label: string; icon: JSX.Element }
    | { kind: "group"; label: string; icon: JSX.Element; open: boolean; setOpen: (value: boolean) => void; children: Array<{ id: Panel; label: string; icon: JSX.Element }> }
  > = [
    { kind: "item", id: "overview", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    {
      kind: "group",
      label: "Management",
      icon: <Users size={16} />,
      open: managementNavOpen,
      setOpen: setManagementNavOpen,
      children: [
        { id: "users", label: "Users", icon: <Users size={16} /> },
        { id: "officials", label: "Officials", icon: <Building2 size={16} /> },
        { id: "announcements", label: "Announcements", icon: <Bell size={16} /> },
        { id: "reports", label: "Reports", icon: <AlertTriangle size={16} /> },
        { id: "emergencyAlerts", label: "Live Alerts", icon: <MapPin size={16} /> },
        { id: "services", label: "Service Requests", icon: <FileText size={16} /> },
        { id: "messages", label: "Messages", icon: <Mail size={16} /> },
        { id: "subscriptions", label: "Subscribers", icon: <Mail size={16} /> },
        { id: "restore", label: "Restore Data", icon: <Archive size={16} /> },
      ],
    },
    {
      kind: "group",
      label: "System Settings",
      icon: <Settings size={16} />,
      open: systemNavOpen,
      setOpen: setSystemNavOpen,
      children: [
        { id: "settings", label: "System Settings", icon: <Settings size={16} /> },
        { id: "notifications", label: "System Notifications", icon: <Bell size={16} /> },
        { id: "audit", label: "My Activity", icon: <ClipboardCheck size={16} /> },
      ],
    },
  ];

  const card = "space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
  const modalOverlay = "fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-200";
  const modalCard = "w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-200";
  const btnPrimary = "inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700";
  const btnSecondary = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50";
  const btnDanger = "inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50";
  const iconBtn = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50";
  const iconBtnDanger = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 bg-white text-red-700 transition hover:bg-red-50";
  const iconDangerBtn = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 bg-white text-red-700 transition hover:bg-red-50";
  const inputBase = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-slate-400 focus:bg-white focus:outline-none";
  const sectionCard = "rounded-xl border border-slate-200 bg-slate-50/70 p-3";
  const moduleGrid = "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
  const moduleCard = "rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm transition hover:border-slate-300 hover:shadow-md";

  const handlerOptions = useMemo<HandlerOption[]>(() => {
    const userFullName = (user: UserItem) =>
      [user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ").trim()
      || user.username
      || user.email;

    const adminOptions = users
      .filter((user) => ["admin", "superadmin"].includes(String(user.role || "").toLowerCase()) && user.status !== "suspended")
      .map((user) => {
        const name = userFullName(user);
        const roleLabel = user.role === "superadmin" ? "Superadmin" : "Admin";
        return {
          value: `user:${user._id}`,
          label: `${name} (${roleLabel})`,
          category: "Admins" as const,
          name,
          role: user.role || "admin",
          userId: user._id,
        };
      });

    const officialOptions = officials
      .filter((official) => official.active !== false)
      .map((official) => ({
        value: `official:${official._id}`,
        label: `${official.name}${official.role ? ` (${official.role})` : ""}`,
        category: "Barangay Officials / Staff" as const,
        name: official.name,
        role: official.role || "Barangay Official",
        userId: null,
      }));

    return [...adminOptions, ...officialOptions];
  }, [users, officials]);

  const adminHandlerOptions = handlerOptions.filter((option) => option.category === "Admins");
  const officialHandlerOptions = handlerOptions.filter((option) => option.category === "Barangay Officials / Staff");

  function selectedHandlerValue(item?: HandlerInfo | null) {
    if (!item?.handledByName && !item?.handledByRole && !item?.handledByUser) return "";
    const handledByUser = item.handledByUser ? String(item.handledByUser) : "";
    const selectedByUser = handledByUser ? handlerOptions.find((option) => option.userId === handledByUser) : null;
    if (selectedByUser) return selectedByUser.value;
    return handlerOptions.find((option) => option.name === item.handledByName && option.role === item.handledByRole)?.value || "";
  }

  function applySelectedHandler<T extends HandlerInfo>(value: string, setter: Dispatch<SetStateAction<T | null>>) {
    const selected = handlerOptions.find((option) => option.value === value);
    setter((prev) => prev ? {
      ...prev,
      handledByName: selected?.name || "",
      handledByRole: selected?.role || "",
      handledByUser: selected?.userId || null,
    } : prev);
  }

  function renderHandlerSelect<T extends HandlerInfo>(item: T | null, setter: Dispatch<SetStateAction<T | null>>) {
    return (
      <LabeledField label="Handled by">
        <select className={inputBase} value={selectedHandlerValue(item)} onChange={(e) => applySelectedHandler(e.target.value, setter)}>
          <option value="">Not assigned</option>
          <optgroup label="Admins">
            {adminHandlerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </optgroup>
          <optgroup label="Barangay Officials / Staff">
            {officialHandlerOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </optgroup>
        </select>
        <span className="mt-1 block text-xs text-slate-500">Current: {handlerLabel(item || undefined)}</span>
      </LabeledField>
    );
  }

  return (
    <div className="dashboard-mobile-cards min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100">
      <div className={`sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur transition-[margin] duration-200 ${isSidebarCollapsed ? "md:ml-20" : "md:ml-[280px]"}`}>
        <div className="flex w-full items-center gap-3 px-4 py-4 sm:px-6">
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-900 text-white md:hidden" onClick={() => setIsMenuOpen((v) => !v)} type="button" aria-label="Toggle sidebar">
            <img src={dashboardLogo} alt="BayanTrack" className="h-7 w-7 rounded-full object-cover" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">BayanTrack Admin Panel</p>
            <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{role === "superadmin" ? "Superadmin Dashboard" : "Admin Dashboard"}</h1>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <div
              className="relative flex min-w-0 max-w-xl flex-1 items-center"
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsSearchOpen(false);
              }}
            >
              <Search size={16} className="pointer-events-none absolute left-3 text-slate-400" />
              <input
                aria-label="Search dashboard"
                className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                placeholder="Search all dashboard records..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onFocus={() => setIsSearchOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsSearchOpen(false);
                  if (e.key === "Enter" && dashboardSearchResults[0]) openDashboardSearchResult(dashboardSearchResults[0]);
                }}
              />
              {searchQuery ? (
                <button
                  className="absolute right-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearchOpen(false);
                  }}
                  type="button"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
              {isSearchOpen && normalizedSearch ? (
                <div className="absolute left-0 right-0 top-12 z-40 max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  {dashboardSearchResults.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">No matching dashboard records.</p>
                  ) : dashboardSearchResults.map((result) => (
                    <button
                      key={result.key}
                      className="block w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => openDashboardSearchResult(result)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-semibold text-slate-900">{result.title}</p>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{result.module}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">{result.subtitle}</p>
                      {result.meta ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{result.meta}</p> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div
              className="relative"
              onMouseEnter={() => setShowAdminNotifications(true)}
              onMouseLeave={() => setShowAdminNotifications(false)}
            >
              <button className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50" type="button" aria-label="Notifications" onClick={() => setShowAdminNotifications((value) => !value)}>
                <Bell size={16} />
                {recentAdminNotices.length > 0 ? (
                  <>
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
                    <span className="absolute -right-1 -top-1 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">{recentAdminNotices.length}</span>
                  </>
                ) : null}
              </button>
              {showAdminNotifications ? (
                <div className="absolute right-0 top-12 z-30 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Notifications</p>
                    <div className="flex items-center gap-2">
                      <button className="text-[11px] font-semibold text-slate-500 hover:text-slate-900" onClick={() => { setActivePanel("notifications"); setShowAdminNotifications(false); }} type="button">View all</button>
                      <button className="text-[11px] font-semibold text-slate-500 hover:text-slate-900" onClick={(event) => void clearAdminNotifications(event)} type="button">Clear all</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {recentAdminNotices.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">No recent dashboard updates.</p>
                    ) : recentAdminNotices.slice(0, 5).map((item) => (
                      <div key={item._id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{item.userRole || "system"} | {new Date(item.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute left-4 right-4 top-20 rounded-xl border border-slate-200 bg-white p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {navGroups.map((item) => {
              if (item.kind === "item") {
                return <button key={item.id} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${activePanel === item.id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`} onClick={() => { setActivePanel(item.id); setIsMenuOpen(false); }} type="button">{item.icon}<span className="min-w-0">{item.label}</span></button>;
              }
              const activeGroup = item.children.some((child) => child.id === activePanel);
              return (
                <div key={item.label} className="mb-1">
                  <button className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-300 ease-out ${activeGroup ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"}`} onClick={() => item.setOpen(!item.open)} type="button">
                    {item.icon}<span className="min-w-0 flex-1">{item.label}</span><ChevronDown size={15} className={`transition-transform duration-300 ease-out ${item.open ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-out ${item.open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <div className="ml-4 mt-1 space-y-1 border-l border-slate-200 pl-2">
                        {item.children.map((child) => <button key={child.id} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200 ease-out ${activePanel === child.id ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`} onClick={() => { setActivePanel(child.id); setIsMenuOpen(false); }} type="button">{child.icon}<span className="min-w-0">{child.label}</span></button>)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${isSidebarCollapsed ? "md:pl-20" : "md:pl-[280px]"}`}>
        <aside className={`hidden overflow-hidden border-r border-slate-200 bg-white shadow-sm transition-[width] duration-200 md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:h-screen md:flex-col ${isSidebarCollapsed ? "md:w-20" : "md:w-[280px]"}`}>
          <div className="border-b border-slate-100 px-3 py-4">
            <button
              className={`flex items-center gap-3 rounded-2xl text-left transition ${isSidebarCollapsed ? "w-full justify-center px-2 py-2 hover:bg-slate-100" : "w-full px-2 py-2 hover:bg-slate-100"}`}
              onClick={() => setIsSidebarCollapsed((value) => !value)}
              type="button"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm">
                <img src={dashboardLogo} alt="BayanTrack" className="h-full w-full object-cover" />
              </div>
              {!isSidebarCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{role === "superadmin" ? "Superadmin Dashboard" : "Admin Dashboard"}</p>
                  <p className="truncate text-xs text-slate-500">BayanTrack Admin Panel</p>
                </div>
              ) : null}
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
            {navGroups.map((item) => {
              if (item.kind === "item") {
                const active = activePanel === item.id;
                return (
                  <button
                    key={item.id}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"}`}
                    onClick={() => { setActivePanel(item.id); setIsMenuOpen(false); }}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">{item.icon}</span>
                    {!isSidebarCollapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
                  </button>
                );
              }
              const activeGroup = item.children.some((child) => child.id === activePanel);
              return (
                <div key={item.label} className="space-y-1">
                  <button
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-out ${activeGroup ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100"}`}
                    onClick={() => {
                      if (isSidebarCollapsed) {
                        setIsSidebarCollapsed(false);
                        item.setOpen(true);
                        return;
                      }
                      item.setOpen(!item.open);
                    }}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">{item.icon}</span>
                    {!isSidebarCollapsed ? <span className="min-w-0 flex-1 truncate text-left">{item.label}</span> : null}
                    {!isSidebarCollapsed ? <ChevronDown size={15} className={`transition-transform duration-300 ease-out ${item.open ? "rotate-180" : ""}`} /> : null}
                  </button>
                  {isSidebarCollapsed ? null : (
                    <div className={`grid transition-all duration-300 ease-out ${item.open ? "grid-rows-[1fr] opacity-100 translate-y-0" : "grid-rows-[0fr] -translate-y-1 opacity-0"}`}>
                      <div className="overflow-hidden">
                        <div className="ml-5 space-y-1 border-l border-slate-200 pl-3">
                          {item.children.map((child) => {
                            const active = activePanel === child.id;
                            return (
                              <button
                                key={child.id}
                                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out ${active ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-slate-100"}`}
                                onClick={() => { setActivePanel(child.id); setIsMenuOpen(false); }}
                                type="button"
                                title={child.label}
                                aria-label={child.label}
                              >
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">{child.icon}</span>
                                <span className="min-w-0 truncate">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="border-t border-slate-100 px-3 py-4">
            {!isSidebarCollapsed ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                    <CircleUserRound size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Profile</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{role === "superadmin" ? "Superadmin" : "Admin"}</p>
                    <p className="truncate text-xs text-slate-500">{role === "superadmin" ? "Superadmin Dashboard" : "Admin Dashboard"}</p>
                  </div>
                </div>
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700" onClick={() => setShowLogoutDialog(true)} type="button">
                  <LogOut size={14} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50" type="button" aria-label="Profile" title="Profile">
                  <CircleUserRound size={18} />
                </button>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50" onClick={() => setShowLogoutDialog(true)} type="button" aria-label="Logout" title="Logout">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 space-y-4 px-4 py-4 sm:px-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">{role === "superadmin" ? "Superadmin Control" : "Admin Workspace"}</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">Dashboard</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">Monitor registrations, requests, reports, notifications, and system activity in one place.</p>
              </div>
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Daily Snapshot</p>
                <p className="mt-1 text-[11px] text-slate-500">{activityLogDate === todayInputValue() ? "Today" : activityLogDate}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] text-slate-500">Recent Activities</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{activities.length}</p>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-[11px] text-slate-500">Unread-like Queue</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{stats.pendingUsers + stats.pendingServices + stats.unreadMessages}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {activePanel === "overview" && (
            <section className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs text-slate-500">Users</p><p className="text-3xl font-bold">{stats.users}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs text-slate-500">Pending Approval</p><p className="text-3xl font-bold">{stats.pendingUsers}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs text-slate-500">Announcements</p><p className="text-3xl font-bold">{stats.announcements}</p></div>
                <button className="rounded-xl border border-red-100 bg-red-50 p-5 text-left shadow-sm transition hover:bg-red-100" onClick={() => setActivePanel("emergencyAlerts")} type="button">
                  <p className="text-xs text-red-700">Live Alerts</p>
                  <p className="text-3xl font-bold text-red-800">{stats.liveAlerts}</p>
                </button>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs text-slate-500">Subscribers</p><p className="text-3xl font-bold">{stats.subscribers}</p></div>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <DonutStat title="Account Status Distribution" data={statusDonutData} />
                <DonutStat title="System Workload Mix" data={requestDonutData} />
              </div>
              <div className="grid gap-4 xl:grid-cols-[1fr,1.4fr]">
                <section className={card}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">Live Chat Help Rating</h3>
                      <p className="mt-1 text-xs text-slate-500">Resident feedback after resolved live emergency chats.</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-right">
                      <p className="text-xs font-semibold text-amber-700">Average</p>
                      <p className="text-2xl font-bold text-amber-900">{alertRatingSummary.count ? alertRatingSummary.average.toFixed(1) : "0.0"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={18} fill={star <= Math.round(alertRatingSummary.average) ? "currentColor" : "none"} />)}
                    <span className="ml-2 text-xs font-semibold text-slate-500">{alertRatingSummary.count} rated alert{alertRatingSummary.count === 1 ? "" : "s"}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {alertRatingSummary.comments.length === 0 ? <p className="text-xs text-slate-500">No rating comments yet.</p> : alertRatingSummary.comments.map((alert) => (
                      <div key={alert._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                        <p className="font-bold text-slate-900">{alert.referenceNo} - {alert.residentRating}/5</p>
                        <p className="mt-1 text-slate-600">{alert.residentRatingComment}</p>
                      </div>
                    ))}
                  </div>
                </section>
                <section className={card}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">Recent System Activity</h3>
                      <p className="mt-1 text-xs text-slate-500">Latest actions with available contact details.</p>
                    </div>
                    <button className={btnSecondary} onClick={() => setActivePanel("audit")} type="button">View All</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {recentActivityDetails.length === 0 ? <p className="text-sm text-slate-500">No recent activity for this date.</p> : recentActivityDetails.map((item) => (
                      <div key={item._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{item.userFullName || item.userName || "System"} <span className="font-semibold text-slate-500">({item.userRole || "system"})</span></p>
                            <p className="mt-1 text-xs text-slate-600">{item.title}</p>
                          </div>
                          <span className="text-[11px] text-slate-500">{formatDateTime(item.createdAt)}</span>
                        </div>
                        <div className="mt-2 grid gap-1 text-[11px] text-slate-500 sm:grid-cols-3">
                          <p className="truncate">Contact: {item.userContact || "N/A"}</p>
                          <p className="truncate">Email: {item.userEmail || "N/A"}</p>
                          <p className="truncate">Address: {item.userAddress || "N/A"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Previous Months Activity</h3>
                  <span className="text-xs text-slate-500">Last 6 months</span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {monthlySeries.map((series) => {
                    const max = Math.max(1, ...monthlyOverview.map((row) => Number(row[series.key as keyof typeof row] || 0)));
                    return (
                      <div key={series.key} className={`rounded-2xl border ${series.border} bg-slate-50 p-4`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{series.label}</p>
                          <button className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100" onClick={() => setMonthlyDetailModal(series.key)} type="button">View</button>
                        </div>
                        <div className="mt-4 flex h-36 items-end gap-2">
                          {monthlyOverview.map((row) => {
                            const value = Number(row[series.key as keyof typeof row] || 0);
                            return (
                              <div key={`${series.key}-${row.key}`} className="flex flex-1 flex-col items-center gap-2">
                                <div className="flex h-28 w-full items-end">
                                  <div className={`w-full rounded-t-md ${series.color}`} style={{ height: `${Math.max(8, Math.round((value / max) * 100))}%` }} />
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500">{row.label}</span>
                                <span className="text-[10px] text-slate-700">{value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <div className="grid gap-4 xl:grid-cols-3">
                <section className={card}><h3 className="font-semibold">Service Categories</h3>{chartServices.length === 0 ? <p className="text-xs text-slate-500">No data</p> : chartServices.map((x) => <MiniBar key={x.label} label={x.label} value={x.value} max={Math.max(...chartServices.map((a) => a.value))} />)}</section>
                <section className={card}><h3 className="font-semibold">Report Categories</h3>{chartReports.length === 0 ? <p className="text-xs text-slate-500">No data</p> : chartReports.map((x) => <MiniBar key={x.label} label={x.label} value={x.value} max={Math.max(...chartReports.map((a) => a.value))} />)}</section>
                <section className={card}><h3 className="font-semibold">Announcement Modules</h3>{chartAnnouncements.length === 0 ? <p className="text-xs text-slate-500">No data</p> : chartAnnouncements.map((x) => <MiniBar key={x.label} label={x.label} value={x.value} max={Math.max(...chartAnnouncements.map((a) => a.value))} />)}</section>
              </div>
            </section>
          )}

          {activePanel === "users" && (
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Users</h2>
                {canManage ? <button className={btnPrimary} onClick={() => setAddUserOpen(true)} type="button">Create User</button> : null}
              </div>
              <PanelSearchFilters value={tableFilters.users} onChange={(next) => updateTableFilter("users", next)} placeholder="Search users..." />
              <CategoryFilter title="User Categories" options={userCategoryOptions} value={userCategory} onChange={setUserCategory} />
              {userCategory === "user" && (
                <CategoryFilter title="User Approval" options={userApprovalOptions} value={userApprovalCategory} onChange={setUserApprovalCategory} />
              )}
              {userCategory === "user" && (
                <CategoryFilter title="Parent Account" options={userParentOptions} value={userParentCategory} onChange={setUserParentCategory} />
              )}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Username</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{[user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || "N/A"}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{user.username}</td>
                        <td className="px-4 py-3"><Badge value={user.role} /></td>
                        <td className="px-4 py-3"><Badge value={user.status === "active" ? "approved" : user.status === "suspended" ? "rejected" : "pending"} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button className={btnSecondary} onClick={() => void openSelectedUser(user)} type="button">View Details</button>
                            {canManage && (
                              <button className={btnSecondary} onClick={() => setUserEditModal({ ...user, password: "" })} type="button">Edit</button>
                            )}
                            {canManage && !(user.role === "superadmin" && user.username === "superAdmin123") && (
                              <button
                                className={iconBtn}
                                onClick={() => setPendingAction({
                                  title: user.status === "suspended" ? "Activate User" : "Archive User",
                                  message: `${user.status === "suspended" ? "Activate" : "Archive"} ${user.username}?`,
                                  confirmLabel: user.status === "suspended" ? "Activate" : "Archive",
                                  run: () => user.status === "suspended"
                                    ? runActionWithFeedback("User status updated", () => api.patch(`/api/admin/users/${user._id}/status`, { status: "active", validIdStatus: "approved" }, { headers: authHeaders() }))
                                    : Promise.resolve(openUserReasonPrompt({ kind: "user-status", title: "Archive User", userId: user._id, username: user.username, nextStatus: "suspended", validIdStatus: "rejected", role: user.role })),
                                })}
                                type="button"
                                title={user.status === "suspended" ? "Activate user" : "Archive user"}
                                aria-label={user.status === "suspended" ? "Activate user" : "Archive user"}
                              >
                                <Archive size={16} />
                              </button>
                            )}
                            {canManage && !(user.role === "superadmin" && user.username === "superAdmin123") && (
                              <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Permanently", message: `Delete ${user.username} and linked records?`, confirmLabel: "Delete", run: () => deleteUserAccount(user._id) })} type="button">Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredUsers.length === 0 && <p className="mt-2 text-sm text-slate-500">No users in this category.</p>}
            </section>
          )}

          {activePanel === "officials" && (
            <section className={card}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Officials</h2>
                {hasModulePermission("officials", "add") && (
                  <button className={btnPrimary} onClick={() => setAddOfficialOpen(true)} type="button">Add Official</button>
                )}
              </div>
              <CategoryFilter title="Official Categories" options={officialCategoryOptions} value={officialCategory} onChange={setOfficialCategory} />
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Official</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">Level</th>
                      <th className="px-4 py-3 font-semibold">Committee</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOfficials.map((o) => (
                      <tr key={o._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <img src={o.image || "https://placehold.co/80x80/e2e8f0/475569?text=Official"} alt={o.name} className="h-10 w-10 rounded-full border object-cover" />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{o.name}</p>
                              <p className="text-xs text-slate-500">{o.description || "No description"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{o.role}</td>
                        <td className="px-4 py-3"><Badge value={o.level} /></td>
                        <td className="px-4 py-3 text-slate-700">{o.committee || "N/A"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {hasModulePermission("officials", "edit") && <button className={btnSecondary} onClick={() => setOfficialEditModal(o)} type="button">Edit</button>}
                            {hasModulePermission("officials", "archive") && (
                              <button
                                className={iconBtn}
                                onClick={() => setPendingAction({ title: o.active === false ? "Activate Official" : "Archive Official", message: `${o.active === false ? "Activate" : "Archive"} ${o.name}?`, confirmLabel: "Confirm", run: () => runActionWithFeedback("Official updated", () => api.put(`/api/officials/${o._id}`, { ...o, active: o.active === false }, { headers: authHeaders() })) })}
                                type="button"
                                title={o.active === false ? "Activate official" : "Archive official"}
                                aria-label={o.active === false ? "Activate official" : "Archive official"}
                              >
                                <Archive size={16} />
                              </button>
                            )}
                            {hasModulePermission("officials", "delete") && <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Official", message: `Delete ${o.name}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Official removed", () => api.delete(`/api/officials/${o._id}`, { headers: authHeaders() })) })} type="button">Delete</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredOfficials.length === 0 && <p className="mt-2 text-sm text-slate-500">No officials in this category.</p>}
            </section>
          )}

          {activePanel === "announcements" && (
            <section className={card}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Announcements</h2>
                {hasModulePermission("announcements", "add") && (
                  <button className={btnPrimary} onClick={() => setAddAnnouncementOpen(true)} type="button">Create Announcement</button>
                )}
              </div>
              <PanelSearchFilters value={tableFilters.announcements} onChange={(next) => updateTableFilter("announcements", next)} placeholder="Search announcements..." />
              <CategoryFilter title="Announcement Categories" options={announcementCategoryOptions} value={announcementCategory} onChange={setAnnouncementCategory} />
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-[42%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[10%]" />
                    <col className="w-[18%]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Module</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAnnouncements.map((a) => (
                      <tr key={a._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold leading-5 text-slate-900">{a.title}</p>
                            <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">{a.content || "No content provided."}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] leading-5 text-slate-700 break-words">{a.module}</td>
                        <td className="px-4 py-3 text-[13px] leading-5 text-slate-700 break-words">{a.category}</td>
                        <td className="px-4 py-3 align-middle"><div className="w-fit"><Badge value={a.archived ? "archived" : "active"} /></div></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-nowrap items-center gap-2">
                            {hasModulePermission("announcements", "edit") && (
                              <button className={iconBtn} onClick={() => setAnnouncementEditModal(a)} type="button" title="Edit announcement" aria-label="Edit announcement">
                                <Pencil size={16} />
                              </button>
                            )}
                            {hasModulePermission("announcements", "archive") && (
                              <button
                                className={iconBtn}
                                onClick={() => setPendingAction({ title: a.archived ? "Activate Announcement" : "Archive Announcement", message: `${a.archived ? "Activate" : "Archive"} ${a.title}?`, confirmLabel: "Confirm", run: () => runActionWithFeedback("Announcement updated", () => api.patch(`/api/announcements/${a._id}/archive`, { archived: !a.archived }, { headers: authHeaders() })) })}
                                type="button"
                                title={a.archived ? "Activate announcement" : "Archive announcement"}
                                aria-label={a.archived ? "Activate announcement" : "Archive announcement"}
                              >
                                <Archive size={16} />
                              </button>
                            )}
                            {hasModulePermission("announcements", "delete") && (
                              <button
                                className={iconDangerBtn}
                                onClick={() => setPendingAction({ title: "Delete Announcement", message: `Delete ${a.title}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Announcement deleted", () => api.delete(`/api/announcements/${a._id}`, { headers: authHeaders() })) })}
                                type="button"
                                title="Delete announcement"
                                aria-label="Delete announcement"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAnnouncements.length === 0 && <p className="mt-2 text-sm text-slate-500">No announcements in this category.</p>}
            </section>
          )}
          {activePanel === "reports" && (
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Issue Reports</h2>
                {hasModulePermission("reports", "add") ? <button className={btnPrimary} onClick={() => setAddReportOpen(true)} type="button">Create Report</button> : null}
              </div>
              <PanelSearchFilters value={tableFilters.reports} onChange={(next) => updateTableFilter("reports", next)} placeholder="Search issue reports..." />
              <CategoryFilter title="Report Categories" options={reportCategoryOptions} value={reportCategory} onChange={setReportCategory} />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">Sorted by date and time</p>
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" value={reportSortOrder} onChange={(e) => setReportSortOrder(e.target.value as "newest" | "oldest")}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                      <th className="px-4 py-3 font-semibold">Date / Time</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Details</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((r) => (
                      <tr key={r._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3 font-semibold text-slate-900">{r.referenceNo}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatDateTime(r.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-700">{r.category}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="min-w-[280px] space-y-2">
                            <DetailBlock label="Details">
                              <p className="font-medium">{r.description || "No details provided."}</p>
                            </DetailBlock>
                            <div className="flex flex-wrap items-center gap-2">
                              <HandlerPill item={r} />
                              {r.attachments?.length ? (
                                <button
                                  className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 transition-all duration-200 ease-out hover:border-blue-200 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70"
                                  disabled={attachmentLoadingId === r._id}
                                  onClick={() => void openReportAttachment(r)}
                                  type="button"
                                >
                                  {attachmentLoadingId === r._id ? "Loading attachment..." : "View attachment"}
                                </button>
                              ) : null}
                            </div>
                            <AdminCommentBlock value={r.adminComment} />
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge value={r.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {hasModulePermission("reports", "edit") ? <button className={btnSecondary} onClick={() => void openReportManageModal(r)} type="button">Manage</button> : null}
                            {hasModulePermission("reports", "archive") ? (
                              <button
                                className={iconBtn}
                                onClick={() => setPendingAction({ title: "Archive Report", message: `Archive ${r.referenceNo}?`, confirmLabel: "Archive", run: () => runActionWithFeedback("Report archived", () => api.patch(`/api/reports/${r._id}/status`, { status: "rejected", adminChecked: true }, { headers: authHeaders() })) })}
                                type="button"
                                title="Archive report"
                                aria-label="Archive report"
                              >
                                <Archive size={16} />
                              </button>
                            ) : null}
                            {hasModulePermission("reports", "delete") ? <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Report", message: `Delete ${r.referenceNo}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Report deleted", () => api.delete(`/api/reports/${r._id}`, { headers: authHeaders() })) })} type="button">Delete</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredReports.length === 0 && <p className="mt-2 text-sm text-slate-500">No reports in this category.</p>}
            </section>
          )}
          {activePanel === "emergencyAlerts" && (
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Live Emergency Alerts</h2>
                  <p className="mt-1 text-sm text-slate-500">Daily live location shares and chat updates from residents during urgent situations.</p>
                </div>
                <div className="rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                  {stats.liveAlerts} active
                </div>
              </div>
              <CategoryFilter title="Alert View" options={liveAlertCategoryOptions} value={liveAlertCategory} onChange={(next) => setLiveAlertCategory(next as typeof liveAlertCategory)} />
              <PanelSearchFilters value={tableFilters.emergencyAlerts} onChange={(next) => updateTableFilter("emergencyAlerts", next)} placeholder="Search live alerts..." />
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Alert</th>
                      <th className="px-4 py-3 font-semibold">Resident</th>
                      <th className="px-4 py-3 font-semibold">Current Location</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmergencyAlerts.map((alert) => {
                      const resident = alert.residentSnapshot || {};
                      const mapUrl = googleMapsUrl(alert.currentLocation);
                      return (
                        <tr key={alert._id} className="border-t border-slate-200 align-top">
                          <td className="px-4 py-3 text-slate-700">
                            <div className="min-w-[260px] space-y-2">
                              <p className="font-semibold text-slate-900">{alert.referenceNo}</p>
                              <p className="text-sm font-medium text-red-700">{alert.situation}</p>
                              <p className="text-xs text-slate-500">Started: {formatDateTime(alert.createdAt)}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="min-w-[260px] rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-5">
                              <p className="text-sm font-bold text-slate-900">{resident.fullName || "Resident"}</p>
                              <p><span className="font-semibold text-slate-500">Username:</span> {resident.username || "N/A"}</p>
                              <p><span className="font-semibold text-slate-500">ID:</span> {resident.userId || "N/A"}</p>
                              <p><span className="font-semibold text-slate-500">Age:</span> {resident.age || "Not recorded"}</p>
                              <p><span className="font-semibold text-slate-500">Email:</span> {resident.email || "N/A"}</p>
                              <p><span className="font-semibold text-slate-500">Number:</span> {resident.contactNumber || "N/A"}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="min-w-[240px] space-y-2">
                              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-500">Latest coordinates</p>
                                <p className="mt-1 font-mono text-sm font-semibold text-blue-950">{formatCoordinates(alert.currentLocation)}</p>
                                <p className="mt-1 text-xs text-blue-900/70">Updated: {formatDateTime(alert.currentLocation?.at || alert.updatedAt)}</p>
                                {alert.currentLocation?.accuracy ? <p className="mt-1 text-xs text-blue-900/70">Accuracy: approx. {Math.round(alert.currentLocation.accuracy)}m</p> : null}
                              </div>
                              {mapUrl ? (
                                <a className={btnSecondary} href={mapUrl} target="_blank" rel="noopener noreferrer">
                                  <MapPin size={14} className="mr-1" /> Open Google Maps
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-[190px] space-y-3">
                              <Badge value={alert.status} />
                              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs">
                                <label className="mb-1 flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
                                  <input
                                    type="radio"
                                    className="accent-slate-900"
                                    checked={alert.status === "active" || alert.status === "acknowledged"}
                                    onChange={() => setPendingAction({
                                      title: "Mark Live Alert Unresolved",
                                      message: `Move ${alert.referenceNo} back to the unresolved list?`,
                                      confirmLabel: "Mark Unresolved",
                                      run: () => runActionWithFeedback("Live alert marked unresolved", () => api.patch(`/api/emergency-alerts/${alert._id}/status`, { status: "active" }, { headers: authHeaders() })),
                                    })}
                                  />
                                  Unresolved
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-700">
                                  <input
                                    type="radio"
                                    className="accent-emerald-600"
                                    checked={alert.status === "resolved"}
                                    onChange={() => setPendingAction({
                                      title: "Resolve Live Alert",
                                      message: `Mark ${alert.referenceNo} as resolved?`,
                                      confirmLabel: "Resolve",
                                      run: () => endLiveAlertChat(alert),
                                    })}
                                  />
                                  Resolved
                                </label>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button className={btnSecondary} onClick={() => void openLiveAlertChat(alert)} type="button">
                                <MessageCircle size={14} className="mr-1" /> Live Chat
                              </button>
                              {alert.status === "active" ? (
                                <button
                                  className={btnSecondary}
                                  onClick={() => setPendingAction({ title: "Acknowledge Live Alert", message: `Mark ${alert.referenceNo} as acknowledged?`, confirmLabel: "Acknowledge", run: () => runActionWithFeedback("Live alert acknowledged", () => api.patch(`/api/emergency-alerts/${alert._id}/status`, { status: "acknowledged" }, { headers: authHeaders() })) })}
                                  type="button"
                                >
                                  Acknowledge
                                </button>
                              ) : null}
                              {alert.status !== "resolved" && alert.status !== "cancelled" ? (
                                <button
                                  className={btnPrimary}
                                  onClick={() => setPendingAction({ title: "End Live Chat", message: `Mark ${alert.referenceNo} as resolved and end the live chat?`, confirmLabel: "End Chat", run: () => endLiveAlertChat(alert) })}
                                  type="button"
                                >
                                  Resolve
                                </button>
                              ) : null}
                              <button
                                className={iconBtn}
                                onClick={() => setPendingAction({ title: "Archive Live Alert", message: `Archive ${alert.referenceNo}? It will be hidden from the daily list.`, confirmLabel: "Archive", run: () => runActionWithFeedback("Live alert archived", () => api.patch(`/api/emergency-alerts/${alert._id}/archive`, { archived: true }, { headers: authHeaders() })) })}
                                type="button"
                                title="Archive live alert"
                                aria-label="Archive live alert"
                              >
                                <Archive size={16} />
                              </button>
                              <button
                                className={iconBtnDanger}
                                onClick={() => setPendingAction({ title: "Delete Live Alert", message: `Permanently delete ${alert.referenceNo}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Live alert deleted", () => api.delete(`/api/emergency-alerts/${alert._id}`, { headers: authHeaders() })) })}
                                type="button"
                                title="Delete live alert"
                                aria-label="Delete live alert"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filteredEmergencyAlerts.length === 0 && <p className="mt-2 text-sm text-slate-500">No live alerts found.</p>}
            </section>
          )}
          {activePanel === "services" && (
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Service Requests</h2>
                {hasModulePermission("serviceRequests", "add") ? <button className={btnPrimary} onClick={() => setAddServiceOpen(true)} type="button">Create Request</button> : null}
              </div>
              <PanelSearchFilters value={tableFilters.services} onChange={(next) => updateTableFilter("services", next)} placeholder="Search service requests..." />
              <CategoryFilter title="Service Categories" options={serviceCategoryOptions} value={serviceCategory} onChange={setServiceCategory} />
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-semibold text-slate-500">Sorted by date and time</p>
                <select className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" value={serviceSortOrder} onChange={(e) => setServiceSortOrder(e.target.value as "newest" | "oldest")}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                      <th className="px-4 py-3 font-semibold">Date / Time</th>
                      <th className="px-4 py-3 font-semibold">Service</th>
                      <th className="px-4 py-3 font-semibold">Resident</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map((s) => (
                      <tr key={s._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3 font-semibold text-slate-900">{s.referenceNo}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatDateTime(s.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-700">{s.serviceType}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="min-w-[260px] space-y-2">
                            <DetailBlock label="Resident">
                              <p className="font-semibold">{s.fullName}</p>
                              {s.purpose ? <p className="mt-1 text-xs text-slate-500">Purpose: {s.purpose}</p> : null}
                            </DetailBlock>
                            <HandlerPill item={s} />
                            <AdminCommentBlock value={s.adminComment} />
                          </div>
                        </td>
                        <td className="px-4 py-3"><Badge value={s.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {hasModulePermission("serviceRequests", "edit") ? <button className={btnSecondary} onClick={() => setServiceManageModal(s)} type="button">Manage</button> : null}
                            {hasModulePermission("serviceRequests", "archive") ? (
                              <button
                                className={iconBtn}
                                onClick={() => setPendingAction({ title: "Archive Service Request", message: `Archive ${s.referenceNo}?`, confirmLabel: "Archive", run: () => runActionWithFeedback("Service request archived", () => api.patch(`/api/services/requests/${s._id}/status`, { status: "rejected", note: "Archived by barangay staff" }, { headers: authHeaders() })) })}
                                type="button"
                                title="Archive service request"
                                aria-label="Archive service request"
                              >
                                <Archive size={16} />
                              </button>
                            ) : null}
                            {hasModulePermission("serviceRequests", "delete") ? <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Service Request", message: `Delete ${s.referenceNo}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Service request deleted", () => api.delete(`/api/services/requests/${s._id}`, { headers: authHeaders() })) })} type="button">Delete</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredServices.length === 0 && <p className="mt-2 text-sm text-slate-500">No service requests in this category.</p>}
            </section>
          )}
          {activePanel === "messages" && (
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Messages</h2>
                {hasModulePermission("messages", "add") ? <button className={btnPrimary} onClick={() => setAddMessageOpen(true)} type="button">Create Message</button> : null}
              </div>
              <PanelSearchFilters value={tableFilters.messages} onChange={(next) => updateTableFilter("messages", next)} placeholder="Search messages..." />
              <CategoryFilter title="Department Categories" options={messageCategoryOptions} value={messageCategory} onChange={setMessageCategory} />
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Reference</th>
                      <th className="px-4 py-3 font-semibold">Date / Time</th>
                      <th className="px-4 py-3 font-semibold">Sender</th>
                      <th className="px-4 py-3 font-semibold">Department</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMessages.map((m) => (
                      <tr key={m._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3 font-semibold text-slate-900">{m.referenceNo}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatDateTime(m.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="min-w-[260px] space-y-2">
                            <DetailBlock label="Sender">
                              <p className="font-semibold">{m.name}</p>
                              {m.message ? <p className="mt-1 text-xs text-slate-500">{m.message}</p> : null}
                            </DetailBlock>
                            <HandlerPill item={m} />
                            <AdminCommentBlock value={m.adminComment} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{m.department}</td>
                        <td className="px-4 py-3"><Badge value={m.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {hasModulePermission("messages", "edit") ? <button className={btnSecondary} onClick={() => setMessageManageModal(m)} type="button">Manage</button> : null}
                            {hasModulePermission("messages", "archive") ? (
                              <button
                                className={iconBtn}
                                onClick={() => setPendingAction({ title: "Archive Message", message: `Archive ${m.referenceNo}?`, confirmLabel: "Archive", run: () => runActionWithFeedback("Message archived", () => api.patch(`/api/contact/messages/${m._id}/status`, { status: "closed" }, { headers: authHeaders() })) })}
                                type="button"
                                title="Archive message"
                                aria-label="Archive message"
                              >
                                <Archive size={16} />
                              </button>
                            ) : null}
                            {hasModulePermission("messages", "delete") ? <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Message", message: `Delete ${m.referenceNo}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Message deleted", () => api.delete(`/api/contact/messages/${m._id}`, { headers: authHeaders() })) })} type="button">Delete</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredMessages.length === 0 && <p className="mt-2 text-sm text-slate-500">No messages in this category.</p>}
              <div className="mt-4 flex justify-end">
                <button className={btnSecondary} onClick={() => setShowClosedMessagesModal(true)} type="button">
                  View Closed Messages ({closedMessages.length})
                </button>
              </div>
            </section>
          )}
          {activePanel === "subscriptions" && (
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Stay Updated Subscribers</h2>
                {hasModulePermission("subscribers", "add") ? <button className={btnPrimary} onClick={() => setAddSubscriberOpen(true)} type="button">Create Subscriber</button> : null}
              </div>
              <PanelSearchFilters value={tableFilters.subscriptions} onChange={(next) => updateTableFilter("subscriptions", next)} placeholder="Search subscribers..." />
              <CategoryFilter title="Subscriber Categories" options={subscriberCategoryOptions} value={subscriberCategory} onChange={setSubscriberCategory} />
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Date / Time</th>
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubscriptions.map((sub) => (
                      <tr key={sub._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <div className="min-w-[260px] space-y-2">
                            <DetailBlock label="Subscriber">
                              <p className="break-all font-semibold">{sub.email}</p>
                            </DetailBlock>
                            <HandlerPill item={sub} />
                            <AdminCommentBlock value={sub.adminComment} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatDateTime(sub.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-600">{sub.source || "homepage"}</td>
                        <td className="px-4 py-3"><Badge value={sub.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {hasModulePermission("subscribers", "edit") ? <button className={btnSecondary} onClick={() => setSubscriptionManageModal(sub)} type="button">Manage</button> : null}
                            {hasModulePermission("subscribers", "archive") ? (
                              <button
                                className={iconBtn}
                                onClick={() => setPendingAction({ title: sub.status === "unsubscribed" ? "Activate Subscriber" : "Archive Subscriber", message: `${sub.status === "unsubscribed" ? "Activate" : "Archive"} ${sub.email}?`, confirmLabel: "Confirm", run: () => runActionWithFeedback("Subscriber updated", () => api.patch(`/api/subscriptions/${sub._id}/status`, { status: sub.status === "unsubscribed" ? "active" : "unsubscribed" }, { headers: authHeaders() })) })}
                                type="button"
                                title={sub.status === "unsubscribed" ? "Activate subscriber" : "Archive subscriber"}
                                aria-label={sub.status === "unsubscribed" ? "Activate subscriber" : "Archive subscriber"}
                              >
                                <Archive size={16} />
                              </button>
                            ) : null}
                            {hasModulePermission("subscribers", "delete") ? <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Subscriber", message: `Delete ${sub.email}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Subscriber deleted", () => api.delete(`/api/subscriptions/${sub._id}`, { headers: authHeaders() })) })} type="button">Delete</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredSubscriptions.length === 0 && <p className="mt-2 text-sm text-slate-500">No subscribers in this category.</p>}
            </section>
          )}

          {activePanel === "restore" && (
            <section className={card}>
              <div className="mb-4">
                <h2 className="text-lg font-semibold">Restore Data</h2>
                <p className="text-sm text-slate-500">Restore archived records back to their active workflow state.</p>
              </div>

              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={restoreSearch}
                    onChange={(e) => setRestoreSearch(e.target.value)}
                    placeholder="Search archived data..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  />
                  {restoreSearch ? (
                    <button
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => setRestoreSearch("")}
                      type="button"
                      aria-label="Clear restore search"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Archive Categories</p>
                <div className="flex flex-wrap gap-2">
                  {restoreCategoryOptions.map((item) => (
                    <label key={item.value} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${restoreCategory === item.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"}`}>
                      <input
                        type="radio"
                        className="h-3 w-3 accent-current"
                        checked={restoreCategory === item.value}
                        onChange={() => {
                          setRestoreCategory(item.value);
                          setRestoreExpanded(false);
                        }}
                      />
                      <span>{item.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${restoreCategory === item.value ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"}`}>{item.count}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedRestore.label}</p>
                  <p className="text-xs text-slate-500">{selectedRestore.count} archived record{selectedRestore.count === 1 ? "" : "s"} in this category.</p>
                </div>
                <button className={btnSecondary} onClick={() => setRestoreExpanded((v) => !v)} type="button">
                  {restoreExpanded ? "Hide Records" : "Show All"}
                </button>
              </div>

              {restoreExpanded ? (
              <div className="space-y-6">
                <div className={restoreCategory === "users" ? "" : "hidden"}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Users</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Username</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Restore</th></tr>
                      </thead>
                      <tbody>
                        {archivedUsers.map((user) => (
                          <tr key={user._id} className="border-t border-slate-200">
                            <td className="px-4 py-3"><p className="font-semibold text-slate-900">{[user.firstName, user.middleName, user.lastName].filter(Boolean).join(" ") || "N/A"}</p><p className="text-xs text-slate-500">{user.email}</p></td>
                            <td className="px-4 py-3 text-slate-700">{user.username}</td>
                            <td className="px-4 py-3"><Badge value="archived" /></td>
                            <td className="px-4 py-3"><button className={iconBtn}  onClick={() => setPendingAction({ title: "Restore User", message: `Restore ${user.username}?`, confirmLabel: "Restore", run: () => runActionWithFeedback("User restored", () => api.patch(`/api/admin/users/${user._id}/status`, { status: "active" }, { headers: authHeaders() })) })} type="button" title="Restore item" aria-label="Restore item"><Archive size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {archivedUsers.length === 0 && <p className="mt-2 text-sm text-slate-500">No archived users.</p>}
                </div>

                <div className={restoreCategory === "officials" ? "" : "hidden"}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Officials</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3 font-semibold">Official</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Restore</th></tr>
                      </thead>
                      <tbody>
                        {archivedOfficials.map((item) => (
                          <tr key={item._id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                            <td className="px-4 py-3 text-slate-700">{item.role}</td>
                            <td className="px-4 py-3"><button className={iconBtn}  onClick={() => setPendingAction({ title: "Restore Official", message: `Restore ${item.name}?`, confirmLabel: "Restore", run: () => runActionWithFeedback("Official restored", () => api.put(`/api/officials/${item._id}`, { ...item, active: true }, { headers: authHeaders() })) })} type="button" title="Restore item" aria-label="Restore item"><Archive size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {archivedOfficials.length === 0 && <p className="mt-2 text-sm text-slate-500">No archived officials.</p>}
                </div>

                <div className={restoreCategory === "announcements" ? "" : "hidden"}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Announcements</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3 font-semibold">Title</th><th className="px-4 py-3 font-semibold">Module</th><th className="px-4 py-3 font-semibold">Restore</th></tr>
                      </thead>
                      <tbody>
                        {archivedAnnouncements.map((item) => (
                          <tr key={item._id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.title}</td>
                            <td className="px-4 py-3 text-slate-700">{item.module}</td>
                            <td className="px-4 py-3"><button className={iconBtn}  onClick={() => setPendingAction({ title: "Restore Announcement", message: `Restore ${item.title}?`, confirmLabel: "Restore", run: () => runActionWithFeedback("Announcement restored", () => api.patch(`/api/announcements/${item._id}/archive`, { archived: false }, { headers: authHeaders() })) })} type="button" title="Restore item" aria-label="Restore item"><Archive size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {archivedAnnouncements.length === 0 && <p className="mt-2 text-sm text-slate-500">No archived announcements.</p>}
                </div>

                <div className={restoreCategory === "reports" ? "" : "hidden"}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Reports</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3 font-semibold">Reference</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Restore</th></tr>
                      </thead>
                      <tbody>
                        {archivedReports.map((item) => (
                          <tr key={item._id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.referenceNo}</td>
                            <td className="px-4 py-3 text-slate-700">{item.category}</td>
                            <td className="px-4 py-3"><button className={iconBtn}  onClick={() => setPendingAction({ title: "Restore Report", message: `Restore ${item.referenceNo}?`, confirmLabel: "Restore", run: () => runActionWithFeedback("Report restored", () => api.patch(`/api/reports/${item._id}/status`, { status: "new", adminChecked: false }, { headers: authHeaders() })) })} type="button" title="Restore item" aria-label="Restore item"><Archive size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {archivedReports.length === 0 && <p className="mt-2 text-sm text-slate-500">No archived reports.</p>}
                </div>

                <div className={restoreCategory === "services" ? "" : "hidden"}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Service Requests</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3 font-semibold">Reference</th><th className="px-4 py-3 font-semibold">Service</th><th className="px-4 py-3 font-semibold">Restore</th></tr>
                      </thead>
                      <tbody>
                        {archivedServices.map((item) => (
                          <tr key={item._id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.referenceNo}</td>
                            <td className="px-4 py-3 text-slate-700">{item.serviceType}</td>
                            <td className="px-4 py-3"><button className={iconBtn}  onClick={() => setPendingAction({ title: "Restore Service Request", message: `Restore ${item.referenceNo}?`, confirmLabel: "Restore", run: () => runActionWithFeedback("Service request restored", () => api.patch(`/api/services/requests/${item._id}/status`, { status: "pending", note: "Restored by barangay staff" }, { headers: authHeaders() })) })} type="button" title="Restore item" aria-label="Restore item"><Archive size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {archivedServices.length === 0 && <p className="mt-2 text-sm text-slate-500">No archived service requests.</p>}
                </div>

                <div className={restoreCategory === "messages" ? "" : "hidden"}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Messages</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3 font-semibold">Reference</th><th className="px-4 py-3 font-semibold">Sender</th><th className="px-4 py-3 font-semibold">Restore</th></tr>
                      </thead>
                      <tbody>
                        {archivedMessages.map((item) => (
                          <tr key={item._id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.referenceNo}</td>
                            <td className="px-4 py-3 text-slate-700">{item.name}</td>
                            <td className="px-4 py-3"><button className={iconBtn}  onClick={() => setPendingAction({ title: "Restore Message", message: `Restore ${item.referenceNo}?`, confirmLabel: "Restore", run: () => runActionWithFeedback("Message restored", () => api.patch(`/api/contact/messages/${item._id}/status`, { status: "new" }, { headers: authHeaders() })) })} type="button" title="Restore item" aria-label="Restore item"><Archive size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {archivedMessages.length === 0 && <p className="mt-2 text-sm text-slate-500">No archived messages.</p>}
                </div>

                <div className={restoreCategory === "subscribers" ? "" : "hidden"}>
                  <h3 className="mb-2 text-sm font-semibold text-slate-800">Subscribers</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr><th className="px-4 py-3 font-semibold">Email</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Restore</th></tr>
                      </thead>
                      <tbody>
                        {archivedSubscriptions.map((item) => (
                          <tr key={item._id} className="border-t border-slate-200">
                            <td className="px-4 py-3 font-semibold text-slate-900">{item.email}</td>
                            <td className="px-4 py-3"><Badge value={item.status} /></td>
                            <td className="px-4 py-3"><button className={iconBtn}  onClick={() => setPendingAction({ title: "Restore Subscriber", message: `Restore ${item.email}?`, confirmLabel: "Restore", run: () => runActionWithFeedback("Subscriber restored", () => api.patch(`/api/subscriptions/${item._id}/status`, { status: "active" }, { headers: authHeaders() })) })} type="button" title="Restore item" aria-label="Restore item"><Archive size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {archivedSubscriptions.length === 0 && <p className="mt-2 text-sm text-slate-500">No archived subscribers.</p>}
                </div>
              </div>
              ) : null}
            </section>
          )}

          {activePanel === "settings" && (
            <section className={card}>
              <h2 className="mb-4 text-lg font-semibold">System Settings</h2>
              {!canManage && <p className="mb-3 text-sm text-slate-600">Admin access is read-only.</p>}
              <label className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <span>
                  <span className="block font-semibold text-slate-900">Developer Options</span>
                  <span className="block text-xs text-slate-500">Turn on to modify system controls, resident content, and evacuation data.</span>
                </span>
                <input type="checkbox" checked={systemSettings.developerOptionsEnabled} disabled={!canManage} onChange={(e) => setSystemSettings((p) => ({ ...p, developerOptionsEnabled: e.target.checked }))} />
              </label>

              {systemSettings.developerOptionsEnabled ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center justify-between gap-2 rounded border p-3 text-sm"><span>Allow Resident Registration</span><input type="checkbox" checked={systemSettings.allowResidentRegistration} disabled={!canManage} onChange={(e) => setSystemSettings((p) => ({ ...p, allowResidentRegistration: e.target.checked }))} /></label>
                    <label className="flex items-center justify-between gap-2 rounded border p-3 text-sm"><span>Maintenance Mode</span><input type="checkbox" checked={systemSettings.maintenanceMode} disabled={!canManage} onChange={(e) => setSystemSettings((p) => ({ ...p, maintenanceMode: e.target.checked }))} /></label>
                    <label className="flex items-center justify-between gap-2 rounded border p-3 text-sm"><span>Auto-archive Reports</span><input type="checkbox" checked={systemSettings.autoArchiveReports} disabled={!canManage} onChange={(e) => setSystemSettings((p) => ({ ...p, autoArchiveReports: e.target.checked }))} /></label>
                    <label className="flex items-center justify-between gap-2 rounded border p-3 text-sm"><span>Require Announcement Review</span><input type="checkbox" checked={systemSettings.requireAnnouncementReview} disabled={!canManage} onChange={(e) => setSystemSettings((p) => ({ ...p, requireAnnouncementReview: e.target.checked }))} /></label>
                    <label className="flex items-center justify-between gap-2 rounded border p-3 text-sm"><span>Email Digest</span><input type="checkbox" checked={systemSettings.emailDigest} disabled={!canManage} onChange={(e) => setSystemSettings((p) => ({ ...p, emailDigest: e.target.checked }))} /></label>
                    <label className="flex items-center justify-between gap-2 rounded border p-3 text-sm"><span>Login Lockout Window (minutes)</span><input className={`${inputBase} w-20 px-2 py-1 text-xs`} type="number" min={5} value={systemSettings.lockoutWindowMinutes} disabled={!canManage} onChange={(e) => setSystemSettings((p) => ({ ...p, lockoutWindowMinutes: Number(e.target.value) || 15 }))} /></label>
                    <label className="md:col-span-2 text-sm">
                      <span className="mb-1 block font-medium">Email Notifications Sent To</span>
                      <select
                        className={inputBase}
                        value={systemSettings.notificationRecipientMode}
                        disabled={!canManage || !systemSettings.emailDigest}
                        onChange={(e) => setSystemSettings((p) => ({ ...p, notificationRecipientMode: e.target.value as SystemSettings["notificationRecipientMode"] }))}
                      >
                        <option value="all">Admins and Superadmins</option>
                        <option value="superadmin">Superadmin only</option>
                        <option value="admin">Admins only</option>
                      </select>
                      <span className="mt-1 block text-xs text-slate-500">This controls who receives automatic staff email updates from reports, messages, registrations, services, and system events.</span>
                    </label>
                    <label className="md:col-span-2 text-sm"><span className="mb-1 block font-medium">Maintenance Message</span><textarea className="w-full rounded border p-2 text-sm" rows={2} value={systemSettings.maintenanceMessage} disabled={!canManage} onChange={(e) => setSystemSettings((p) => ({ ...p, maintenanceMessage: e.target.value }))} /></label>
                  </div>
                  <div className="mt-6 border-t pt-4">
                    <h3 className="mb-3 font-semibold">Resident Content Editors</h3>
                    {canManage ? (
                      <div className="grid gap-2 md:grid-cols-2">
                        <button className={`${btnSecondary} justify-start text-sm`} onClick={() => setHomeEditOpen(true)} type="button">Edit Home Content</button>
                        <button className={`${btnSecondary} justify-start text-sm`} onClick={() => { setAboutSnapshotDraft(pairsToLines((siteContent as any).aboutSnapshotItems || [])); setAboutTrendDraft(pairsToLines((siteContent as any).aboutPopulationTrend || [])); setAboutGovDraft(((siteContent as any).aboutCoreGovernance || []).join("\n")); setAboutEditOpen(true); }} type="button">Edit About Content</button>
                        <button className={`${btnSecondary} justify-start text-sm`} onClick={() => setContactEditOpen(true)} type="button">Edit Contact Content</button>
                        <button className={`${btnSecondary} justify-start text-sm`} onClick={() => setServicesEditOpen(true)} type="button">Manage Services Catalog</button>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Only authorized system administrators can edit resident-facing content.</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="mt-6 border-t pt-4">
                      <h3 className="mb-3 font-semibold">Evacuation & Safety Data</h3>
                      <div className="grid gap-2 md:grid-cols-2">
                        <button className={`${btnSecondary} justify-start text-sm`} onClick={() => setManageCentersOpen(true)} type="button">View / Manage Centers</button>
                        <button className={`${btnSecondary} justify-start text-sm`} onClick={() => setManageHotlinesOpen(true)} type="button">View / Manage Emergency Hotlines</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
                  Advanced system controls are hidden. Turn on Developer Options, save the setting, and the controls will stay aligned with the latest saved records.
                </div>
              )}
              {canManage && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className={`${btnPrimary} text-sm`} onClick={() => setPendingAction({ title: "Save System Settings", message: "Apply updated system settings?", confirmLabel: "Save", run: () => runActionWithFeedback("System settings updated", () => api.patch("/api/admin/system-settings", systemSettings, { headers: authHeaders() })) })} type="button">Save Settings</button>
                  <button className={`${btnSecondary} text-sm`} onClick={() => setSystemSettings(savedSystemSettings)} type="button">Revert Unsaved Changes</button>
                </div>
              )}
            </section>
          )}

          {activePanel === "notifications" && (
            <section className={card}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">System Notifications</h2>
                  <p className="mt-1 text-sm text-slate-500">Live system events from recent staff and resident actions. This view refreshes automatically every few seconds.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">{visibleAdminNotifications.length} updates</div>
                  <button className={btnSecondary} onClick={(event) => void clearAdminNotifications(event)} type="button">Clear All</button>
                </div>
              </div>
              <div className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={notificationSearch}
                    onChange={(e) => setNotificationSearch(e.target.value)}
                    placeholder="Search system notifications..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition focus:border-slate-400"
                  />
                  {notificationSearch ? (
                    <button
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={() => setNotificationSearch("")}
                      type="button"
                      aria-label="Clear notification search"
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row lg:w-[320px]">
                  <input
                    type="date"
                    value={notificationLogDate}
                    onChange={(e) => setNotificationLogDate(e.target.value || todayInputValue())}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                    aria-label="Notification date"
                  />
                  <button
                    className={btnSecondary}
                    onClick={() => setNotificationLogDate(todayInputValue())}
                    type="button"
                  >
                    Today
                  </button>
                </div>
              </div>
              <CategoryFilter title="Notification Groups" options={notificationCategoryOptions} value={notificationCategory} onChange={setNotificationCategory} />
              <div className="space-y-3">
                {filteredAdminNotifications.map((item) => (
                  <div key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span>{item.userRole || "system"}</span>
                          <span>|</span>
                          <span>{item.type}</span>
                          {item.metadata?.module ? <><span>|</span><span>{item.metadata.module}</span></> : null}
                          {item.referenceNo ? <><span>|</span><span>{item.referenceNo}</span></> : null}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {filteredAdminNotifications.length === 0 ? <p className="text-sm text-slate-500">No notifications in this group.</p> : null}
              </div>
            </section>
          )}

          {activePanel === "audit" && (
            <section className={card}>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Admin Activity Logs</h2>
                  <p className="mt-1 text-sm text-slate-500">Daily activity is shown by default. Choose another date to review past logs.</p>
                </div>
                <button
                  className={btnSecondary}
                  onClick={() => {
                    const today = todayInputValue();
                    setActivityLogDate(today);
                    updateTableFilter("audit", { date: today });
                  }}
                  type="button"
                >
                  Today
                </button>
              </div>
              <PanelSearchFilters value={tableFilters.audit} onChange={(next) => updateTableFilter("audit", next)} placeholder="Search activity logs..." />
              <CategoryFilter title="Role Categories" options={activityRoleOptions} value={activityRoleCategory} onChange={setActivityRoleCategory} />
              <div className={moduleGrid}>
                {filteredActivities.map((a) => (
                  <div key={a._id} className={moduleCard}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge value={a.userRole || "unknown"} />
                      <span className="text-[11px] text-slate-500">{new Date(a.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="font-semibold text-slate-900">{a.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{a.type}</p>
                    <p className="mt-1 text-xs text-slate-600">By: {a.userName || "unknown"}</p>
                    {a.referenceNo ? <p className="mt-1 text-xs text-slate-600">Ref: {a.referenceNo}</p> : null}
                  </div>
                ))}
              </div>
              {filteredActivities.length === 0 && <p className="text-sm text-slate-500">No activity found in this category.</p>}
            </section>
          )}
        </main>
      </div>

      {selectedUser && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-5xl`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Resident Details</h3>
              <button onClick={() => setSelectedUser(null)} type="button"><X size={18} /></button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
              <div className={sectionCard}>
                <img src={selectedUser.validIdImage || selectedUser.avatarImage || "https://placehold.co/300x200/e2e8f0/475569?text=No+Image"} alt="Resident ID" className="w-full rounded-lg border border-slate-200 object-cover" />
                <button
                  className={`${btnSecondary} mt-2 w-full`}
                  onClick={() => {
                    const imageUrl = selectedUser.validIdImage || selectedUser.avatarImage;
                    if (imageUrl) window.open(imageUrl, "_blank", "noopener,noreferrer");
                  }}
                  type="button"
                >
                  View Uploaded ID
                </button>
                {canReviewUsers && selectedUser.status !== "active" ? (
                  <button
                    className={`${btnPrimary} mt-2 w-full`}
                    onClick={() => setReviewUserPrompt(selectedUser)}
                    type="button"
                  >
                    Review Details
                  </button>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2"><Badge value={selectedUser.role} /><Badge value={selectedUser.status} /><Badge value={selectedUser.validIdStatus || "pending"} /></div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className={sectionCard}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Personal Information</p>
                    <div className="space-y-1 text-slate-700">
                      <p><span className="font-semibold">Username:</span> {selectedUser.username}</p>
                      <p><span className="font-semibold">Full Name:</span> {[selectedUser.firstName, selectedUser.middleName, selectedUser.lastName].filter(Boolean).join(" ") || "N/A"}</p>
                      <p><span className="font-semibold">Gender:</span> {selectedUser.gender || "N/A"}</p>
                      <p><span className="font-semibold">Civil Status:</span> {selectedUser.civilStatus || "N/A"}</p>
                    </div>
                  </div>
                  <div className={sectionCard}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Contact Details</p>
                    <div className="space-y-1 text-slate-700">
                      <p><span className="font-semibold">Email:</span> {selectedUser.email}</p>
                      <p><span className="font-semibold">Phone:</span> {selectedUser.contactNumber || "N/A"}</p>
                      <p><span className="font-semibold">Preferred Updates:</span> Email only</p>
                    </div>
                  </div>
                  <div className={`${sectionCard} md:col-span-2`}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Address</p>
                    <div className="space-y-1 text-slate-700">
                      <p><span className="font-semibold">Full Address:</span> {selectedUser.address || "N/A"}</p>
                      {selectedUser.addressDetails && (
                        <p><span className="font-semibold">Breakdown:</span> {`Blk ${selectedUser.addressDetails.blk || "-"}, Lot ${selectedUser.addressDetails.lot || "-"}, ${selectedUser.addressDetails.street || "-"}, ${selectedUser.addressDetails.subdivision || "-"}, ${selectedUser.addressDetails.barangay || "-"}, ${selectedUser.addressDetails.city || "-"}, ${selectedUser.addressDetails.province || "-"}, ${selectedUser.addressDetails.zipCode || "-"}`}</p>
                      )}
                    </div>
                  </div>
                  <div className={`${sectionCard} md:col-span-2`}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Linked Children</p>
                    {selectedUser.children && selectedUser.children.length > 0 ? (
                      <div className="space-y-3">
                        {selectedUser.children.map((child, index) => {
                          const progress = childReviewProgress(child.status);
                          return (
                            <div key={index} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Linked Child</p>
                                <p className="mt-1 text-base font-semibold text-slate-900 break-words">{child.fullName || "N/A"}</p>
                                <p className="mt-1 text-xs text-slate-500">Open details to view email, birth date, relationship, notes, and actions.</p>
                                <div className="mt-3 max-w-sm">
                                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                                    <span>{progress === 100 ? "Database synced" : "Pending admin review"}</span>
                                    <span>{progress}%</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-slate-100">
                                    <div className={`h-2 rounded-full transition-all ${progress === 100 ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${progress}%` }} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge value={child.status || "pending"} />
                                <button
                                  className={btnSecondary}
                                  onClick={() => setChildDetailModal({ parent: selectedUser, child })}
                                  type="button"
                                >
                                  <FileText size={14} className="mr-1.5" />
                                  View Details
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-500">No linked children.</p>
                    )}
                  </div>
                </div>
                {canReviewUsers && (
                  <div className={sectionCard}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Account Control</p>
                      <div className={`rounded-full px-3 py-1 text-[11px] font-semibold ${selectedUser.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {selectedUser.status === "active" ? "Approved account" : "Pending review"}
                      </div>
                    </div>
                    {selectedUser.status === "active" ? (
                      <>
                        <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs leading-5 text-emerald-900">
                          This resident is already approved. Open the account control modal to change role, return to pending review, suspend, or delete the account.
                        </div>
                        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
                          <div className="space-y-1 text-sm text-slate-700">
                            <p><span className="font-semibold">Current role:</span> {selectedUser.role}</p>
                            <p><span className="font-semibold">Current status:</span> {selectedUser.status}</p>
                          </div>
                          <button
                            className={btnPrimary}
                            onClick={() => setAccountControlModal({ ...selectedUser })}
                            type="button"
                          >
                            <UserCog size={14} className="mr-1.5" />
                            Modify Account
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-5 text-amber-900 md:flex-row md:items-center md:justify-between">
                        <p>
                          This resident is not approved yet. Use <span className="font-semibold">Review Details</span> to approve or reject the registration first. Account controls only appear after the account becomes approved.
                        </p>
                        <button
                          className={`${btnPrimary} shrink-0`}
                          onClick={() => setReviewUserPrompt(selectedUser)}
                          type="button"
                        >
                          Review Details
                        </button>
                      </div>
                    )}
                    {selectedUser.statusReason ? (
                      <p className="mt-3 text-xs text-slate-500">Latest review note: {selectedUser.statusReason}</p>
                    ) : null}
                  </div>
                )}
                {canManage && selectedUser.role === "admin" && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Admin Permissions</p>
                      <div className="flex flex-wrap gap-2">
                        <button className={btnSecondary} onClick={() => setSelectedAdminPermissionsAll(true)} type="button">Enable All</button>
                        <button className={btnSecondary} onClick={() => setSelectedAdminPermissionsAll(false)} type="button">Deselect All</button>
                      </div>
                    </div>
                    {(["officials", "announcements", "reports", "serviceRequests", "messages", "subscribers"] as Array<keyof AdminPermissions>).map((moduleKey) => (
                      <div key={moduleKey} className="mb-2 rounded border p-2">
                        <p className="mb-1 text-xs font-semibold capitalize text-slate-700">{moduleKey}</p>
                        <div className="grid grid-cols-5 gap-2 text-[11px]">
                          {(["view", "add", "edit", "archive", "delete"] as Array<keyof PermissionFlags>).map((actionKey) => (
                            <label key={actionKey} className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={normalizeAdminPermissions(selectedUser.adminPermissions)[moduleKey][actionKey]}
                                onChange={(e) => setSelectedUser((p) => {
                                  if (!p) return p;
                                  const next = normalizeAdminPermissions(p.adminPermissions);
                                  next[moduleKey][actionKey] = e.target.checked;
                                  return { ...p, adminPermissions: next };
                                })}
                              />
                              <span>{actionKey}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      className={`${btnPrimary} mt-2`}
                      onClick={() => setPendingAction({
                        title: "Save Admin Permissions",
                        message: `Apply updated permissions for ${selectedUser.username}?`,
                        confirmLabel: "Save",
                        run: () => runActionWithFeedback("Admin permissions updated", () => api.patch(`/api/admin/users/${selectedUser._id}/permissions`, { adminPermissions: normalizeAdminPermissions(selectedUser.adminPermissions) }, { headers: authHeaders() })),
                      })}
                      type="button"
                    >
                      Save Permissions
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {addUserOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-3xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Create User</h3><button onClick={() => { setAddUserOpen(false); setShowNewUserPassword(false); }} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full">
              <LabeledField label="Username"><input className={inputBase} value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} /></LabeledField>
              <LabeledField label="Temporary Password">
                <div className="relative">
                  <input className={`${inputBase} pr-11`} type={showNewUserPassword ? "text" : "password"} value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
                  <button
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => setShowNewUserPassword((value) => !value)}
                    type="button"
                    title={showNewUserPassword ? "Hide password" : "Show password"}
                    aria-label={showNewUserPassword ? "Hide temporary password" : "Show temporary password"}
                  >
                    {showNewUserPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </LabeledField>
              <LabeledField label="First Name"><input className={inputBase} value={newUser.firstName} onChange={(e) => setNewUser((p) => ({ ...p, firstName: e.target.value }))} /></LabeledField>
              <LabeledField label="Middle Name"><input className={inputBase} value={newUser.middleName} onChange={(e) => setNewUser((p) => ({ ...p, middleName: e.target.value }))} /></LabeledField>
              <LabeledField label="Last Name"><input className={inputBase} value={newUser.lastName} onChange={(e) => setNewUser((p) => ({ ...p, lastName: e.target.value }))} /></LabeledField>
              <LabeledField label="Email"><input className={inputBase} type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} /></LabeledField>
              <LabeledField label="Contact Number"><input className={inputBase} value={newUser.contactNumber} onChange={(e) => setNewUser((p) => ({ ...p, contactNumber: e.target.value }))} /></LabeledField>
              <LabeledField label="Role"><select className={inputBase} value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}><option value="resident">resident</option><option value="admin">admin</option><option value="superadmin">superadmin</option></select></LabeledField>
              <LabeledField label="Status"><select className={inputBase} value={newUser.status} onChange={(e) => setNewUser((p) => ({ ...p, status: e.target.value }))}><option value="active">active</option><option value="pending">pending</option><option value="suspended">suspended</option></select></LabeledField>
              <LabeledField label="Address" className="lg:col-span-2"><input className={inputBase} value={newUser.address} onChange={(e) => setNewUser((p) => ({ ...p, address: e.target.value }))} placeholder="Mambog II, Bacoor, Cavite" /></LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Create User", message: "Create this user account?", confirmLabel: "Create", run: () => runActionWithFeedback("User created", () => api.post("/api/admin/users", newUser, { headers: authHeaders() }).then(() => { setAddUserOpen(false); setShowNewUserPassword(false); setNewUser({ username: "", firstName: "", middleName: "", lastName: "", email: "", contactNumber: "", address: "", role: "resident", status: "active", password: "" }); })) })} type="button">Create User</button>
          </div>
        </div>
      )}

      {userEditModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-3xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Edit User</h3><button onClick={() => setUserEditModal(null)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full">
              <LabeledField label="Username"><input className={inputBase} value={userEditModal.username || ""} onChange={(e) => setUserEditModal((p) => p ? { ...p, username: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Password"><input className={inputBase} type="password" placeholder="Leave blank to keep current password" value={userEditModal.password || ""} onChange={(e) => setUserEditModal((p) => p ? { ...p, password: e.target.value } : p)} /></LabeledField>
              <LabeledField label="First Name"><input className={inputBase} value={userEditModal.firstName || ""} onChange={(e) => setUserEditModal((p) => p ? { ...p, firstName: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Middle Name"><input className={inputBase} value={userEditModal.middleName || ""} onChange={(e) => setUserEditModal((p) => p ? { ...p, middleName: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Last Name"><input className={inputBase} value={userEditModal.lastName || ""} onChange={(e) => setUserEditModal((p) => p ? { ...p, lastName: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Email"><input className={inputBase} type="email" value={userEditModal.email || ""} onChange={(e) => setUserEditModal((p) => p ? { ...p, email: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Contact Number"><input className={inputBase} value={userEditModal.contactNumber || ""} onChange={(e) => setUserEditModal((p) => p ? { ...p, contactNumber: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Role"><select className={inputBase} value={userEditModal.role || "resident"} onChange={(e) => setUserEditModal((p) => p ? { ...p, role: e.target.value } : p)}><option value="resident">resident</option><option value="admin">admin</option><option value="superadmin">superadmin</option></select></LabeledField>
              <LabeledField label="Status"><select className={inputBase} value={userEditModal.status || "pending"} onChange={(e) => setUserEditModal((p) => p ? { ...p, status: e.target.value as UserItem["status"] } : p)}><option value="active">active</option><option value="pending">pending</option><option value="suspended">suspended</option></select></LabeledField>
              <LabeledField label="Address" className="lg:col-span-2"><input className={inputBase} value={userEditModal.address || ""} onChange={(e) => setUserEditModal((p) => p ? { ...p, address: e.target.value } : p)} /></LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Save User", message: `Save changes for ${userEditModal.username || "this user"}?`, confirmLabel: "Save", run: () => runActionWithFeedback("User updated", () => api.put(`/api/admin/users/${userEditModal._id}`, userEditModal, { headers: authHeaders() }).then(() => { setUserEditModal(null); setSelectedUser(null); })) })} type="button">Save User</button>
            {!isProtectedSuperadminAccount(userEditModal) ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Account Actions</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={btnSecondary}
                    onClick={() => {
                      if (!userEditModal._id || !userEditModal.username) return;
                      openUserReasonPrompt({ kind: "user-status", title: "Return User to Pending Review", userId: userEditModal._id, username: userEditModal.username, nextStatus: "pending", validIdStatus: "pending", role: userEditModal.role });
                      setUserEditModal(null);
                    }}
                    type="button"
                  >
                    Return to Pending
                  </button>
                  <button
                    className={btnSecondary}
                    onClick={() => {
                      if (!userEditModal._id || !userEditModal.username) return;
                      openUserReasonPrompt({ kind: "user-status", title: "Suspend User", userId: userEditModal._id, username: userEditModal.username, nextStatus: "suspended", validIdStatus: "rejected", role: userEditModal.role });
                      setUserEditModal(null);
                    }}
                    type="button"
                  >
                    Suspend
                  </button>
                  <button
                    className={btnDanger}
                    onClick={() => {
                      if (!userEditModal._id) return;
                      const id = userEditModal._id;
                      const username = userEditModal.username || "this user";
                      setUserEditModal(null);
                      setPendingAction({
                        title: "Delete Account",
                        message: `Delete ${username} and linked records permanently?`,
                        confirmLabel: "Delete",
                        run: () => deleteUserAccount(id),
                      });
                    }}
                    type="button"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {addOfficialOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-3xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Add Official</h3><button onClick={() => setAddOfficialOpen(false)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Official Name">
                <input className={inputBase} placeholder="Full name" value={newOfficial.name} onChange={(e) => setNewOfficial((p) => ({ ...p, name: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Position">
                <input className={inputBase} placeholder="Position" value={newOfficial.role} onChange={(e) => setNewOfficial((p) => ({ ...p, role: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Level">
                <select className={inputBase} value={newOfficial.level} onChange={(e) => setNewOfficial((p) => ({ ...p, level: e.target.value }))}><option value="barangay">Barangay</option><option value="city">City</option></select>
              </LabeledField>
              <LabeledField label="Rank Order">
                <input className={inputBase} type="number" placeholder="Rank order" value={newOfficial.rankOrder} onChange={(e) => setNewOfficial((p) => ({ ...p, rankOrder: Number(e.target.value) || 100 }))} />
              </LabeledField>
              <LabeledField label="Committee" className="lg:col-span-2">
                <input className={inputBase} placeholder="Committee" value={newOfficial.committee} onChange={(e) => setNewOfficial((p) => ({ ...p, committee: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Description" className="lg:col-span-2">
                <textarea className={inputBase} rows={3} placeholder="Description" value={newOfficial.description} onChange={(e) => setNewOfficial((p) => ({ ...p, description: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Image URL (Optional)" className="lg:col-span-2">
                <input className={inputBase} placeholder="Image URL (optional)" value={newOfficial.image} onChange={(e) => setNewOfficial((p) => ({ ...p, image: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Upload Image" className="lg:col-span-2">
                <input id="new-official-image" className="hidden" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) fileToBase64(file, (value) => setNewOfficial((p) => ({ ...p, image: value }))); }} />
                <label htmlFor="new-official-image" className={btnSecondary}>Choose Official Image</label>
              </LabeledField>
              {newOfficial.image && <img src={newOfficial.image} alt="Official preview" className="h-20 w-20 rounded border object-cover lg:col-span-2" />}
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Add Official", message: "Create this official?", confirmLabel: "Add", run: () => runActionWithFeedback("Official added", () => api.post("/api/officials", newOfficial, { headers: authHeaders() }).then(() => { setAddOfficialOpen(false); setNewOfficial({ name: "", role: "", level: "barangay", rankOrder: 10, committee: "", description: "", image: "" }); })) })} type="button">Add Official</button>
          </div>
        </div>
      )}

      {addAnnouncementOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-3xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Create Announcement</h3><button onClick={() => setAddAnnouncementOpen(false)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Title">
                <input className={inputBase} placeholder="Title" value={newAnnouncement.title} onChange={(e) => setNewAnnouncement((p) => ({ ...p, title: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Category">
                <input className={inputBase} placeholder="Category" value={newAnnouncement.category} onChange={(e) => setNewAnnouncement((p) => ({ ...p, category: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Module" className="lg:col-span-2">
                <select className={inputBase} value={newAnnouncement.module} onChange={(e) => setNewAnnouncement((p) => ({ ...p, module: e.target.value }))}><option value="barangay-updates">Barangay Updates</option><option value="emergency-hotlines">Emergency Hotlines</option><option value="phivolcs-alerts">PHIVOLCS Alerts</option><option value="fact-check">Fact Check</option><option value="all-news-updates">All News & Updates</option></select>
              </LabeledField>
              <LabeledField label="Content" className="lg:col-span-2">
                <textarea className={inputBase} rows={3} placeholder="Content" value={newAnnouncement.content} onChange={(e) => setNewAnnouncement((p) => ({ ...p, content: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Source">
                <input className={inputBase} placeholder="Source" value={newAnnouncement.source} onChange={(e) => setNewAnnouncement((p) => ({ ...p, source: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Image URL (Optional)">
                <input className={inputBase} placeholder="Image URL (optional)" value={newAnnouncement.image} onChange={(e) => setNewAnnouncement((p) => ({ ...p, image: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Upload Image" className="lg:col-span-2">
                <input id="new-announcement-image" className="hidden" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) fileToBase64(file, (value) => setNewAnnouncement((p) => ({ ...p, image: value }))); }} />
                <label htmlFor="new-announcement-image" className={btnSecondary}>Choose Announcement Image</label>
              </LabeledField>
              {newAnnouncement.image && <img src={newAnnouncement.image} alt="Announcement preview" className="h-20 w-28 rounded border object-cover lg:col-span-2" />}
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Create Announcement", message: "Publish this announcement?", confirmLabel: "Publish", run: () => runActionWithFeedback("Announcement created", () => api.post("/api/announcements", newAnnouncement, { headers: authHeaders() }).then(() => { setAddAnnouncementOpen(false); setNewAnnouncement({ title: "", content: "", module: "barangay-updates", category: "Advisory", source: "Barangay Office", image: "" }); })) })} type="button">Publish Announcement</button>
          </div>
        </div>
      )}

      {addReportOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-2xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Create Report</h3><button onClick={() => setAddReportOpen(false)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Full Name"><input className={inputBase} value={newReport.fullName} onChange={(e) => setNewReport((p) => ({ ...p, fullName: e.target.value }))} /></LabeledField>
              <LabeledField label="Contact Number"><input className={inputBase} value={newReport.contactNumber} onChange={(e) => setNewReport((p) => ({ ...p, contactNumber: e.target.value }))} /></LabeledField>
              <LabeledField label="Address" className="lg:col-span-2"><input className={inputBase} value={newReport.address} onChange={(e) => setNewReport((p) => ({ ...p, address: e.target.value }))} /></LabeledField>
              <LabeledField label="Category" className="lg:col-span-2"><select className={inputBase} value={newReport.category} onChange={(e) => setNewReport((p) => ({ ...p, category: e.target.value }))}>{reportCategoryOptions.filter((x) => x.value !== "all").map((x) => <option key={x.value} value={x.label}>{x.label}</option>)}</select></LabeledField>
              <LabeledField label="Description" className="lg:col-span-2"><textarea className={inputBase} rows={4} value={newReport.description} onChange={(e) => setNewReport((p) => ({ ...p, description: e.target.value }))} /></LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Create Report", message: "Create this issue report?", confirmLabel: "Create", run: () => runActionWithFeedback("Report created", () => api.post("/api/reports", newReport, { headers: authHeaders() }).then(() => { setAddReportOpen(false); setNewReport({ fullName: "", contactNumber: "", address: "", category: "Garbage / Sanitation", description: "" }); })) })} type="button">Create Report</button>
          </div>
        </div>
      )}

      {addServiceOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-2xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Create Service Request</h3><button onClick={() => setAddServiceOpen(false)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Service"><select className={inputBase} value={newService.serviceType} onChange={(e) => setNewService((p) => ({ ...p, serviceType: e.target.value }))}>{serviceCategoryOptions.filter((x) => x.value !== "all").map((x) => <option key={x.value} value={x.label}>{x.label}</option>)}</select></LabeledField>
              <LabeledField label="Full Name"><input className={inputBase} value={newService.fullName} onChange={(e) => setNewService((p) => ({ ...p, fullName: e.target.value }))} /></LabeledField>
              <LabeledField label="Contact Number"><input className={inputBase} value={newService.contactNumber} onChange={(e) => setNewService((p) => ({ ...p, contactNumber: e.target.value }))} /></LabeledField>
              <LabeledField label="Address"><input className={inputBase} value={newService.address} onChange={(e) => setNewService((p) => ({ ...p, address: e.target.value }))} /></LabeledField>
              <LabeledField label="Purpose" className="lg:col-span-2"><textarea className={inputBase} rows={3} value={newService.purpose} onChange={(e) => setNewService((p) => ({ ...p, purpose: e.target.value }))} /></LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Create Service Request", message: "Create this service request?", confirmLabel: "Create", run: () => runActionWithFeedback("Service request created", () => api.post("/api/services/requests", newService, { headers: authHeaders() }).then(() => { setAddServiceOpen(false); setNewService({ serviceType: "Barangay Clearance", fullName: "", contactNumber: "", address: "", purpose: "" }); })) })} type="button">Create Request</button>
          </div>
        </div>
      )}

      {addMessageOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-2xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Create Message</h3><button onClick={() => setAddMessageOpen(false)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Name"><input className={inputBase} value={newMessage.name} onChange={(e) => setNewMessage((p) => ({ ...p, name: e.target.value }))} /></LabeledField>
              <LabeledField label="Contact"><input className={inputBase} value={newMessage.contact} onChange={(e) => setNewMessage((p) => ({ ...p, contact: e.target.value }))} /></LabeledField>
              <LabeledField label="Department" className="lg:col-span-2"><select className={inputBase} value={newMessage.department} onChange={(e) => setNewMessage((p) => ({ ...p, department: e.target.value }))}>{messageCategoryOptions.filter((x) => x.value !== "all").map((x) => <option key={x.value} value={x.label}>{x.label}</option>)}</select></LabeledField>
              <LabeledField label="Message" className="lg:col-span-2"><textarea className={inputBase} rows={4} value={newMessage.message} onChange={(e) => setNewMessage((p) => ({ ...p, message: e.target.value }))} /></LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Create Message", message: "Create this message record?", confirmLabel: "Create", run: () => runActionWithFeedback("Message created", () => api.post("/api/contact/messages", newMessage, { headers: authHeaders() }).then(() => { setAddMessageOpen(false); setNewMessage({ name: "", contact: "", department: "Office of the Captain", message: "" }); })) })} type="button">Create Message</button>
          </div>
        </div>
      )}

      {addSubscriberOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Create Subscriber</h3><button onClick={() => setAddSubscriberOpen(false)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 [&_input]:w-full">
              <LabeledField label="Email"><input className={inputBase} type="email" value={newSubscriber.email} onChange={(e) => setNewSubscriber((p) => ({ ...p, email: e.target.value }))} /></LabeledField>
              <LabeledField label="Source"><input className={inputBase} value={newSubscriber.source} onChange={(e) => setNewSubscriber((p) => ({ ...p, source: e.target.value }))} /></LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Create Subscriber", message: "Add this subscriber?", confirmLabel: "Create", run: () => runActionWithFeedback("Subscriber created", () => api.post("/api/subscriptions", newSubscriber, { headers: authHeaders() }).then(() => { setAddSubscriberOpen(false); setNewSubscriber({ email: "", source: "dashboard" }); })) })} type="button">Create Subscriber</button>
          </div>
        </div>
      )}

      {reportManageModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Manage Report</h3><button onClick={() => setReportManageModal(null)} type="button"><X size={18} /></button></div>
            <p className="text-sm font-semibold">{reportManageModal.referenceNo}</p>
            <div className="mt-4 grid gap-3 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Reporter"><input className={inputBase} value={reportManageModal.fullName || ""} onChange={(e) => setReportManageModal((p) => p ? { ...p, fullName: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Contact"><input className={inputBase} value={reportManageModal.contactNumber || ""} onChange={(e) => setReportManageModal((p) => p ? { ...p, contactNumber: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Address"><input className={inputBase} value={reportManageModal.address || ""} onChange={(e) => setReportManageModal((p) => p ? { ...p, address: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Category"><input className={inputBase} value={reportManageModal.category} onChange={(e) => setReportManageModal((p) => p ? { ...p, category: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Description"><textarea className={inputBase} rows={3} value={reportManageModal.description} onChange={(e) => setReportManageModal((p) => p ? { ...p, description: e.target.value } : p)} /></LabeledField>
              <LabeledField label='Comment from the admins'><textarea className={inputBase} rows={3} placeholder="Resident-facing update or action taken" value={reportManageModal.adminComment || ""} onChange={(e) => setReportManageModal((p) => p ? { ...p, adminComment: e.target.value } : p)} /></LabeledField>
              {renderHandlerSelect(reportManageModal, setReportManageModal)}
              {reportManageModal.attachments?.length ? (
                <button
                  className={btnSecondary}
                  disabled={attachmentLoadingId === reportManageModal._id}
                  onClick={() => void openReportAttachment(reportManageModal)}
                  type="button"
                >
                  {attachmentLoadingId === reportManageModal._id ? "Loading Attachment..." : "View Attachment"}
                </button>
              ) : null}
              <LabeledField label="Status">
                <select className={inputBase} value={reportManageModal.status} onChange={(e) => setReportManageModal((p) => p ? { ...p, status: e.target.value } : p)}>
                  <option value="new">new</option>
                  <option value="in-review">in-review</option>
                  <option value="resolved">resolved</option>
                  <option value="rejected">rejected</option>
                </select>
              </LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Update Report", message: "Save report changes?", confirmLabel: "Save", run: () => saveManagedReport(reportManageModal) })} type="button">Save Report</button>
          </div>
        </div>
      )}

      {attachmentPreview && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-5xl`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Attachment Preview</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{attachmentPreview.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{attachmentPreview.name || attachmentPreview.type || "Uploaded file"}</p>
              </div>
              <button className={iconBtn} onClick={() => setAttachmentPreview(null)} type="button" title="Close attachment" aria-label="Close attachment">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-3">
              {attachmentPreview.type?.startsWith("image/") || attachmentPreview.dataUrl.startsWith("data:image/") ? (
                <img
                  alt={attachmentPreview.name || "Report attachment"}
                  className="mx-auto max-h-[65vh] w-auto rounded-xl object-contain"
                  src={attachmentPreview.dataUrl}
                />
              ) : (
                <iframe
                  className="h-[65vh] w-full rounded-xl bg-white"
                  src={attachmentPreview.dataUrl}
                  title={attachmentPreview.name || "Report attachment"}
                />
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <a className={btnSecondary} href={attachmentPreview.dataUrl} rel="noopener noreferrer" target="_blank">Open Full Size</a>
              <button className={btnPrimary} onClick={() => setAttachmentPreview(null)} type="button">Done</button>
            </div>
          </div>
        </div>
      )}

      {liveAlertChatModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-4xl`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-600">Live Emergency Chat</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{liveAlertChatModal.referenceNo}</h3>
                <p className="mt-1 text-sm text-slate-500">{liveAlertChatModal.situation}</p>
              </div>
              <button className={iconBtn} onClick={() => setLiveAlertChatModal(null)} type="button" title="Close live chat" aria-label="Close live chat">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 grid gap-3 lg:grid-cols-[280px,1fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-900">{liveAlertChatModal.residentSnapshot?.fullName || "Resident"}</p>
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p><span className="font-semibold text-slate-500">Username:</span> {liveAlertChatModal.residentSnapshot?.username || "N/A"}</p>
                  <p><span className="font-semibold text-slate-500">ID:</span> {liveAlertChatModal.residentSnapshot?.userId || "N/A"}</p>
                  <p><span className="font-semibold text-slate-500">Age:</span> {liveAlertChatModal.residentSnapshot?.age || "Not recorded"}</p>
                  <p><span className="font-semibold text-slate-500">Email:</span> {liveAlertChatModal.residentSnapshot?.email || "N/A"}</p>
                  <p><span className="font-semibold text-slate-500">Number:</span> {liveAlertChatModal.residentSnapshot?.contactNumber || "N/A"}</p>
                </div>
                <div className="mt-4 space-y-2">
                  <Badge value={liveAlertChatModal.status} />
                  {googleMapsUrl(liveAlertChatModal.currentLocation) ? (
                    <a className={`${btnSecondary} w-full`} href={googleMapsUrl(liveAlertChatModal.currentLocation)} target="_blank" rel="noopener noreferrer">
                      <MapPin size={14} className="mr-1" /> Open Google Maps
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">Conversation</p>
                  <p className="text-xs text-slate-500">Messages refresh automatically every few seconds.</p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                  {liveAlertChatMessages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                      No messages yet. Send the first instruction or ask for an update.
                    </div>
                  ) : liveAlertChatMessages.map((item, index) => {
                    const fromStaff = item.senderRole === "admin" || item.senderRole === "superadmin" || item.senderRole === "staff";
                    const fromSystem = item.senderRole === "system";
                    return (
                      <div key={item._id || `${item.createdAt}-${index}`} className={`flex ${fromSystem ? "justify-center" : fromStaff ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-5 shadow-sm ${fromSystem ? "border border-amber-100 bg-amber-50 text-amber-900" : fromStaff ? "rounded-br-sm bg-slate-900 text-white" : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"}`}>
                          <div className={`mb-1 flex items-center justify-between gap-3 text-[11px] font-semibold ${fromSystem ? "text-amber-700" : fromStaff ? "text-white/70" : "text-slate-500"}`}>
                            <span>{fromSystem ? "System" : fromStaff ? "Barangay staff" : item.senderName || "Resident"}</span>
                            <span>{formatDateTime(item.createdAt)}</span>
                          </div>
                          {item.message ? <p className="whitespace-pre-wrap">{item.message}</p> : null}
                          {item.attachments?.length ? (
                            <div className="mt-2 grid gap-2">
                              {item.attachments.map((attachment, attachmentIndex) => (
                                <a
                                  key={`${attachment.name}-${attachmentIndex}`}
                                  className={`overflow-hidden rounded-xl border text-xs font-semibold ${fromStaff ? "border-white/20 bg-white/10 text-white" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                                  href={attachment.dataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {attachment.type.startsWith("image/") ? (
                                    <img src={attachment.dataUrl} alt={attachment.name || "Attachment"} className="max-h-48 w-full object-cover" />
                                  ) : (
                                    <video src={attachment.dataUrl} className="max-h-48 w-full" controls />
                                  )}
                                  <span className="block truncate px-3 py-2">{attachment.name || "Attachment"}</span>
                                </a>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {liveAlertChatTyping?.resident?.isTyping ? (
                    <p className="text-xs font-semibold text-emerald-700">{liveAlertChatTyping.resident.name || "Resident"} is typing...</p>
                  ) : null}
                  <div ref={liveAlertChatEndRef} />
                </div>
                <div className="border-t border-slate-100 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={liveAlertChatText}
                      onChange={(e) => {
                        setLiveAlertChatText(e.target.value);
                        markLiveAlertChatTyping(Boolean(e.target.value.trim()));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void sendLiveAlertChatMessage();
                      }}
                      placeholder="Type instruction or update for the resident..."
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                    />
                    <input
                      ref={liveAlertFileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => void addLiveAlertChatFiles(e.target.files)}
                    />
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      onClick={() => liveAlertFileInputRef.current?.click()}
                      type="button"
                      aria-label="Attach image or video"
                    >
                      <Paperclip size={16} />
                    </button>
                    <button
                      className={btnPrimary}
                      disabled={(!liveAlertChatText.trim() && liveAlertChatAttachments.length === 0) || liveAlertChatSending || liveAlertChatModal.status === "resolved"}
                      onClick={() => void sendLiveAlertChatMessage()}
                      type="button"
                    >
                      Send
                    </button>
                  </div>
                  {liveAlertChatAttachments.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {liveAlertChatAttachments.map((attachment, index) => (
                        <button
                          key={`${attachment.name}-${index}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setLiveAlertChatAttachments((prev) => prev.filter((_, i) => i !== index))}
                          type="button"
                        >
                          {attachment.name} x
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {liveAlertChatModal.residentRating ? (
                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-amber-700">
                        {[1, 2, 3, 4, 5].map((star) => <Star key={star} size={15} fill={star <= Number(liveAlertChatModal.residentRating) ? "currentColor" : "none"} />)}
                        <span className="text-xs font-bold text-amber-900">{liveAlertChatModal.residentRating}/5 resident rating</span>
                      </div>
                      {liveAlertChatModal.residentRatingComment ? <p className="mt-2 text-xs text-amber-900">{liveAlertChatModal.residentRatingComment}</p> : null}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className={btnSecondary}
                      onClick={() => setPendingAction({ title: "Mark Live Alert Unresolved", message: `Move ${liveAlertChatModal.referenceNo} back to unresolved?`, confirmLabel: "Mark Unresolved", run: () => runActionWithFeedback("Live alert marked unresolved", () => api.patch(`/api/emergency-alerts/${liveAlertChatModal._id}/status`, { status: "active" }, { headers: authHeaders() })) })}
                      type="button"
                    >
                      Unresolved
                    </button>
                    <button
                      className={btnPrimary}
                      onClick={() => setPendingAction({ title: "End Live Chat", message: `End the live chat for ${liveAlertChatModal.referenceNo}? The resident will be asked to rate the help.`, confirmLabel: "End Chat", run: () => endLiveAlertChat(liveAlertChatModal) })}
                      type="button"
                    >
                      End Chat / Resolved
                    </button>
                    <button
                      className={btnSecondary}
                      onClick={() => setPendingAction({ title: "Archive Live Alert", message: `Archive ${liveAlertChatModal.referenceNo}?`, confirmLabel: "Archive", run: () => runActionWithFeedback("Live alert archived", () => api.patch(`/api/emergency-alerts/${liveAlertChatModal._id}/archive`, { archived: true }, { headers: authHeaders() })).then(() => setLiveAlertChatModal(null)) })}
                      type="button"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {serviceManageModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Manage Service Request</h3><button onClick={() => setServiceManageModal(null)} type="button"><X size={18} /></button></div>
            <p className="text-sm font-semibold">{serviceManageModal.referenceNo}</p>
            <div className="mt-4 grid gap-3 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Service"><input className={inputBase} value={serviceManageModal.serviceType} onChange={(e) => setServiceManageModal((p) => p ? { ...p, serviceType: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Resident"><input className={inputBase} value={serviceManageModal.fullName} onChange={(e) => setServiceManageModal((p) => p ? { ...p, fullName: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Contact"><input className={inputBase} value={serviceManageModal.contactNumber || ""} onChange={(e) => setServiceManageModal((p) => p ? { ...p, contactNumber: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Address"><input className={inputBase} value={serviceManageModal.address || ""} onChange={(e) => setServiceManageModal((p) => p ? { ...p, address: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Purpose"><textarea className={inputBase} rows={3} value={serviceManageModal.purpose || ""} onChange={(e) => setServiceManageModal((p) => p ? { ...p, purpose: e.target.value } : p)} /></LabeledField>
              <LabeledField label='Comment from the admins'><textarea className={inputBase} rows={3} placeholder="Resident-facing update or action taken" value={serviceManageModal.adminComment || ""} onChange={(e) => setServiceManageModal((p) => p ? { ...p, adminComment: e.target.value } : p)} /></LabeledField>
              {renderHandlerSelect(serviceManageModal, setServiceManageModal)}
              <LabeledField label="Status">
                <select className={inputBase} value={serviceManageModal.status} onChange={(e) => setServiceManageModal((p) => p ? { ...p, status: e.target.value } : p)}>
                  <option value="pending">pending</option>
                  <option value="in-review">in-review</option>
                  <option value="approved">approved</option>
                  <option value="completed">completed</option>
                  <option value="rejected">rejected</option>
                </select>
              </LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Update Request", message: "Save service request changes?", confirmLabel: "Save", run: () => saveManagedServiceRequest(serviceManageModal) })} type="button">Save Request</button>
          </div>
        </div>
      )}

      {messageManageModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Manage Message</h3><button onClick={() => setMessageManageModal(null)} type="button"><X size={18} /></button></div>
            <p className="text-sm font-semibold">{messageManageModal.referenceNo}</p>
            <div className="mt-4 grid gap-3 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Sender"><input className={inputBase} value={messageManageModal.name} onChange={(e) => setMessageManageModal((p) => p ? { ...p, name: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Contact"><input className={inputBase} value={messageManageModal.contact || ""} onChange={(e) => setMessageManageModal((p) => p ? { ...p, contact: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Department"><input className={inputBase} value={messageManageModal.department} onChange={(e) => setMessageManageModal((p) => p ? { ...p, department: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Message"><textarea className={inputBase} rows={3} value={messageManageModal.message || ""} onChange={(e) => setMessageManageModal((p) => p ? { ...p, message: e.target.value } : p)} /></LabeledField>
              <LabeledField label='Comment from the admins'><textarea className={inputBase} rows={3} placeholder="Resident-facing update or action taken" value={messageManageModal.adminComment || ""} onChange={(e) => setMessageManageModal((p) => p ? { ...p, adminComment: e.target.value } : p)} /></LabeledField>
              {renderHandlerSelect(messageManageModal, setMessageManageModal)}
              <LabeledField label="Status">
                <select className={inputBase} value={messageManageModal.status} onChange={(e) => setMessageManageModal((p) => p ? { ...p, status: e.target.value } : p)}>
                  <option value="new">new</option>
                  <option value="read">read</option>
                  <option value="closed">closed</option>
                </select>
              </LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Update Message", message: "Save message changes?", confirmLabel: "Save", run: () => saveManagedMessage(messageManageModal) })} type="button">Save Message</button>
          </div>
        </div>
      )}

      {showClosedMessagesModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-5xl`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Closed Messages</h3>
                <p className="mt-1 text-sm text-slate-500">Closed messages stay here until they are restored or deleted permanently.</p>
              </div>
              <button className={iconBtn} onClick={() => setShowClosedMessagesModal(false)} type="button" title="Close closed messages" aria-label="Close closed messages"><X size={18} /></button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Closed</th>
                    <th className="px-4 py-3 font-semibold">Sender</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {closedMessages.map((m) => (
                    <tr key={m._id} className="border-t border-slate-200 align-top">
                      <td className="px-4 py-3 font-semibold text-slate-900">{m.referenceNo}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatDateTime(m.updatedAt || m.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="min-w-[260px] space-y-2">
                          <DetailBlock label="Closed Message">
                            <p className="font-semibold">{m.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{m.department}</p>
                            {m.message ? <p className="mt-1 text-xs text-slate-500">{m.message}</p> : null}
                          </DetailBlock>
                          <HandlerPill item={m} />
                          <AdminCommentBlock value={m.adminComment} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {hasModulePermission("messages", "edit") ? <button className={btnSecondary} onClick={() => setPendingAction({ title: "Restore Message", message: `Restore ${m.referenceNo}?`, confirmLabel: "Restore", run: () => runActionWithFeedback("Message restored", () => api.patch(`/api/contact/messages/${m._id}/status`, { status: "new" }, { headers: authHeaders() })) })} type="button">Restore</button> : null}
                          {hasModulePermission("messages", "delete") ? <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Permanently", message: `Permanently delete ${m.referenceNo}? This cannot be restored.`, confirmLabel: "Delete Permanently", run: () => runActionWithFeedback("Message permanently deleted", () => api.delete(`/api/contact/messages/${m._id}`, { headers: authHeaders() })) })} type="button">Delete Permanently</button> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {closedMessages.length === 0 && <p className="mt-3 text-sm text-slate-500">No closed messages yet.</p>}
          </div>
        </div>
      )}

      {subscriptionManageModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Manage Subscriber</h3><button onClick={() => setSubscriptionManageModal(null)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 [&_input]:w-full [&_select]:w-full">
              <LabeledField label="Email"><input className={inputBase} type="email" value={subscriptionManageModal.email} onChange={(e) => setSubscriptionManageModal((p) => p ? { ...p, email: e.target.value } : p)} /></LabeledField>
              <LabeledField label="Source"><input className={inputBase} value={subscriptionManageModal.source || ""} onChange={(e) => setSubscriptionManageModal((p) => p ? { ...p, source: e.target.value } : p)} /></LabeledField>
              <LabeledField label='Comment from the admins'><textarea className={inputBase} rows={3} placeholder="Subscriber-facing update or note" value={subscriptionManageModal.adminComment || ""} onChange={(e) => setSubscriptionManageModal((p) => p ? { ...p, adminComment: e.target.value } : p)} /></LabeledField>
              {renderHandlerSelect(subscriptionManageModal, setSubscriptionManageModal)}
              <LabeledField label="Status">
                <select className={inputBase} value={subscriptionManageModal.status} onChange={(e) => setSubscriptionManageModal((p) => p ? { ...p, status: e.target.value as "active" | "unsubscribed" } : p)}>
                  <option value="active">active</option>
                  <option value="unsubscribed">unsubscribed</option>
                </select>
              </LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Update Subscriber", message: "Save subscriber changes?", confirmLabel: "Save", run: () => saveManagedSubscriber(subscriptionManageModal) })} type="button">Save Subscriber</button>
          </div>
        </div>
      )}

      {manageCentersOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-4xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Evacuation Centers</h3><button onClick={() => setManageCentersOpen(false)} type="button"><X size={18} /></button></div>
            <div className="mb-3 flex justify-end">
              <button className={btnPrimary} onClick={() => { setEditingCenterId(null); setNewCenter({ name: "", address: "", lat: "", lng: "", hazardsCovered: "typhoon,flood,earthquake,fire", capacity: "0", notes: "", active: true }); setEvacuationCenterModalOpen(true); }} type="button">Add Center</button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {evacuationCenters.map((center) => (
                <div key={center._id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{center.name}</p>
                      <p className="text-xs text-slate-600">{center.address}</p>
                      <p className="text-xs text-slate-500">({center.location?.lat}, {center.location?.lng}) | Capacity: {center.capacity || 0}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className={btnSecondary} onClick={() => { setEditingCenterId(center._id); setNewCenter({ name: center.name || "", address: center.address || "", lat: String(center.location?.lat ?? ""), lng: String(center.location?.lng ?? ""), hazardsCovered: (center.hazardsCovered || []).join(","), capacity: String(center.capacity || 0), notes: center.notes || "", active: center.active !== false }); setEvacuationCenterModalOpen(true); }} type="button">Edit</button>
                      <button className={btnSecondary} onClick={() => setPendingAction({ title: center.active ? "Deactivate Center" : "Activate Center", message: `${center.active ? "Deactivate" : "Activate"} ${center.name}?`, confirmLabel: "Confirm", run: () => runActionWithFeedback("Center status updated", () => api.put(`/api/services/evacuation-centers/${center._id}`, { ...center, active: !center.active }, { headers: authHeaders() })) })} type="button">{center.active ? "Deactivate" : "Activate"}</button>
                      <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Center", message: `Delete ${center.name}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Center deleted", () => api.delete(`/api/services/evacuation-centers/${center._id}`, { headers: authHeaders() })) })} type="button">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
              {evacuationCenters.length === 0 && <div className="rounded border border-dashed p-4 text-center text-sm text-slate-500">No evacuation centers found.</div>}
            </div>
          </div>
        </div>
      )}

      {manageHotlinesOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-4xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Emergency Hotlines</h3><button onClick={() => setManageHotlinesOpen(false)} type="button"><X size={18} /></button></div>
            <div className="mb-4 rounded-xl border p-3">
              <h4 className="mb-2 text-sm font-semibold">{editingHotlineId ? "Edit Hotline" : "Add Hotline"}</h4>
              <div className="grid gap-2 md:grid-cols-2">
                <LabeledField label="Hotline Name">
                  <input className={inputBase} placeholder="Hotline name" value={newHotline.name} onChange={(e) => setNewHotline((p) => ({ ...p, name: e.target.value }))} />
                </LabeledField>
                <LabeledField label="Type">
                  <input className={inputBase} placeholder="Type (e.g. FIRE)" value={newHotline.type} onChange={(e) => setNewHotline((p) => ({ ...p, type: e.target.value }))} />
                </LabeledField>
                <LabeledField label="Phone Number">
                  <input className={inputBase} placeholder="Number" value={newHotline.number} onChange={(e) => setNewHotline((p) => ({ ...p, number: e.target.value }))} />
                </LabeledField>
                <LabeledField label="Description">
                  <input className={inputBase} placeholder="Description" value={newHotline.desc} onChange={(e) => setNewHotline((p) => ({ ...p, desc: e.target.value }))} />
                </LabeledField>
                <LabeledField label="When To Call (Comma Separated)" className="md:col-span-2">
                  <input className={inputBase} placeholder="When to call (comma separated)" value={newHotline.when} onChange={(e) => setNewHotline((p) => ({ ...p, when: e.target.value }))} />
                </LabeledField>
                <LabeledField label="Prepare Before Calling (Comma Separated)" className="md:col-span-2">
                  <input className={inputBase} placeholder="Prepare before calling (comma separated)" value={newHotline.prepare} onChange={(e) => setNewHotline((p) => ({ ...p, prepare: e.target.value }))} />
                </LabeledField>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={btnPrimary} onClick={() => setPendingAction({ title: editingHotlineId ? "Update Hotline" : "Add Hotline", message: editingHotlineId ? "Save hotline changes?" : "Create this hotline?", confirmLabel: editingHotlineId ? "Save" : "Add", run: () => runActionWithFeedback(editingHotlineId ? "Hotline updated" : "Hotline added", () => (editingHotlineId ? api.put(`/api/services/emergency-hotlines/${editingHotlineId}`, newHotline, { headers: authHeaders() }) : api.post("/api/services/emergency-hotlines", newHotline, { headers: authHeaders() })).then(() => { setEditingHotlineId(null); setNewHotline({ name: "", type: "", number: "", desc: "", when: "", prepare: "", active: true }); })) })} type="button">{editingHotlineId ? "Save Hotline" : "Add Hotline"}</button>
                {editingHotlineId && <button className={btnSecondary} onClick={() => { setEditingHotlineId(null); setNewHotline({ name: "", type: "", number: "", desc: "", when: "", prepare: "", active: true }); }} type="button">Cancel Edit</button>}
              </div>
            </div>
            <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {emergencyHotlines.map((hotline) => (
                <div key={hotline._id} className="rounded border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{hotline.name} <span className="text-xs text-slate-500">({hotline.type})</span></p>
                      <p className="text-xs text-slate-600">{hotline.number}</p>
                      <p className="text-xs text-slate-500">{hotline.desc || "-"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className={btnSecondary} onClick={() => { setEditingHotlineId(hotline._id); setNewHotline({ name: hotline.name || "", type: hotline.type || "", number: hotline.number || "", desc: hotline.desc || "", when: (hotline.when || []).join(", "), prepare: (hotline.prepare || []).join(", "), active: hotline.active !== false }); }} type="button">Edit</button>
                      <button className={btnSecondary} onClick={() => setPendingAction({ title: hotline.active ? "Deactivate Hotline" : "Activate Hotline", message: `${hotline.active ? "Deactivate" : "Activate"} ${hotline.name}?`, confirmLabel: "Confirm", run: () => runActionWithFeedback("Hotline status updated", () => api.patch(`/api/services/emergency-hotlines/${hotline._id}/archive`, { active: !hotline.active }, { headers: authHeaders() })) })} type="button">{hotline.active ? "Deactivate" : "Activate"}</button>
                      <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Hotline", message: `Delete ${hotline.name}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Hotline deleted", () => api.delete(`/api/services/emergency-hotlines/${hotline._id}`, { headers: authHeaders() })) })} type="button">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
              {emergencyHotlines.length === 0 && <div className="rounded border border-dashed p-4 text-center text-sm text-slate-500">No hotlines found.</div>}
            </div>
          </div>
        </div>
      )}

      {officialEditModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-3xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Edit Official</h3><button onClick={() => setOfficialEditModal(null)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Official Name">
                <input className={inputBase} value={officialEditModal.name} onChange={(e) => setOfficialEditModal((p) => p ? { ...p, name: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Position">
                <input className={inputBase} value={officialEditModal.role} onChange={(e) => setOfficialEditModal((p) => p ? { ...p, role: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Level">
                <select className={inputBase} value={officialEditModal.level} onChange={(e) => setOfficialEditModal((p) => p ? { ...p, level: e.target.value as "city" | "barangay" } : p)}><option value="barangay">Barangay</option><option value="city">City</option></select>
              </LabeledField>
              <LabeledField label="Rank Order">
                <input className={inputBase} type="number" value={officialEditModal.rankOrder} onChange={(e) => setOfficialEditModal((p) => p ? { ...p, rankOrder: Number(e.target.value) || 100 } : p)} />
              </LabeledField>
              <LabeledField label="Committee" className="lg:col-span-2">
                <input className={inputBase} value={officialEditModal.committee || ""} onChange={(e) => setOfficialEditModal((p) => p ? { ...p, committee: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Description" className="lg:col-span-2">
                <input className={inputBase} value={officialEditModal.description || ""} onChange={(e) => setOfficialEditModal((p) => p ? { ...p, description: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Image URL (Optional)" className="lg:col-span-2">
                <input className={inputBase} value={officialEditModal.image || ""} onChange={(e) => setOfficialEditModal((p) => p ? { ...p, image: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Upload Image" className="lg:col-span-2">
                <input id="edit-official-image" className="hidden" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) fileToBase64(file, (value) => setOfficialEditModal((p) => p ? { ...p, image: value } : p)); }} />
                <label htmlFor="edit-official-image" className={btnSecondary}>
                  Choose Official Image
                </label>
              </LabeledField>
              {officialEditModal.image && <img src={officialEditModal.image} alt="Official preview" className="h-20 w-20 rounded border object-cover lg:col-span-2" />}
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Update Official", message: "Save official changes?", confirmLabel: "Save", run: () => runActionWithFeedback("Official updated", () => api.put(`/api/officials/${officialEditModal._id}`, officialEditModal, { headers: authHeaders() }).then(() => setOfficialEditModal(null))) })} type="button">Save Official</button>
          </div>
        </div>
      )}

      {announcementEditModal && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-3xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Edit Announcement</h3><button onClick={() => setAnnouncementEditModal(null)} type="button"><X size={18} /></button></div>
            <div className="grid gap-3 lg:grid-cols-2 [&_input]:w-full [&_select]:w-full [&_textarea]:w-full">
              <LabeledField label="Title">
                <input className={inputBase} value={announcementEditModal.title} onChange={(e) => setAnnouncementEditModal((p) => p ? { ...p, title: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Category">
                <input className={inputBase} value={announcementEditModal.category} onChange={(e) => setAnnouncementEditModal((p) => p ? { ...p, category: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Module" className="lg:col-span-2">
                <select className={inputBase} value={announcementEditModal.module} onChange={(e) => setAnnouncementEditModal((p) => p ? { ...p, module: e.target.value } : p)}><option value="barangay-updates">Barangay Updates</option><option value="emergency-hotlines">Emergency Hotlines</option><option value="phivolcs-alerts">PHIVOLCS Alerts</option><option value="fact-check">Fact Check</option><option value="all-news-updates">All News & Updates</option></select>
              </LabeledField>
              <LabeledField label="Content" className="lg:col-span-2">
                <textarea className={inputBase} rows={3} value={announcementEditModal.content || ""} onChange={(e) => setAnnouncementEditModal((p) => p ? { ...p, content: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Image URL (Optional)" className="lg:col-span-2">
                <input className={inputBase} value={announcementEditModal.image || ""} onChange={(e) => setAnnouncementEditModal((p) => p ? { ...p, image: e.target.value } : p)} />
              </LabeledField>
              <LabeledField label="Upload Image" className="lg:col-span-2">
                <input id="edit-announcement-image" className="hidden" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) fileToBase64(file, (value) => setAnnouncementEditModal((p) => p ? { ...p, image: value } : p)); }} />
                <label htmlFor="edit-announcement-image" className={btnSecondary}>
                  Choose Announcement Image
                </label>
              </LabeledField>
              {announcementEditModal.image && <img src={announcementEditModal.image} alt="Announcement preview" className="h-20 w-28 rounded border object-cover lg:col-span-2" />}
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Update Announcement", message: "Save announcement changes?", confirmLabel: "Save", run: () => runActionWithFeedback("Announcement updated", () => api.put(`/api/announcements/${announcementEditModal._id}`, announcementEditModal, { headers: authHeaders() }).then(() => setAnnouncementEditModal(null))) })} type="button">Save Announcement</button>
          </div>
        </div>
      )}

      {evacuationCenterModalOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-3xl`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingCenterId ? "Edit Evacuation Center" : "Add Evacuation Center"}</h3>
              <button onClick={() => setEvacuationCenterModalOpen(false)} type="button"><X size={18} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 [&_input]:w-full [&_textarea]:w-full">
              <LabeledField label="Center Name" className="sm:col-span-2">
                <input className={inputBase} placeholder="Center name" value={newCenter.name} onChange={(e) => setNewCenter((p) => ({ ...p, name: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Address" className="sm:col-span-2">
                <input className={inputBase} placeholder="Address" value={newCenter.address} onChange={(e) => setNewCenter((p) => ({ ...p, address: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Latitude">
                <input className={inputBase} placeholder="Latitude" value={newCenter.lat} onChange={(e) => setNewCenter((p) => ({ ...p, lat: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Longitude">
                <input className={inputBase} placeholder="Longitude" value={newCenter.lng} onChange={(e) => setNewCenter((p) => ({ ...p, lng: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Hazards Covered (Comma Separated)" className="sm:col-span-2">
                <input className={inputBase} placeholder="typhoon,flood,earthquake,fire" value={newCenter.hazardsCovered} onChange={(e) => setNewCenter((p) => ({ ...p, hazardsCovered: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Capacity">
                <input className={inputBase} placeholder="Capacity" value={newCenter.capacity} onChange={(e) => setNewCenter((p) => ({ ...p, capacity: e.target.value }))} />
              </LabeledField>
              <LabeledField label="Notes">
                <input className={inputBase} placeholder="Notes" value={newCenter.notes} onChange={(e) => setNewCenter((p) => ({ ...p, notes: e.target.value }))} />
              </LabeledField>
            </div>
            <button
              className={`${btnPrimary} mt-4 w-full text-sm`}
              onClick={() => setPendingAction({
                title: editingCenterId ? "Update Center" : "Add Center",
                message: editingCenterId ? "Save this evacuation center?" : "Create this evacuation center?",
                confirmLabel: editingCenterId ? "Save" : "Add",
                run: () =>
                  runActionWithFeedback(editingCenterId ? "Center updated" : "Center added", () =>
                    (editingCenterId
                      ? api.put(`/api/services/evacuation-centers/${editingCenterId}`, { name: newCenter.name, address: newCenter.address, location: { lat: Number(newCenter.lat), lng: Number(newCenter.lng) }, hazardsCovered: String(newCenter.hazardsCovered).split(",").map((x) => x.trim()).filter(Boolean), capacity: Number(newCenter.capacity) || 0, notes: newCenter.notes, active: newCenter.active }, { headers: authHeaders() })
                      : api.post("/api/services/evacuation-centers", { name: newCenter.name, address: newCenter.address, location: { lat: Number(newCenter.lat), lng: Number(newCenter.lng) }, hazardsCovered: String(newCenter.hazardsCovered).split(",").map((x) => x.trim()).filter(Boolean), capacity: Number(newCenter.capacity) || 0, notes: newCenter.notes, active: newCenter.active }, { headers: authHeaders() }))
                      .then(() => {
                        setEditingCenterId(null);
                        setEvacuationCenterModalOpen(false);
                        setNewCenter({ name: "", address: "", lat: "", lng: "", hazardsCovered: "typhoon,flood,earthquake,fire", capacity: "0", notes: "", active: true });
                      }),
                  ),
              })}
              type="button"
            >
              {editingCenterId ? "Save Center" : "Add Center"}
            </button>
          </div>
        </div>
      )}

      {homeEditOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-5xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Edit Home Content</h3><button onClick={() => setHomeEditOpen(false)} type="button"><X size={18} /></button></div>
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Navbar & Hero</h4>
              <LabeledField label="Navbar Brand Text"><input className={inputBase} placeholder="Navbar brand text" value={siteContent.navbarBrandText} onChange={(e) => setSiteContent((p) => ({ ...p, navbarBrandText: e.target.value }))} /></LabeledField>
              <LabeledField label="Hero Eyebrow"><input className={inputBase} placeholder="Hero eyebrow" value={siteContent.heroEyebrow} onChange={(e) => setSiteContent((p) => ({ ...p, heroEyebrow: e.target.value }))} /></LabeledField>
              <div className="grid gap-2 md:grid-cols-2">
                <LabeledField label="Hero Title Line 1"><input className={inputBase} placeholder="Hero title line 1" value={siteContent.heroTitleLine1} onChange={(e) => setSiteContent((p) => ({ ...p, heroTitleLine1: e.target.value }))} /></LabeledField>
                <LabeledField label="Hero Title Line 2"><input className={inputBase} placeholder="Hero title line 2" value={siteContent.heroTitleLine2} onChange={(e) => setSiteContent((p) => ({ ...p, heroTitleLine2: e.target.value }))} /></LabeledField>
              </div>
              <LabeledField label="Hero Subtitle"><textarea className={inputBase} rows={2} placeholder="Hero subtitle" value={siteContent.heroSubtitle} onChange={(e) => setSiteContent((p) => ({ ...p, heroSubtitle: e.target.value }))} /></LabeledField>
              <div className="grid gap-2 md:grid-cols-2">
                <LabeledField label="Hero Primary CTA"><input className={inputBase} placeholder="Hero primary CTA" value={siteContent.heroPrimaryCta} onChange={(e) => setSiteContent((p) => ({ ...p, heroPrimaryCta: e.target.value }))} /></LabeledField>
                <LabeledField label="Hero Secondary CTA"><input className={inputBase} placeholder="Hero secondary CTA" value={siteContent.heroSecondaryCta} onChange={(e) => setSiteContent((p) => ({ ...p, heroSecondaryCta: e.target.value }))} /></LabeledField>
              </div>
            </div>
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Community Snapshot Cards</h4>
              <div className="grid gap-2 md:grid-cols-2">
              {siteContent.communityCards.map((c, idx) => (
                <div key={idx} className="rounded border p-3 text-xs">
                  <LabeledField label="Card Value"><input className={`${inputBase} px-2 py-1`} placeholder="Value" value={c.value} onChange={(e) => setSiteContent((p) => ({ ...p, communityCards: p.communityCards.map((x, i) => i === idx ? { ...x, value: e.target.value } : x) }))} /></LabeledField>
                  <LabeledField label="Card Label"><input className={`${inputBase} px-2 py-1`} placeholder="Label" value={c.label} onChange={(e) => setSiteContent((p) => ({ ...p, communityCards: p.communityCards.map((x, i) => i === idx ? { ...x, label: e.target.value } : x) }))} /></LabeledField>
                  <LabeledField label="Card Sublabel"><input className={`${inputBase} px-2 py-1`} placeholder="Sublabel" value={c.sublabel} onChange={(e) => setSiteContent((p) => ({ ...p, communityCards: p.communityCards.map((x, i) => i === idx ? { ...x, sublabel: e.target.value } : x) }))} /></LabeledField>
                </div>
              ))}
              </div>
            </div>
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Governance Section</h4>
              <LabeledField label="Governance Title"><input className={inputBase} placeholder="Governance title" value={siteContent.governanceTitle} onChange={(e) => setSiteContent((p) => ({ ...p, governanceTitle: e.target.value }))} /></LabeledField>
              <LabeledField label="Governance Subtitle"><input className={inputBase} placeholder="Governance subtitle" value={siteContent.governanceSubtitle} onChange={(e) => setSiteContent((p) => ({ ...p, governanceSubtitle: e.target.value }))} /></LabeledField>
              <div className="grid gap-2 md:grid-cols-3">
                {siteContent.governanceItems.map((item, idx) => (
                  <div key={idx} className="rounded border p-3 text-xs">
                    <LabeledField label="Item Title"><input className={`${inputBase} px-2 py-1`} placeholder="Item title" value={item.title} onChange={(e) => setSiteContent((p) => ({ ...p, governanceItems: p.governanceItems.map((x, i) => i === idx ? { ...x, title: e.target.value } : x) }))} /></LabeledField>
                    <LabeledField label="Item Description"><textarea className={`${inputBase} px-2 py-1`} rows={3} placeholder="Item description" value={item.description} onChange={(e) => setSiteContent((p) => ({ ...p, governanceItems: p.governanceItems.map((x, i) => i === idx ? { ...x, description: e.target.value } : x) }))} /></LabeledField>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-700">Pages & Footer</h4>
              <LabeledField label="Services Hero Title"><input className={inputBase} placeholder="Services hero title" value={siteContent.servicesHeroTitle} onChange={(e) => setSiteContent((p) => ({ ...p, servicesHeroTitle: e.target.value }))} /></LabeledField>
              <LabeledField label="Services Hero Subtitle"><input className={inputBase} placeholder="Services hero subtitle" value={siteContent.servicesHeroSubtitle} onChange={(e) => setSiteContent((p) => ({ ...p, servicesHeroSubtitle: e.target.value }))} /></LabeledField>
              <LabeledField label="Emergency Hotlines Title"><input className={inputBase} placeholder="Emergency hotlines title" value={siteContent.emergencyHotlinesTitle} onChange={(e) => setSiteContent((p) => ({ ...p, emergencyHotlinesTitle: e.target.value }))} /></LabeledField>
              <LabeledField label="Emergency Hotlines Subtitle"><input className={inputBase} placeholder="Emergency hotlines subtitle" value={siteContent.emergencyHotlinesSubtitle} onChange={(e) => setSiteContent((p) => ({ ...p, emergencyHotlinesSubtitle: e.target.value }))} /></LabeledField>
              <LabeledField label="Officials Page Title"><input className={inputBase} placeholder="Officials page title" value={siteContent.officialsPageTitle} onChange={(e) => setSiteContent((p) => ({ ...p, officialsPageTitle: e.target.value }))} /></LabeledField>
              <LabeledField label="Officials Page Subtitle"><textarea className={inputBase} rows={2} placeholder="Officials page subtitle" value={siteContent.officialsPageSubtitle} onChange={(e) => setSiteContent((p) => ({ ...p, officialsPageSubtitle: e.target.value }))} /></LabeledField>
              <LabeledField label="Footer Brand Text"><input className={inputBase} placeholder="Footer brand text" value={siteContent.footerBrandText} onChange={(e) => setSiteContent((p) => ({ ...p, footerBrandText: e.target.value }))} /></LabeledField>
              <LabeledField label="Footer Description"><textarea className={inputBase} rows={2} placeholder="Footer description" value={siteContent.footerDescription} onChange={(e) => setSiteContent((p) => ({ ...p, footerDescription: e.target.value }))} /></LabeledField>
              <LabeledField label="Footer Address"><input className={inputBase} placeholder="Footer address" value={siteContent.footerAddress} onChange={(e) => setSiteContent((p) => ({ ...p, footerAddress: e.target.value }))} /></LabeledField>
              <div className="grid gap-2 md:grid-cols-2">
                <LabeledField label="Footer Phone"><input className={inputBase} placeholder="Footer phone" value={siteContent.footerPhone} onChange={(e) => setSiteContent((p) => ({ ...p, footerPhone: e.target.value }))} /></LabeledField>
                <LabeledField label="Footer Email"><input className={inputBase} placeholder="Footer email" value={siteContent.footerEmail} onChange={(e) => setSiteContent((p) => ({ ...p, footerEmail: e.target.value }))} /></LabeledField>
              </div>
            </div>
            <button
              className={`${btnPrimary} mt-4 w-full text-sm`}
              onClick={() => setPendingAction({
                title: "Save Home Content",
                message: "Apply homepage and shared content updates?",
                confirmLabel: "Save",
                run: () => runActionWithFeedback("Home content updated", () => api.patch("/api/content/site", {
                  navbarBrandText: siteContent.navbarBrandText,
                  heroEyebrow: siteContent.heroEyebrow,
                  heroTitleLine1: siteContent.heroTitleLine1,
                  heroTitleLine2: siteContent.heroTitleLine2,
                  heroSubtitle: siteContent.heroSubtitle,
                  heroPrimaryCta: siteContent.heroPrimaryCta,
                  heroSecondaryCta: siteContent.heroSecondaryCta,
                  communityCards: siteContent.communityCards,
                  governanceTitle: siteContent.governanceTitle,
                  governanceSubtitle: siteContent.governanceSubtitle,
                  governanceItems: siteContent.governanceItems,
                  servicesHeroTitle: siteContent.servicesHeroTitle,
                  servicesHeroSubtitle: siteContent.servicesHeroSubtitle,
                  emergencyHotlinesTitle: siteContent.emergencyHotlinesTitle,
                  emergencyHotlinesSubtitle: siteContent.emergencyHotlinesSubtitle,
                  officialsPageTitle: siteContent.officialsPageTitle,
                  officialsPageSubtitle: siteContent.officialsPageSubtitle,
                  footerBrandText: siteContent.footerBrandText,
                  footerDescription: siteContent.footerDescription,
                  footerAddress: siteContent.footerAddress,
                  footerPhone: siteContent.footerPhone,
                  footerEmail: siteContent.footerEmail,
                }, { headers: authHeaders() }).then(() => setHomeEditOpen(false))),
              })}
              type="button"
            >
              Save Home Content
            </button>
          </div>
        </div>
      )}

      {aboutEditOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-4xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Edit About Content</h3><button onClick={() => setAboutEditOpen(false)} type="button"><X size={18} /></button></div>
            <div className="space-y-2">
              <LabeledField label="About Hero Title"><input className={inputBase} placeholder="About hero title" value={siteContent.aboutHeroTitle} onChange={(e) => setSiteContent((p) => ({ ...p, aboutHeroTitle: e.target.value }))} /></LabeledField>
              <LabeledField label="About Hero Subtitle"><input className={inputBase} placeholder="About hero subtitle" value={siteContent.aboutHeroSubtitle} onChange={(e) => setSiteContent((p) => ({ ...p, aboutHeroSubtitle: e.target.value }))} /></LabeledField>
              <label className="text-xs font-semibold text-slate-600">Snapshot lines (format: Label|Value)</label>
              <textarea className={inputBase} rows={5} value={aboutSnapshotDraft} onChange={(e) => setAboutSnapshotDraft(e.target.value)} />
              <label className="text-xs font-semibold text-slate-600">Population trend lines (format: Year|Count)</label>
              <textarea className={inputBase} rows={4} value={aboutTrendDraft} onChange={(e) => setAboutTrendDraft(e.target.value)} />
              <label className="text-xs font-semibold text-slate-600">Core governance lines (one line per bullet)</label>
              <textarea className={inputBase} rows={4} value={aboutGovDraft} onChange={(e) => setAboutGovDraft(e.target.value)} />
              <LabeledField label="History Text"><textarea className={inputBase} rows={3} placeholder="History text" value={siteContent.aboutHistoryText} onChange={(e) => setSiteContent((p) => ({ ...p, aboutHistoryText: e.target.value }))} /></LabeledField>
              <LabeledField label="Governance Text"><textarea className={inputBase} rows={3} placeholder="Governance text" value={siteContent.aboutGovernanceText} onChange={(e) => setSiteContent((p) => ({ ...p, aboutGovernanceText: e.target.value }))} /></LabeledField>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Save About Content", message: "Apply about page updates?", confirmLabel: "Save", run: () => runActionWithFeedback("About content updated", () => api.patch("/api/content/site", { aboutHeroTitle: siteContent.aboutHeroTitle, aboutHeroSubtitle: siteContent.aboutHeroSubtitle, aboutSnapshotItems: linesToPairs(aboutSnapshotDraft), aboutPopulationTrend: linesToPairs(aboutTrendDraft), aboutCoreGovernance: aboutGovDraft.split('\n').map((x) => x.trim()).filter(Boolean), aboutHistoryText: siteContent.aboutHistoryText, aboutGovernanceText: siteContent.aboutGovernanceText }, { headers: authHeaders() }).then(() => setAboutEditOpen(false))) })} type="button">Save About Content</button>
          </div>
        </div>
      )}

      {contactEditOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-5xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Edit Contact Content</h3><button onClick={() => setContactEditOpen(false)} type="button"><X size={18} /></button></div>
            <div className="space-y-2">
              <LabeledField label="Office Hours"><input className={inputBase} placeholder="Office hours" value={siteContent.contactOfficeHours || ""} onChange={(e) => setSiteContent((p: any) => ({ ...p, contactOfficeHours: e.target.value }))} /></LabeledField>
              <LabeledField label="Location Text"><input className={inputBase} placeholder="Location text" value={siteContent.contactLocationText || ""} onChange={(e) => setSiteContent((p: any) => ({ ...p, contactLocationText: e.target.value }))} /></LabeledField>
            </div>
            <div className="mt-4 rounded border p-3">
              <p className="mb-2 text-sm font-semibold">Department Directory</p>
              <div className="mb-2 hidden grid-cols-12 gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid">
                <span className="col-span-4">Department</span>
                <span className="col-span-4">Contact Person</span>
                <span className="col-span-2">Local No.</span>
                <span className="col-span-1 text-center">Save</span>
                <span className="col-span-1 text-center">Delete</span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {departments.map((d) => (
                  <div key={d._id} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                    <input className={`${inputBase} px-2 py-1.5 text-xs md:col-span-4`} value={d.name} onChange={(e) => setDepartments((prev) => prev.map((x) => x._id === d._id ? { ...x, name: e.target.value } : x))} />
                    <input className={`${inputBase} px-2 py-1.5 text-xs md:col-span-4`} value={d.contactPerson} onChange={(e) => setDepartments((prev) => prev.map((x) => x._id === d._id ? { ...x, contactPerson: e.target.value } : x))} />
                    <input className={`${inputBase} px-2 py-1.5 text-xs md:col-span-2`} value={d.localNumber} onChange={(e) => setDepartments((prev) => prev.map((x) => x._id === d._id ? { ...x, localNumber: e.target.value } : x))} />
                    <button className={`${btnSecondary} md:col-span-1`} onClick={() => setPendingAction({ title: "Save Department", message: `Save changes for ${d.name}?`, confirmLabel: "Save", run: () => runActionWithFeedback("Department updated", () => api.put(`/api/contact/departments/${d._id}`, { name: d.name, contactPerson: d.contactPerson, localNumber: d.localNumber, active: true }, { headers: authHeaders() })) })} type="button">Save</button>
                    <button className={`${btnDanger} md:col-span-1`} onClick={() => setPendingAction({ title: "Delete Department", message: `Delete ${d.name}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Department deleted", () => api.delete(`/api/contact/departments/${d._id}`, { headers: authHeaders() })) })} type="button">Delete</button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 border-t pt-3 md:grid-cols-12">
                <input className={`${inputBase} px-2 py-1.5 text-xs md:col-span-4`} placeholder="Department" value={newDepartment.name} onChange={(e) => setNewDepartment((p) => ({ ...p, name: e.target.value }))} />
                <input className={`${inputBase} px-2 py-1.5 text-xs md:col-span-4`} placeholder="Contact Person" value={newDepartment.contactPerson} onChange={(e) => setNewDepartment((p) => ({ ...p, contactPerson: e.target.value }))} />
                <input className={`${inputBase} px-2 py-1.5 text-xs md:col-span-2`} placeholder="Local No." value={newDepartment.localNumber} onChange={(e) => setNewDepartment((p) => ({ ...p, localNumber: e.target.value }))} />
                <button className={`${btnPrimary} md:col-span-2`} onClick={() => setPendingAction({ title: "Add Department", message: "Create this department row?", confirmLabel: "Add", run: () => runActionWithFeedback("Department added", () => api.post("/api/contact/departments", { ...newDepartment, active: true }, { headers: authHeaders() }).then(() => setNewDepartment({ name: "", contactPerson: "", localNumber: "" }))) })} type="button">Add Department</button>
              </div>
            </div>
            <button className={`${btnPrimary} mt-4 w-full text-sm`} onClick={() => setPendingAction({ title: "Save Contact Content", message: "Apply contact content updates?", confirmLabel: "Save", run: () => runActionWithFeedback("Contact content updated", () => api.patch("/api/content/site", { contactOfficeHours: (siteContent as any).contactOfficeHours, contactLocationText: (siteContent as any).contactLocationText }, { headers: authHeaders() }).then(() => setContactEditOpen(false))) })} type="button">Save Contact Content</button>
          </div>
        </div>
      )}

      {servicesEditOpen && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-5xl`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Manage Services Catalog</h3><button onClick={() => setServicesEditOpen(false)} type="button"><X size={18} /></button></div>
            <div className="mb-3 grid gap-2 md:grid-cols-2">
              <LabeledField label="Service Code"><input className={inputBase} placeholder="Code (e.g. barangay-clearance)" value={newCatalogItem.code} onChange={(e) => setNewCatalogItem((p) => ({ ...p, code: e.target.value }))} /></LabeledField>
              <LabeledField label="Service Title"><input className={inputBase} placeholder="Title" value={newCatalogItem.title} onChange={(e) => setNewCatalogItem((p) => ({ ...p, title: e.target.value }))} /></LabeledField>
              <LabeledField label="Description" className="md:col-span-2"><input className={inputBase} placeholder="Description" value={newCatalogItem.desc} onChange={(e) => setNewCatalogItem((p) => ({ ...p, desc: e.target.value }))} /></LabeledField>
              <LabeledField label="Usage"><input className={inputBase} placeholder="Usage" value={newCatalogItem.usage} onChange={(e) => setNewCatalogItem((p) => ({ ...p, usage: e.target.value }))} /></LabeledField>
              <LabeledField label="Processing Time"><input className={inputBase} placeholder="Time" value={newCatalogItem.time} onChange={(e) => setNewCatalogItem((p) => ({ ...p, time: e.target.value }))} /></LabeledField>
              <LabeledField label="Requirements (Comma Separated)" className="md:col-span-2"><input className={inputBase} placeholder="Requirements (comma separated)" value={newCatalogItem.requirements} onChange={(e) => setNewCatalogItem((p) => ({ ...p, requirements: e.target.value }))} /></LabeledField>
            </div>
            <button className={`${btnPrimary} mb-4 w-full text-sm`} onClick={() => setPendingAction({ title: editingCatalogId ? "Update Service" : "Add Service", message: editingCatalogId ? "Save this service catalog item?" : "Create this service catalog item?", confirmLabel: editingCatalogId ? "Save" : "Add", run: () => runActionWithFeedback(editingCatalogId ? "Service updated" : "Service added", () => (editingCatalogId ? api.put(`/api/services/catalog/${editingCatalogId}`, { ...newCatalogItem, requirements: String(newCatalogItem.requirements).split(",").map((x) => x.trim()).filter(Boolean) }, { headers: authHeaders() }) : api.post("/api/services/catalog", { ...newCatalogItem, requirements: String(newCatalogItem.requirements).split(",").map((x) => x.trim()).filter(Boolean) }, { headers: authHeaders() })).then(() => { setEditingCatalogId(null); setNewCatalogItem({ code: "", title: "", desc: "", usage: "", requirements: "", time: "", active: true, sortOrder: 100 }); })) })} type="button">{editingCatalogId ? "Save Service" : "Add Service"}</button>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {serviceCatalog.map((item) => (
                <div key={item._id} className="flex flex-col gap-2 rounded border p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="font-semibold">{item.title}</p><p className="text-xs text-slate-500">{item.code} | {item.active ? "active" : "archived"}</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button className={btnSecondary} onClick={() => { setEditingCatalogId(item._id); setNewCatalogItem({ code: item.code || "", title: item.title || "", desc: item.desc || "", usage: item.usage || "", requirements: (item.requirements || []).join(", "), time: item.time || "", active: item.active !== false, sortOrder: item.sortOrder || 100 }); }} type="button">Edit</button>
                    <button className={btnSecondary} onClick={() => setPendingAction({ title: item.active ? "Archive Service" : "Activate Service", message: `${item.active ? "Archive" : "Activate"} ${item.title}?`, confirmLabel: "Confirm", run: () => runActionWithFeedback("Service status updated", () => api.patch(`/api/services/catalog/${item._id}/archive`, { active: !item.active }, { headers: authHeaders() })) })} type="button">{item.active ? "Archive" : "Activate"}</button>
                    <button className={btnDanger} onClick={() => setPendingAction({ title: "Delete Service", message: `Delete ${item.title}?`, confirmLabel: "Delete", run: () => runActionWithFeedback("Service deleted", () => api.delete(`/api/services/catalog/${item._id}`, { headers: authHeaders() })) })} type="button">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {monthlyDetailModal && (() => {
        const series = monthlySeries.find((item) => item.key === monthlyDetailModal) || monthlySeries[0];
        const rows = [...monthlyDetailRows[monthlyDetailModal]].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        const columns = monthlyDetailColumns[monthlyDetailModal];
        const max = Math.max(1, ...monthlyOverview.map((row) => Number(row[monthlyDetailModal] || 0)));
        return (
          <div className={modalOverlay}>
            <div className={`${modalCard} max-w-6xl`}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`text-xs font-bold uppercase tracking-[0.2em] ${series.accent}`}>Last 6 months</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{series.label}</h3>
                  <p className="mt-1 text-sm text-slate-500">Monthly graph details with the matching records below.</p>
                </div>
                <button className={iconBtn} onClick={() => setMonthlyDetailModal(null)} type="button" title="Close details" aria-label="Close details"><X size={18} /></button>
              </div>
              <div className={`rounded-2xl border ${series.border} ${series.soft} p-4`}>
                <div className="flex h-52 items-end gap-3">
                  {monthlyOverview.map((row) => {
                    const value = Number(row[monthlyDetailModal] || 0);
                    return (
                      <div key={`${monthlyDetailModal}-modal-${row.key}`} className="flex flex-1 flex-col items-center gap-2">
                        <div className="flex h-40 w-full items-end rounded-xl bg-white/70 px-2 pt-2">
                          <div className={`w-full rounded-t-lg ${series.color} shadow-sm transition-all duration-300 ease-out`} style={{ height: `${Math.max(8, Math.round((value / max) * 100))}%` }} />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{row.label}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-900">{value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Time</th>
                      {columns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-600">{formatDateOnly(row.createdAt)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-slate-500">{formatTimeOnly(row.createdAt)}</td>
                        {row.cells.map((cell, index) => <td key={`${row.id}-${index}`} className="px-4 py-3 text-slate-700">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">No matching records in the last 6 months.</p> : null}
            </div>
          </div>
        );
      })()}

      {feedback && <div className="fixed right-2 top-20 z-50 sm:right-4 sm:top-24"><div className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}><p className="font-semibold">{feedback.title}</p><p>{feedback.message}</p></div></div>}
      {pendingAction && <div className={modalOverlay}><div className={`${modalCard} max-w-lg`}><h3 className="text-lg font-bold text-slate-900">{pendingAction.title}</h3><p className="mt-2 text-sm text-slate-600">{pendingAction.message}</p><div className="mt-6 flex gap-3"><button className={`${btnSecondary} flex-1 text-sm`} onClick={() => setPendingAction(null)} disabled={actionLoading} type="button">Cancel</button><button className={`${btnPrimary} flex-1 text-sm`} onClick={confirmPendingAction} disabled={actionLoading} type="button">{pendingAction.confirmLabel}</button></div></div></div>}
      {childDetailModal ? (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-2xl`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Linked Child Details</h3>
                <p className="mt-1 text-sm text-slate-500">{childDetailModal.child.fullName || "Child record"}</p>
              </div>
              <button onClick={() => setChildDetailModal(null)} type="button"><X size={18} /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Email</p>
                <p className="mt-1 text-sm break-all text-slate-800">{childDetailModal.child.email || "N/A"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Birth Date</p>
                <p className="mt-1 text-sm text-slate-800">{childDetailModal.child.birthDate || "N/A"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Relationship</p>
                <p className="mt-1 text-sm text-slate-800">{childDetailModal.child.relationship || "Child"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Status</p>
                <div className="mt-1 w-fit"><Badge value={childDetailModal.child.status || "pending"} /></div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                    <span>{childReviewProgress(childDetailModal.child.status) === 100 ? "System synced" : "Waiting for review"}</span>
                    <span>{childReviewProgress(childDetailModal.child.status)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full transition-all ${childReviewProgress(childDetailModal.child.status) === 100 ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${childReviewProgress(childDetailModal.child.status)}%` }} />
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Review Note</p>
                <p className="mt-1 text-sm leading-6 text-slate-800">{childDetailModal.child.reviewReason || "No review note yet."}</p>
              </div>
            </div>
            {canReviewUsers ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">Available Actions</p>
                <div className="flex flex-wrap gap-2">
                  {childDetailModal.child.status === "pending" && childDetailModal.child._id ? (
                    <>
                      <button
                        className={btnPrimary}
                        onClick={async () => {
                          const { parent, child } = childDetailModal;
                          if (!child._id) return;
                          await runActionWithFeedback(
                            "Child access approved",
                            () => api.patch(`/api/admin/users/${parent._id}/children/${child._id}/status`, { status: "approved" }, { headers: authHeaders() }),
                          );
                          setChildDetailModal(null);
                          setSelectedUser(null);
                        }}
                        type="button"
                      >
                        Approve Access
                      </button>
                      <button
                        className={btnDanger}
                        onClick={() => {
                          const { parent, child } = childDetailModal;
                          if (!child._id) return;
                          setChildDetailModal(null);
                          openUserReasonPrompt({
                            kind: "child-status",
                            title: "Reject Child Access",
                            userId: parent._id,
                            username: parent.username,
                            nextStatus: "rejected",
                            childId: child._id,
                            childName: child.fullName || "Child",
                          });
                        }}
                        type="button"
                      >
                        Reject Access
                      </button>
                    </>
                  ) : childDetailModal.child._id ? (
                    <>
                      <button
                        className={btnSecondary}
                        onClick={() => {
                          const { parent, child } = childDetailModal;
                          if (!child._id) return;
                          setChildDetailModal(null);
                          openUserReasonPrompt({
                            kind: "child-status",
                            title: "Return Child Access to Pending Review",
                            userId: parent._id,
                            username: parent.username,
                            nextStatus: "pending",
                            childId: child._id,
                            childName: child.fullName || "Child",
                          });
                        }}
                        type="button"
                      >
                        Return to Pending
                      </button>
                      <button
                        className={btnDanger}
                        onClick={() => {
                          const { parent, child } = childDetailModal;
                          setChildDetailModal(null);
                          setPendingAction({
                            title: "Remove Child Link",
                            message: `Delete the linked child access for ${child.fullName}?`,
                            confirmLabel: "Delete",
                            run: () => runActionWithFeedback("Child access removed", () => api.delete(`/api/admin/users/${parent._id}/children/${child._id}`, { headers: authHeaders() })),
                          });
                        }}
                        type="button"
                      >
                        Delete Link
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {accountControlModal ? (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-2xl`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Modify Account</h3>
                <p className="mt-1 text-sm text-slate-500">{accountControlModal.username}</p>
              </div>
              <button onClick={() => setAccountControlModal(null)} type="button"><X size={18} /></button>
            </div>
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs leading-5 text-emerald-900">
              Changes made here apply immediately after confirmation.
            </div>
            <div className={`grid gap-3 ${canManage ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
              {canManage ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Role</p>
                  <select className={inputBase} value={accountControlModal.role} disabled={isProtectedSuperadminAccount(accountControlModal)} onChange={(e) => setAccountControlModal((p) => p ? { ...p, role: e.target.value } : p)}>
                    <option value="resident">resident</option>
                    <option value="admin">admin</option>
                    <option value="superadmin">superadmin</option>
                  </select>
                </div>
              ) : null}
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Current Status</p>
                <div className="w-fit"><Badge value={accountControlModal.status} /></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className={btnPrimary}
                onClick={() => {
                  void updateUserStatusDirect(accountControlModal, "active", "approved", "", accountControlModal.role);
                  setAccountControlModal(null);
                }}
                type="button"
              >
                Approve / Save
              </button>
              {!isProtectedSuperadminAccount(accountControlModal) ? (
                <>
                  <button
                    className={btnSecondary}
                    onClick={() => {
                      openUserReasonPrompt({ kind: "user-status", title: "Return User to Pending Review", userId: accountControlModal._id, username: accountControlModal.username, nextStatus: "pending", validIdStatus: "pending", role: canManage ? accountControlModal.role : undefined });
                      setAccountControlModal(null);
                    }}
                    type="button"
                  >
                    Return to Pending
                  </button>
                  <button
                    className={btnSecondary}
                    onClick={() => {
                      openUserReasonPrompt({ kind: "user-status", title: "Suspend User", userId: accountControlModal._id, username: accountControlModal.username, nextStatus: "suspended", validIdStatus: "rejected", role: canManage ? accountControlModal.role : undefined });
                      setAccountControlModal(null);
                    }}
                    type="button"
                  >
                    Suspend
                  </button>
                </>
              ) : null}
              {canManage && !isProtectedSuperadminAccount(accountControlModal) ? (
                <button
                  className={btnDanger}
                  onClick={() => {
                    setAccountControlModal(null);
                    setPendingAction({
                      title: "Delete Account",
                      message: `Delete ${accountControlModal.username} and linked records permanently?`,
                      confirmLabel: "Delete",
                      run: () => deleteUserAccount(accountControlModal._id),
                    });
                  }}
                  type="button"
                >
                  Delete Account
                </button>
              ) : null}
            </div>
            {accountControlModal.statusReason ? <p className="mt-4 text-xs text-slate-500">Latest review note: {accountControlModal.statusReason}</p> : null}
          </div>
        </div>
      ) : null}
      {reviewUserPrompt && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-md`}>
            <h3 className="text-lg font-bold text-slate-900">Review User Details</h3>
            <p className="mt-2 text-sm text-slate-600">Double-check the resident details, then choose approve or reject.</p>
            <div className="mt-6 flex gap-3">
              <button className={`${btnSecondary} flex-1 text-sm`} onClick={() => setReviewUserPrompt(null)} disabled={actionLoading} type="button">Cancel</button>
              <button
                className={`${btnDanger} flex-1 text-sm`}
                onClick={() => {
                  const target = reviewUserPrompt;
                  setReviewUserPrompt(null);
                  openUserReasonPrompt({ kind: "user-status", title: "Reject User", userId: target._id, username: target.username, nextStatus: "suspended", validIdStatus: "rejected" });
                }}
                disabled={actionLoading}
                type="button"
              >
                Reject
              </button>
              <button
                className={`${btnPrimary} flex-1 text-sm`}
                onClick={() => {
                  const target = reviewUserPrompt;
                  void updateUserStatusDirect(target, "active", "approved");
                }}
                disabled={actionLoading}
                type="button"
              >
                {actionLoading ? "Saving..." : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
      {userReasonPrompt && (
        <div className={modalOverlay}>
          <div className={`${modalCard} max-w-lg`}>
            <h3 className="text-lg font-bold text-slate-900">{userReasonPrompt.title}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {userReasonPrompt.kind === "child-status"
                ? `Select the reason for updating ${userReasonPrompt.childName}'s access request.`
                : `Select the reason for updating ${userReasonPrompt.username}'s account status.`}
            </p>
            <div className="mt-4 space-y-3">
              <LabeledField label="Reason">
                <select className={inputBase} value={userReasonChoice} onChange={(e) => setUserReasonChoice(e.target.value)}>
                  {reasonOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </LabeledField>
              {userReasonChoice === "Other" ? (
                <LabeledField label="Custom Reason">
                  <textarea className={inputBase} rows={3} value={userReasonCustom} onChange={(e) => setUserReasonCustom(e.target.value)} placeholder="Enter the reason that will be emailed to the resident." />
                </LabeledField>
              ) : null}
            </div>
            <div className="mt-6 flex gap-3">
              <button className={`${btnSecondary} flex-1 text-sm`} onClick={() => setUserReasonPrompt(null)} disabled={actionLoading} type="button">Cancel</button>
              <button className={`${btnPrimary} flex-1 text-sm`} onClick={() => { void confirmUserReasonPrompt(); }} disabled={actionLoading} type="button">Submit</button>
            </div>
          </div>
        </div>
      )}
      <SyncProgressOverlay state={syncOverlay} />
      <LogoutConfirmation isOpen={showLogoutDialog} isLoggingOut={isLoggingOut} onClose={() => setShowLogoutDialog(false)} onConfirm={confirmLogout} />
    </div>
  );
}
