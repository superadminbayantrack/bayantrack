import { useEffect, useState } from 'react';
import { Clock, MapPin, Send, CheckCircle } from 'lucide-react';
import { Chatbot } from "@/components/Chatbot";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal } from "@/components/Reveal";
import { api, authHeaders } from '@/lib/api';
import { FeedbackModal } from "@/components/FeedbackModal";

const SuccessModal = ({ referenceNo, onClose }: { referenceNo: string; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
        <CheckCircle size={32} />
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Message Sent</h2>
      <p className="mt-2 text-sm text-slate-600">Your message was stored in the database.</p>
      <div className="mt-4 rounded-lg bg-slate-100 p-3 font-mono text-sm font-bold text-slate-900">{referenceNo}</div>
      <button className="mt-5 w-full rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white" onClick={onClose} type="button">Close</button>
    </div>
  </div>
);

type Department = {
  _id: string;
  name: string;
  contactPerson: string;
  localNumber: string;
};

export default function Contact() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [siteContent, setSiteContent] = useState<{ contactOfficeHours: string; contactLocationText: string }>({
    contactOfficeHours: 'Monday - Friday, 8:00 AM - 5:00 PM',
    contactLocationText: 'Barangay Mambog II Hall, Bacoor City, Cavite',
  });
  const [form, setForm] = useState({ name: '', contact: '', department: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ isOpen: boolean; title: string; message: string; type: "success" | "error" }>({
    isOpen: false,
    title: "",
    message: "",
    type: "error",
  });

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const [deptRes, contentRes] = await Promise.all([
          api.get('/api/contact/departments'),
          api.get('/api/content/site'),
        ]);
        setDepartments(deptRes.data || []);
        if ((deptRes.data || []).length > 0) {
          setForm((prev) => ({ ...prev, department: deptRes.data[0].name }));
        }
        if (contentRes?.data) {
          setSiteContent((prev) => ({
            ...prev,
            contactOfficeHours: contentRes.data.contactOfficeHours || prev.contactOfficeHours,
            contactLocationText: contentRes.data.contactLocationText || prev.contactLocationText,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch departments', err);
      }
    };

    fetchDepartments();
  }, []);

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required.';
    if (!form.contact.trim()) nextErrors.contact = 'Contact is required.';
    if (!form.department.trim()) nextErrors.department = 'Department is required.';
    if (!form.message.trim()) nextErrors.message = 'Message is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSendProgress(20);
    try {
      const res = await api.post('/api/contact/messages', form, { headers: authHeaders() });
      setSuccessRef(res.data.referenceNo);
      setForm((prev) => ({ ...prev, name: '', contact: '', message: '' }));
      setErrors({});
    } catch (err: any) {
      setFeedback({ isOpen: true, title: "Send Failed", message: err.response?.data?.msg || "Failed to send message", type: "error" });
    } finally {
      setSendProgress(100);
      setTimeout(() => { setLoading(false); setSendProgress(0); }, 250);
    }
  };

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => setSendProgress((p) => (p >= 90 ? p : p + 10)), 220);
    return () => clearInterval(timer);
  }, [loading]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="flex-grow">
        <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-12">
          {successRef && <SuccessModal referenceNo={successRef} onClose={() => setSuccessRef(null)} />}

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <div className="space-y-10 lg:col-span-2">
              <Reveal>
                <div>
                  <h1 className="text-3xl font-bold text-[#395886]">Contact Us</h1>
                  <p className="mt-3 text-slate-600">Send us a message and reach departments with real MongoDB-backed records.</p>
                </div>
              </Reveal>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <Clock className="mb-4 text-[#395886]" size={30} />
                  <h3 className="font-bold text-slate-900">Office Hours</h3>
                  <p className="mt-1 text-sm text-slate-600">{siteContent.contactOfficeHours}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <MapPin className="mb-4 text-[#395886]" size={30} />
                  <h3 className="font-bold text-slate-900">Location</h3>
                  <p className="mt-1 text-sm text-slate-600">{siteContent.contactLocationText}</p>
                </div>
              </div>

              <div>
                <h2 className="mb-5 text-2xl font-bold text-[#395886]">Department Directory</h2>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-[640px] w-full text-left text-sm">
                    <thead className="border-b bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-4">Department</th>
                        <th className="p-4">Contact Person</th>
                        <th className="p-4">Local No.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {departments.map((dept) => (
                        <tr key={dept._id}>
                          <td className="p-4">{dept.name}</td>
                          <td className="p-4">{dept.contactPerson}</td>
                          <td className="p-4">{dept.localNumber}</td>
                        </tr>
                      ))}
                      {departments.length === 0 && (
                        <tr>
                          <td className="p-4 text-slate-500" colSpan={3}>No departments found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div>
              <div className="sticky top-20 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <h2 className="mb-6 text-xl font-bold text-[#395886]">Send us a Message</h2>
                {loading && <div className="mb-4"><p className="mb-1 text-xs text-slate-500">Sending... {sendProgress}%</p><div className="h-2 rounded bg-slate-200"><div className="h-2 rounded bg-blue-600 transition-all" style={{ width: `${sendProgress}%` }} /></div></div>}
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">Your Name</label>
                    <input className="w-full rounded-lg border px-3 py-2" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                    {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">Email / Phone</label>
                    <input className="w-full rounded-lg border px-3 py-2" value={form.contact} onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))} />
                    {errors.contact && <p className="mt-1 text-xs text-red-600">{errors.contact}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">Department</label>
                    <select className="w-full rounded-lg border px-3 py-2" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}>
                      {departments.map((dept) => (
                        <option key={dept._id} value={dept.name}>{dept.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">Message</label>
                    <textarea className="w-full rounded-lg border px-3 py-2" rows={4} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} />
                    {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message}</p>}
                  </div>
                  <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#395886] py-3 text-sm font-semibold text-white disabled:opacity-70">
                    <Send size={16} /> {loading ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
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
