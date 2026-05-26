import { useEffect, useMemo, useState } from 'react';
import { Shield, AlertCircle, Search, Upload, CheckCircle, ArrowRight, X } from 'lucide-react';
import { Chatbot } from "@/components/Chatbot";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { api, authHeaders } from '@/lib/api';
import { hasAuthSession } from '@/lib/auth';
import { FeedbackModal } from "@/components/FeedbackModal";
import { EmergencySafetyRouteCard } from "@/components/EmergencySafetyRouteCard";
import { AnnouncementDetailModal, type AnnouncementDetailItem } from "@/components/AnnouncementDetailModal";

type Announcement = AnnouncementDetailItem & {
  _id: string;
  title: string;
  category: string;
  content: string;
  source: string;
  image?: string;
  createdAt: string;
};

type RumorAttachment = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

const PHONE_PATTERN = /^09\d{9}$/;

export default function FactCheck() {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<Announcement[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [claim, setClaim] = useState('');
  const [source, setSource] = useState('');
  const [reporter, setReporter] = useState({ fullName: '', contactNumber: '', address: '' });
  const [attachments, setAttachments] = useState<RumorAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ isOpen: boolean; title: string; message: string; type: "success" | "error" }>({
    isOpen: false,
    title: "",
    message: "",
    type: "error",
  });

  const filters = ['All', 'True', 'False', 'Misleading'];

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/api/announcements', { params: { module: 'fact-check', limit: 100 } });
        setItems(res.data || []);
      } catch (err) {
        console.error('Failed to load fact checks', err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadReporter = async () => {
      if (!hasAuthSession()) return;

      try {
        const res = await api.get('/api/auth/user', { headers: authHeaders() });
        const user = res.data || {};
        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();
        setReporter((prev) => ({
          fullName: prev.fullName || fullName,
          contactNumber: prev.contactNumber || user.contactNumber || '',
          address: prev.address || user.address || '',
        }));
      } catch (_err) {
        // Visitors may still submit by filling out their contact details manually.
      }
    };

    loadReporter();
  }, []);

  const filteredData = useMemo(() => {
    return items.filter((item) => {
      const status = (item.category || '').toLowerCase();
      const matchesFilter = filter === 'All' || status === filter.toLowerCase();
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [filter, items, searchQuery]);

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ isOpen: true, title: 'Unsupported File', message: 'Please upload an image screenshot only.', type: 'error' });
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setFeedback({ isOpen: true, title: 'File Too Large', message: 'Please upload an image smaller than 3 MB.', type: 'error' });
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

    setAttachments([{ name: file.name, type: file.type, size: file.size, dataUrl }]);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim.trim() || !reporter.fullName.trim() || !reporter.contactNumber.trim() || !reporter.address.trim()) {
      setFeedback({ isOpen: true, title: 'Missing Details', message: 'Please complete your name, contact number, address, and the rumor details.', type: 'error' });
      return;
    }
    if (!PHONE_PATTERN.test(reporter.contactNumber.trim())) {
      setFeedback({ isOpen: true, title: 'Invalid Contact', message: 'Phone number must be 11 digits and start with 09.', type: 'error' });
      return;
    }
    if (claim.trim().length < 10) {
      setFeedback({ isOpen: true, title: 'More Details Needed', message: 'Please enter at least 10 characters for the rumor or claim.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const description = [
        `Rumor or claim: ${claim.trim()}`,
        `Where it was seen: ${source.trim() || 'Not provided'}`,
      ].join('\n\n');
      const res = await api.post('/api/reports', {
        fullName: reporter.fullName.trim(),
        contactNumber: reporter.contactNumber.trim(),
        address: reporter.address.trim(),
        category: 'Misinformation / Rumor',
        description,
        attachments,
      }, { headers: authHeaders() });
      setReferenceNumber(res.data.referenceNo);
      setIsReportModalOpen(false);
      setIsSuccessModalOpen(true);
      setClaim('');
      setSource('');
      setAttachments([]);
    } catch (err: any) {
      setFeedback({ isOpen: true, title: "Submit Failed", message: err.response?.data?.msg || "Failed to submit rumor report", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColors = (status: string) => {
    switch (status.toUpperCase()) {
      case 'FALSE': return 'bg-[#ffe4e6] text-[#e11d48]';
      case 'TRUE': return 'bg-[#dcfce7] text-[#16a34a]';
      case 'MISLEADING': return 'bg-[#ffedd5] text-[#d97706]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#eff2f9]">
      <Header />
      <main className="flex-grow container mx-auto px-4 md:px-6 py-10 max-w-7xl">
        <Reveal>
          <div className="bg-[#212b46] rounded-2xl p-10 md:p-14 text-center shadow-lg relative overflow-hidden mb-8">
            <div className="relative z-10 flex flex-col items-center">
              <Shield size={56} strokeWidth={1.5} className="text-[#eab308] mb-4" />
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">BayanTrack Fact Check</h1>
              <p className="text-[#94a3b8] text-base md:text-lg max-w-2xl mx-auto mb-8">Combatting misinformation in our community. We verify rumors so you stay informed with the truth.</p>
              <button onClick={() => setIsReportModalOpen(true)} className="bg-[#9f1239] hover:bg-[#881337] text-white font-medium py-3 px-8 rounded-full flex items-center gap-2 transition-colors shadow-lg">
                <AlertCircle size={20} /> Report a Rumor
              </button>
            </div>
          </div>

          <div className="bg-white rounded-full shadow-sm p-2 flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
            <div className="flex items-center w-full md:w-1/2 px-4 py-2">
              <Search className="text-gray-400 mr-3" size={20} />
              <input type="text" placeholder="Search Claims..." className="w-full outline-none text-gray-700 bg-transparent" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto px-2 pb-2 md:pb-0 no-scrollbar shrink-0">
              {filters.map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${filter === f ? 'bg-[#3b4b72] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="mb-8">
            <EmergencySafetyRouteCard compact />
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((item) => (
            <Reveal>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold uppercase tracking-wider ${getStatusColors(item.category || 'UNKNOWN')}`}>{item.category || 'UNKNOWN'}</span>
                    <span className="text-[11px] font-bold text-[#638ECB] uppercase tracking-wider">Fact Check</span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>

                <h2 className="text-lg font-bold text-gray-900 mb-4 leading-tight">{item.title}</h2>
                {item.image ? (
                  <div className="mb-4 overflow-hidden rounded-xl border border-[#e5e7eb] bg-slate-100">
                    <div className="aspect-[16/9] w-full">
                      <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                    </div>
                  </div>
                ) : null}
                <div className="bg-[#f0f4ff] rounded-2xl p-5 mb-5 border border-[#e0e7ff] relative">
                  <p className="text-[#3b4b72] text-[14.5px] font-medium leading-relaxed italic">"{item.content}"</p>
                </div>
                <div className="text-[14px] text-gray-700 leading-relaxed flex-1 mb-6"><span className="font-bold text-[#212b46]">Source: </span>{item.source}</div>
                <div className="mt-auto pt-4 border-t border-gray-50 flex justify-center"><button type="button" onClick={() => setSelectedAnnouncement(item)} className="text-[#638ECB] font-semibold text-sm flex items-center gap-1.5 hover:text-[#3b4b72] transition-colors">Read Full Details <ArrowRight size={14} /></button></div>
              </div>
            </Reveal>
          ))}
        </div>

        {filteredData.length === 0 && <div className="text-center py-20 text-gray-500 bg-white rounded-xl shadow-sm">No fact checks found matching your criteria.</div>}
      </main>

      <Footer />
      <AnnouncementDetailModal item={selectedAnnouncement} onClose={() => setSelectedAnnouncement(null)} />

      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1e293b]/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[24px] w-full max-w-[560px] max-h-[92vh] shadow-2xl overflow-y-auto flex flex-col">
            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#3b4b72]">Report Misinformation</h2>
                  <p className="mt-1 text-sm text-slate-500">Send a rumor, claim, or screenshot to the barangay team for review.</p>
                </div>
                <button type="button" onClick={() => setIsReportModalOpen(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close rumor report">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleReportSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                    <input required type="text" value={reporter.fullName} onChange={(e) => setReporter((p) => ({ ...p, fullName: e.target.value }))} placeholder="Your full name" className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#638ECB] text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Contact Number</label>
                    <input required type="tel" inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} value={reporter.contactNumber} onChange={(e) => setReporter((p) => ({ ...p, contactNumber: e.target.value.replace(/\D/g, "").slice(0, 11) }))} placeholder="09..." className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#638ECB] text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Address</label>
                  <input required type="text" value={reporter.address} onChange={(e) => setReporter((p) => ({ ...p, address: e.target.value }))} placeholder="House / street / subdivision" className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#638ECB] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Rumor / Claim</label>
                  <textarea required rows={4} value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="What did you hear or see?" className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#638ECB] resize-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Where did you see this?</label>
                  <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Facebook, Group chat, etc.." className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#638ECB] text-sm" />
                </div>
                <label className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload className="text-gray-400 mb-2" size={28} />
                  <span className="text-sm text-gray-500 font-medium">Upload Screenshot (optional)</span>
                  <span className="mt-1 text-xs text-gray-400">Image only, up to 3 MB</span>
                  <input type="file" accept="image/*" className="sr-only" onChange={handleAttachmentUpload} />
                </label>
                {attachments.length > 0 ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-blue-900">{attachments[0].name}</span>
                    <button type="button" onClick={() => setAttachments([])} className="rounded-full p-1 text-blue-500 hover:bg-white hover:text-blue-900" aria-label="Remove uploaded screenshot">
                      <X size={16} />
                    </button>
                  </div>
                ) : null}
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsReportModalOpen(false)} className="flex-1 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-gray-700 font-bold py-3.5 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="flex-1 bg-[#9f1239] hover:bg-[#881337] text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-70">{isSubmitting ? 'Submitting...' : 'Submit Report'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1e293b]/90 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[24px] w-full max-w-[400px] shadow-2xl overflow-hidden p-8 text-center flex flex-col items-center">
            <div className="w-20 h-20 bg-[#dcfce7] rounded-full flex items-center justify-center mb-6 text-[#16a34a]"><CheckCircle size={40} strokeWidth={2.5} /></div>
            <h2 className="text-2xl font-black text-[#3b4b72] mb-3">Report Received</h2>
            <p className="text-gray-600 text-[15px] leading-relaxed mb-8">Thank you for helping us fight misinformation. We will verify this claim shortly.</p>
            <div className="bg-[#e0e7ff] w-full rounded-xl p-5 mb-8"><p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">REFERENCE NUMBER</p><p className="text-[#3b4b72] text-lg font-bold tracking-wide">{referenceNumber}</p></div>
            <button onClick={() => setIsSuccessModalOpen(false)} className="w-full bg-[#3b4b72] hover:bg-[#2d3a5c] text-white font-bold py-4 rounded-xl transition-colors text-lg shadow-md">Close</button>
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
      <Chatbot />
    </div>
  );
}
