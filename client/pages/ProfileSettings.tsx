import { useState, useEffect, useRef } from "react";
import { User, Info, Clock, X, Eye, EyeOff } from "lucide-react";
import { Chatbot } from "@/components/Chatbot";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { api, authHeaders } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Reveal } from "@/components/Reveal";
import { FeedbackModal } from "@/components/FeedbackModal";

type Activity = {
  _id: string;
  title: string;
  type: string;
  referenceNo?: string;
  createdAt: string;
};

type AddressDetails = {
  blk: string;
  lot: string;
  street: string;
  subdivision: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: string;
};

const DEFAULT_ADDRESS: AddressDetails = {
  blk: "",
  lot: "",
  street: "",
  subdivision: "",
  barangay: "Mambog II",
  city: "Bacoor",
  province: "Cavite",
  zipCode: "4102",
};

type ChildLink = {
  _id?: string;
  fullName: string;
  email: string;
  birthDate: string;
  relationship: string;
  status?: "pending" | "approved" | "rejected";
  reviewReason?: string;
};

type ActingChild = {
  id?: string;
  fullName?: string;
  email?: string;
};

type ChildSessionForm = {
  fullName: string;
  email: string;
};

export default function ProfileSettings() {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    gender: "prefer-not-to-say",
    civilStatus: "single",
    marriageContractImage: "",
    avatarImage: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [addressDetails, setAddressDetails] = useState<AddressDetails>(DEFAULT_ADDRESS);
  const [children, setChildren] = useState<ChildLink[]>([]);
  const [actingChild, setActingChild] = useState<ActingChild | null>(null);
  const [childSessionForm, setChildSessionForm] = useState<ChildSessionForm>({ fullName: "", email: "" });
  const [feedback, setFeedback] = useState<{ isOpen: boolean; title: string; message: string; type: "success" | "error" }>({
    isOpen: false,
    title: "",
    message: "",
    type: "success",
  });
  const [originalEmail, setOriginalEmail] = useState("");
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [showPasswordOtpModal, setShowPasswordOtpModal] = useState(false);
  const [passwordOtp, setPasswordOtp] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [childOtpModal, setChildOtpModal] = useState<{ isOpen: boolean; index: number | null; otp: string; sending: boolean; verifying: boolean }>({
    isOpen: false,
    index: null,
    otp: "",
    sending: false,
    verifying: false,
  });
  const [childSessionOtpModal, setChildSessionOtpModal] = useState<{ isOpen: boolean; otp: string; sending: boolean; verifying: boolean }>({
    isOpen: false,
    otp: "",
    sending: false,
    verifying: false,
  });

  const fetchProfile = async () => {
    try {
      const [userRes, activityRes] = await Promise.all([
        api.get("/api/auth/user", { headers: authHeaders() }),
        api.get("/api/admin/activity/me", { headers: authHeaders() }),
      ]);

      const user = userRes.data;
      setActingChild(user.actingChild || null);
      setChildSessionForm({
        fullName: user.actingChild?.fullName || "",
        email: user.actingChild?.email || "",
      });
      setFormData((prev) => ({
        ...prev,
        username: user.username || "",
        firstName: user.firstName || "",
        middleName: user.middleName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        contactNumber: user.contactNumber || "",
        gender: user.gender || "prefer-not-to-say",
        civilStatus: user.civilStatus || "single",
        marriageContractImage: user.marriageContractImage || "",
        avatarImage: user.avatarImage || "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      setOriginalEmail(user.email || "");

      setAddressDetails({
        ...DEFAULT_ADDRESS,
        ...(user.addressDetails || {}),
      });
      setChildren(Array.isArray(user.children) ? user.children : []);

      setActivities(Array.isArray(activityRes.data) ? activityRes.data : activityRes.data?.items || []);
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/");
      }
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddressDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleChildChange = (index: number, field: keyof ChildLink, value: string) => {
    setChildren((prev) => prev.map((child, childIndex) => (
      childIndex === index ? { ...child, [field]: value } : child
    )));
  };

  const addChildRow = () => {
    setChildren((prev) => [...prev, { fullName: "", email: "", birthDate: "", relationship: "Child" }]);
  };

  const removeChildRow = (index: number) => {
    setChildren((prev) => prev.filter((_, childIndex) => childIndex !== index));
  };

  const handleSendChildOtp = async (index: number) => {
    const child = children[index];
    if (!child?.fullName || !child?.email || !child?.birthDate) {
      setFeedback({ isOpen: true, title: "Incomplete Child Info", message: "Enter the child's full name, email, and birth date before sending OTP.", type: "error" });
      return;
    }

    setChildOtpModal({ isOpen: true, index, otp: "", sending: true, verifying: false });
    try {
      await api.post("/api/auth/child-access/request-otp", { child }, { headers: authHeaders() });
      setFeedback({ isOpen: true, title: "OTP Sent", message: "A child access OTP was sent to your registered email.", type: "success" });
      setChildOtpModal((prev) => ({ ...prev, sending: false }));
    } catch (err: any) {
      setChildOtpModal({ isOpen: false, index: null, otp: "", sending: false, verifying: false });
      setFeedback({ isOpen: true, title: "OTP Failed", message: err.response?.data?.msg || "Could not send child access OTP.", type: "error" });
    }
  };

  const handleVerifyChildOtp = async () => {
    if (childOtpModal.index === null) return;
    const child = children[childOtpModal.index];
    if (!child) return;
    if (!childOtpModal.otp || childOtpModal.otp.length < 6) {
      setFeedback({ isOpen: true, title: "OTP Required", message: "Enter the 6-digit OTP sent to your email.", type: "error" });
      return;
    }

    setChildOtpModal((prev) => ({ ...prev, verifying: true }));
    try {
      const res = await api.post("/api/auth/child-access/verify", { child, otp: childOtpModal.otp }, { headers: authHeaders() });
      setChildren(Array.isArray(res.data?.children) ? res.data.children : children);
      setChildOtpModal({ isOpen: false, index: null, otp: "", sending: false, verifying: false });
      setFeedback({ isOpen: true, title: "Child Request Submitted", message: "The child access request is now pending superadmin approval.", type: "success" });
    } catch (err: any) {
      setChildOtpModal((prev) => ({ ...prev, verifying: false }));
      setFeedback({ isOpen: true, title: "Verification Failed", message: err.response?.data?.msg || "Could not verify child access OTP.", type: "error" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword && formData.newPassword !== formData.confirmNewPassword) {
      setFeedback({ isOpen: true, title: "Password Mismatch", message: "New password and confirm password do not match.", type: "error" });
      return;
    }

    const isEmailChanged = false;
    const isPasswordChanged = Boolean(formData.newPassword);

    if (isEmailChanged && !emailOtp) {
      setOtpSending(true);
      try {
        await api.post(
          "/api/auth/change-email/request-otp",
          { newEmail: formData.email },
          { headers: authHeaders() },
        );
        setShowEmailOtpModal(true);
        setFeedback({ isOpen: true, title: "OTP Sent", message: "Check your new email for the OTP code to confirm the change.", type: "success" });
      } catch (err: any) {
        setFeedback({ isOpen: true, title: "OTP Failed", message: err.response?.data?.msg || "Could not send OTP to the new email.", type: "error" });
      } finally {
        setOtpSending(false);
      }
      return;
    }

    if (isPasswordChanged && !passwordOtp) {
      setOtpSending(true);
      try {
        await api.post("/api/auth/change-password/request-otp", {}, { headers: authHeaders() });
        setShowPasswordOtpModal(true);
        setFeedback({ isOpen: true, title: "OTP Sent", message: "Check your registered email for the password-change OTP.", type: "success" });
      } catch (err: any) {
        setFeedback({ isOpen: true, title: "OTP Failed", message: err.response?.data?.msg || "Could not send password OTP.", type: "error" });
      } finally {
        setOtpSending(false);
      }
      return;
    }

    setSaving(true);
    setSaveProgress(20);

    try {
      await api.put(
        "/api/auth/user",
        {
          username: formData.username,
          firstName: formData.firstName,
          middleName: formData.middleName,
          lastName: formData.lastName,
          contactNumber: formData.contactNumber,
          avatarImage: formData.avatarImage,
          gender: formData.gender,
          civilStatus: formData.civilStatus,
          marriageContractImage: formData.marriageContractImage,
          preferredContactMethod: "Email",
          addressDetails,
          children,
          ...(formData.newPassword ? { password: formData.newPassword, passwordOtp } : {}),
        },
        { headers: authHeaders() },
      );

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setEmailOtp("");
      setShowEmailOtpModal(false);
      setPasswordOtp("");
      setShowPasswordOtpModal(false);
      await fetchProfile();
    } catch (err: any) {
      setFeedback({ isOpen: true, title: "Update Failed", message: err.response?.data?.msg || "Failed to update profile", type: "error" });
    } finally {
      setSaveProgress(100);
      setTimeout(() => {
        setSaving(false);
        setSaveProgress(0);
      }, 280);
    }
  };

  useEffect(() => {
    if (!saving) return;
    const t = setInterval(() => setSaveProgress((p) => (p >= 90 ? p : p + 10)), 220);
    return () => clearInterval(t);
  }, [saving]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFeedback({ isOpen: true, title: "Image Too Large", message: "Profile image must be 2MB or below.", type: "error" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, avatarImage: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleMarriageContractUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFeedback({ isOpen: true, title: "Image Too Large", message: "Marriage contract must be 2MB or below.", type: "error" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, marriageContractImage: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleResendEmailOtp = async () => {
    setOtpSending(true);
    try {
      await api.post("/api/auth/change-email/request-otp", { newEmail: formData.email }, { headers: authHeaders() });
      setFeedback({ isOpen: true, title: "OTP Resent", message: "A new OTP was sent to your new email address.", type: "success" });
    } catch (err: any) {
      setFeedback({ isOpen: true, title: "OTP Failed", message: err.response?.data?.msg || "Could not resend OTP.", type: "error" });
    } finally {
      setOtpSending(false);
    }
  };

  const recentActivities = activities.slice(0, 3);
  const hiddenCount = Math.max(0, activities.length - 3);
  const isChildSession = Boolean(actingChild);

  const handleChildSessionRequestOtp = async () => {
    if (!childSessionForm.fullName.trim() || !childSessionForm.email.trim()) {
      setFeedback({ isOpen: true, title: "Incomplete Details", message: "Child name and email are required.", type: "error" });
      return;
    }
    setChildSessionOtpModal({ isOpen: true, otp: "", sending: true, verifying: false });
    try {
      await api.post("/api/auth/child-session/request-otp", childSessionForm, { headers: authHeaders() });
      setChildSessionOtpModal((prev) => ({ ...prev, sending: false }));
      setFeedback({ isOpen: true, title: "OTP Sent", message: "A verification OTP was sent to the parent email before updating the child profile.", type: "success" });
    } catch (err: any) {
      setChildSessionOtpModal({ isOpen: false, otp: "", sending: false, verifying: false });
      setFeedback({ isOpen: true, title: "OTP Failed", message: err.response?.data?.msg || "Could not send child session OTP.", type: "error" });
    }
  };

  const handleChildSessionUpdate = async () => {
    if (!childSessionOtpModal.otp || childSessionOtpModal.otp.length < 6) {
      setFeedback({ isOpen: true, title: "OTP Required", message: "Enter the 6-digit OTP sent to the parent email.", type: "error" });
      return;
    }
    setChildSessionOtpModal((prev) => ({ ...prev, verifying: true }));
    try {
      const res = await api.put("/api/auth/child-session/update", { ...childSessionForm, otp: childSessionOtpModal.otp }, { headers: authHeaders() });
      setActingChild(res.data?.actingChild || actingChild);
      setChildren(Array.isArray(res.data?.children) ? res.data.children : children);
      setChildSessionOtpModal({ isOpen: false, otp: "", sending: false, verifying: false });
      setFeedback({ isOpen: true, title: "Child Profile Updated", message: "The linked child profile was updated successfully.", type: "success" });
      await fetchProfile();
    } catch (err: any) {
      setChildSessionOtpModal((prev) => ({ ...prev, verifying: false }));
      setFeedback({ isOpen: true, title: "Update Failed", message: err.response?.data?.msg || "Could not update child profile.", type: "error" });
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#f1f5f9]">
      <Header />

      {showToast && (
        <div className="fixed right-4 top-24 z-50 animate-fade-in md:right-8">
          <div className="rounded-md border border-[#22c55e] bg-[#e6fce5] px-5 py-3 text-sm text-[#166534] shadow-md">
            <span className="font-bold">Success!</span> Profile updated successfully.
          </div>
        </div>
      )}

      <Reveal>
        <main className="flex-grow px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-10">
            <div className="mb-6">
              <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-[#395886]">
                <User size={22} strokeWidth={2.5} /> {isChildSession ? "Children's Account Profile Settings" : "Profile Settings"}
              </h1>

              <div className="mb-8 flex items-start gap-3 rounded-md border border-[#e2e8f0] bg-[#f4f7fb] p-4">
                <Info className="mt-0.5 shrink-0 text-gray-500" size={16} />
                <p className="text-[13px] leading-relaxed text-gray-600">
                  {isChildSession
                    ? `You are using the parent account under child access as ${actingChild?.fullName || actingChild?.email}. Parent personal information is locked in this mode.`
                    : "Account updates are reflected in admin and superadmin resident details."}
                </p>
              </div>

              {isChildSession ? (
                <div className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <h2 className="text-sm font-bold text-[#1e3a8a]">Child Session Details</h2>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Parent Account Name</label>
                          <div className="rounded-md border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-700">{[formData.firstName, formData.middleName, formData.lastName].filter(Boolean).join(" ")}</div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Parent Account Email</label>
                          <div className="rounded-md border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-700">{formData.email}</div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Child User Name</label>
                          <input
                            className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700"
                            value={childSessionForm.fullName}
                            onChange={(e) => setChildSessionForm((prev) => ({ ...prev, fullName: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Child User Email</label>
                          <input
                            type="email"
                            className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700"
                            value={childSessionForm.email}
                            onChange={(e) => setChildSessionForm((prev) => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={handleChildSessionRequestOtp} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Send Parent OTP
                        </button>
                        <p className="self-center text-xs text-slate-500">Only child name and child email can be updated in child-session mode.</p>
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
              <form ref={formRef} className="space-y-5" onSubmit={handleSubmit}>
                {saving && (
                  <div>
                    <p className="mb-1 text-xs text-gray-500">Saving changes... {saveProgress}%</p>
                    <div className="h-2 rounded bg-gray-200"><div className="h-2 rounded bg-[#395886] transition-all" style={{ width: `${saveProgress}%` }} /></div>
                  </div>
                )}

                <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h2 className="text-sm font-bold text-[#1e3a8a]">Personal Information</h2>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-800">Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <img
                        src={formData.avatarImage || "https://placehold.co/100x100/e2e8f0/475569?text=User"}
                        alt="Profile"
                        className="h-16 w-16 rounded-full border border-gray-200 object-cover"
                      />
                      <input ref={(el) => { avatarInputRef.current = el; }} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Choose Profile Photo
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Name Layout</p>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3 xl:grid-cols-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-800">First Name</label>
                        <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="firstName" value={formData.firstName} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-800">Middle Name</label>
                        <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="middleName" value={formData.middleName} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-800">Last Name</label>
                        <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="lastName" value={formData.lastName} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Account and Contact</p>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-800">Username</label>
                        <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="username" value={formData.username} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-800">Email</label>
                        <input className="w-full rounded-md border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-700" name="email" value={formData.email} readOnly />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-800">Contact Number</label>
                        <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-800">Preferred Updates</label>
                        <div className="rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-600">
                          System updates and notifications are sent to your registered email only.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Gender</label>
                      <select className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="gender" value={formData.gender} onChange={handleInputChange}>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Civil Status</label>
                      <select className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="civilStatus" value={formData.civilStatus} onChange={handleInputChange}>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="widowed">Widowed</option>
                        <option value="separated">Separated</option>
                      </select>
                    </div>
                  </div>

                  {formData.civilStatus === "married" && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-800">Marriage Contract (Optional)</label>
                      <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-6 text-center transition hover:bg-slate-50 md:max-w-md">
                        <input type="file" accept="image/*" onChange={handleMarriageContractUpload} className="hidden" />
                        <span className="text-sm font-semibold text-slate-700">{formData.marriageContractImage ? "Marriage contract uploaded" : "Upload marriage contract"}</span>
                        <span className="mt-1 text-xs text-slate-500">Optional supporting document for profile review.</span>
                      </label>
                      {formData.marriageContractImage && <img src={formData.marriageContractImage} alt="Marriage contract" className="h-24 w-full rounded-lg border border-slate-200 object-cover md:w-72" />}
                    </div>
                  )}
                </section>

                <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h2 className="text-sm font-bold text-[#1e3a8a]">Address</h2>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Street</label>
                      <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="street" value={addressDetails.street} onChange={handleAddressChange} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Comp/Subd (Optional)</label>
                      <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="subdivision" value={addressDetails.subdivision} onChange={handleAddressChange} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Barangay</label>
                      <input className="w-full rounded-md border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-700" name="barangay" value="Mambog II" readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">City</label>
                      <input className="w-full rounded-md border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-700" name="city" value="Bacoor" readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Province</label>
                      <input className="w-full rounded-md border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-700" name="province" value="Cavite" readOnly />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">ZIP Code</label>
                      <input className="w-full rounded-md border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-700" name="zipCode" value="4102" readOnly />
                    </div>
                  </div>
                </section>

                <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-bold text-[#1e3a8a]">Children Linked to Parent Account</h2>
                    <button type="button" onClick={addChildRow} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Add Child</button>
                  </div>
                  <p className="text-xs text-slate-500">Linked records must include full name, email, and a birth date showing 18 years old or above before they can be submitted for superadmin review.</p>
                  <div className="space-y-3">
                    {children.map((child, index) => (
                      <div key={index} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr,1.2fr,1fr,1fr,auto]">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Child Full Name</label>
                          <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" value={child.fullName} onChange={(e) => handleChildChange(index, "fullName", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Child Email</label>
                          <input type="email" className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" value={child.email || ""} onChange={(e) => handleChildChange(index, "email", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Birth Date</label>
                          <input type="date" className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" value={child.birthDate} onChange={(e) => handleChildChange(index, "birthDate", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Relationship</label>
                          <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" value={child.relationship} onChange={(e) => handleChildChange(index, "relationship", e.target.value)} />
                        </div>
                        <div className="flex flex-col items-stretch justify-end gap-2">
                          {child.status ? (
                            <div className={`rounded-md px-3 py-2 text-center text-[11px] font-semibold ${child.status === "approved" ? "bg-emerald-50 text-emerald-700" : child.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                              {child.status}
                            </div>
                          ) : null}
                          <button type="button" onClick={() => handleSendChildOtp(index)} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                            Send OTP
                          </button>
                          <button type="button" onClick={() => removeChildRow(index)} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Remove</button>
                        </div>
                      </div>
                    ))}
                    {children.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">No linked children yet.</div>}
                  </div>
                </section>

                <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h2 className="text-sm font-bold text-[#1e3a8a]">Password and Security</h2>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">New Password (Optional)</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          className="w-full rounded-md border border-gray-300 p-2.5 pr-10 text-sm text-gray-700"
                          name="newPassword"
                          placeholder="Input a password"
                          value={formData.newPassword}
                          onChange={handleInputChange}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Confirm New Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          className="w-full rounded-md border border-gray-300 p-2.5 pr-10 text-sm text-gray-700"
                          name="confirmNewPassword"
                          placeholder="Confirm your password"
                          value={formData.confirmNewPassword}
                          onChange={handleInputChange}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="pt-2">
                  <button disabled={saving} className="w-full rounded-md bg-[#395886] py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60" type="submit">
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
              )}
            </div>

            <hr className="my-8 border-gray-200" />

            <div id="activity-history" className="rounded-[24px] border border-gray-100 bg-white p-8 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[20px] font-bold text-[#1e3a8a]">
                  <Clock size={24} /> My Activity
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-[12px] font-semibold text-[#1e3a8a]">Recent</div>
              </div>

              <div className="mb-4 w-full border-b border-gray-100" />

              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-gray-200 p-12 text-gray-400">
                  <Clock className="mb-4 opacity-20" size={48} />
                  <p className="text-[14px] italic">No recent account activity found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div key={activity._id} className="flex flex-col gap-3 rounded-[16px] border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#1e3a8a]">{activity.referenceNo || activity.type}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{activity.title}</p>
                      </div>
                      <span className="rounded border border-gray-100 bg-white px-2 py-1 text-[11px] font-medium text-slate-400">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {hiddenCount > 0 && (
                    <div className="relative rounded-[16px] border border-gray-200 bg-gray-100/80 p-4 blur-[1px]">
                      <p className="text-xs text-slate-500">+{hiddenCount} older activities hidden</p>
                    </div>
                  )}
                  {activities.length > 3 && (
                    <button
                      type="button"
                      className="w-full rounded-md border border-blue-200 bg-blue-50 py-2 text-sm font-semibold text-blue-700"
                      onClick={() => setShowAllActivities(true)}
                    >
                      Expand Activity History
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </Reveal>

      {showAllActivities && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Recent Activities</h3>
              <button type="button" onClick={() => setShowAllActivities(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity._id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{activity.title}</p>
                  <p className="text-xs text-slate-500">{activity.referenceNo || activity.type}</p>
                  <p className="text-xs text-slate-400">{new Date(activity.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showEmailOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Verify Email Change</h3>
              <button type="button" onClick={() => setShowEmailOtpModal(false)}><X size={18} /></button>
            </div>
            <p className="mb-3 text-sm text-slate-600">Enter the 6-digit OTP sent to <span className="font-semibold">{formData.email}</span>.</p>
            <input
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value)}
              maxLength={6}
              placeholder="123456"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-center tracking-[0.3em]"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={handleResendEmailOtp} disabled={otpSending} className="rounded-md border border-slate-300 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
                {otpSending ? "Sending..." : "Resend OTP"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!emailOtp || emailOtp.length < 6) {
                    setFeedback({ isOpen: true, title: "OTP Required", message: "Please enter the 6-digit OTP.", type: "error" });
                    return;
                  }
                  setShowEmailOtpModal(false);
                  formRef.current?.requestSubmit();
                }}
                className="rounded-md bg-slate-900 py-2 text-sm font-semibold text-white"
              >
                Verify & Save
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">After entering OTP, click Verify & Save to apply email change.</p>
          </div>
        </div>
      )}

      {childOtpModal.isOpen && childOtpModal.index !== null && children[childOtpModal.index] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Verify Child Access Request</h3>
              <button type="button" onClick={() => setChildOtpModal({ isOpen: false, index: null, otp: "", sending: false, verifying: false })}>
                <X size={18} />
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold">Parent Email:</span> {formData.email}</p>
              <p><span className="font-semibold">Child Full Name:</span> {children[childOtpModal.index].fullName}</p>
              <p><span className="font-semibold">Child Email:</span> {children[childOtpModal.index].email}</p>
              <p><span className="font-semibold">Birth Date:</span> {children[childOtpModal.index].birthDate}</p>
              <p><span className="font-semibold">Relationship:</span> {children[childOtpModal.index].relationship || "Child"}</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">An OTP was sent to the parent email. Enter it below to submit this child access request for superadmin approval.</p>
            <input
              value={childOtpModal.otp}
              onChange={(e) => setChildOtpModal((prev) => ({ ...prev, otp: e.target.value }))}
              maxLength={6}
              placeholder="123456"
              className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-center tracking-[0.3em]"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => childOtpModal.index !== null && handleSendChildOtp(childOtpModal.index)} disabled={childOtpModal.sending || childOtpModal.verifying} className="rounded-md border border-slate-300 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
                {childOtpModal.sending ? "Sending..." : "Resend OTP"}
              </button>
              <button type="button" onClick={handleVerifyChildOtp} disabled={childOtpModal.verifying} className="rounded-md bg-slate-900 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {childOtpModal.verifying ? "Verifying..." : "Verify & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {childSessionOtpModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Verify Child Profile Update</h3>
              <button type="button" onClick={() => setChildSessionOtpModal({ isOpen: false, otp: "", sending: false, verifying: false })}>
                <X size={18} />
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold">Parent Email:</span> {formData.email}</p>
              <p><span className="font-semibold">Updated Child Name:</span> {childSessionForm.fullName}</p>
              <p><span className="font-semibold">Updated Child Email:</span> {childSessionForm.email}</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">A parent verification OTP was sent before updating the child details.</p>
            <input
              value={childSessionOtpModal.otp}
              onChange={(e) => setChildSessionOtpModal((prev) => ({ ...prev, otp: e.target.value }))}
              maxLength={6}
              placeholder="123456"
              className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-center tracking-[0.3em]"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={handleChildSessionRequestOtp} disabled={childSessionOtpModal.sending || childSessionOtpModal.verifying} className="rounded-md border border-slate-300 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">
                {childSessionOtpModal.sending ? "Sending..." : "Resend OTP"}
              </button>
              <button type="button" onClick={handleChildSessionUpdate} disabled={childSessionOtpModal.verifying} className="rounded-md bg-slate-900 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {childSessionOtpModal.verifying ? "Updating..." : "Verify & Update"}
              </button>
            </div>
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
      {showPasswordOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Verify Password Change</h3>
              <button type="button" onClick={() => setShowPasswordOtpModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-600">Enter the 6-digit OTP sent to your registered email.</p>
            <input
              value={passwordOtp}
              onChange={(e) => setPasswordOtp(e.target.value)}
              maxLength={6}
              placeholder="123456"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-center tracking-[0.3em]"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  setOtpSending(true);
                  try {
                    await api.post("/api/auth/change-password/request-otp", {}, { headers: authHeaders() });
                    setFeedback({ isOpen: true, title: "OTP Resent", message: "A new OTP was sent to your registered email.", type: "success" });
                  } catch (err: any) {
                    setFeedback({ isOpen: true, title: "OTP Failed", message: err.response?.data?.msg || "Could not resend OTP.", type: "error" });
                  } finally {
                    setOtpSending(false);
                  }
                }}
                disabled={otpSending}
                className="rounded-md border border-slate-300 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                {otpSending ? "Sending..." : "Resend OTP"}
              </button>
              <button type="button" onClick={() => setShowPasswordOtpModal(false)} className="rounded-md bg-slate-900 py-2 text-sm font-semibold text-white">
                Close
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">After entering OTP, click Save Changes again to finalize password update.</p>
          </div>
        </div>
      )}
      <Chatbot />
      <Footer />
    </div>
  );
}
