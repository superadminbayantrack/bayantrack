import { useState, useEffect, useMemo, useRef } from "react";
import { User, Info, Clock, X, Eye, EyeOff, MoreHorizontal, Send, Trash2, Search, Filter } from "lucide-react";
import { Chatbot } from "@/components/Chatbot";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { api, authHeaders, quietApi } from "@/lib/api";
import { setAuthSession } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Reveal } from "@/components/Reveal";
import { FeedbackModal } from "@/components/FeedbackModal";
import { MAMBOG_II_SUBDIVISIONS } from "@/lib/mambogSubdivisions";
import { cleanPersonNameInput, isValidPersonName, personNameMessage } from "@/lib/validation";

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
const ACTIVITY_PAGE_SIZE = 5;

type ChildLink = {
  _id?: string;
  fullName: string;
  email: string;
  birthDate: string;
  relationship: string;
  avatarImage?: string;
  status?: "pending" | "approved" | "rejected";
  reviewReason?: string;
};

type ActingChild = {
  id?: string;
  fullName?: string;
  email?: string;
  avatarImage?: string;
};

type ChildSessionForm = {
  fullName: string;
  email: string;
  avatarImage: string;
};

const RELATIONSHIP_OPTIONS = ["Child", "Son", "Daughter", "Stepchild", "Ward", "Dependent"];
const RESIDENT_FAQS = [
  {
    question: "How do I add a linked child?",
    answer: "Go to Profile Settings, add the child's name, email, birth date, and relationship, then verify it with the OTP sent to the parent email.",
  },
  {
    question: "How do I update my child's profile?",
    answer: "Use Child Session mode. BayanTrack will send an OTP to the parent email before saving the child name, email, and photo.",
  },
  {
    question: "How do I use the chatbot?",
    answer: "Open the chatbot for quick help, barangay guidance, service shortcuts, and emergency support guidance.",
  },
  {
    question: "How do I report an issue?",
    answer: "Use Report Issue to submit concerns, add details, and attach photos if needed so the barangay can review them.",
  },
  {
    question: "What if I do not receive an OTP?",
    answer: "Check spam or promotions first, confirm your email is correct, then resend the OTP or contact support if mail is still unavailable.",
  },
];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const digitOnly = (value: string, max = 11) => value.replace(/\D/g, "").slice(0, max);
const cleanAddressValue = (value: string) => value.replace(/\s+/g, " ").trim();
const stripAddressPrefix = (value: string, prefix: "blk" | "lot") => (
  cleanAddressValue(value).replace(new RegExp(`^${prefix}\\.?\\s*`, "i"), "")
);
const appendDevOtp = (message: string, _debugOtp?: string) => message;
const getChildInitials = (value?: string) => {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CH";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};
const getAgeFromBirthDate = (birthDate: string) => {
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
};
const composeResidentAddress = (details: AddressDetails) => {
  const block = stripAddressPrefix(details.blk, "blk");
  const lot = stripAddressPrefix(details.lot, "lot");
  return [
    block ? `Blk ${block}` : "",
    lot ? `Lot ${lot}` : "",
    cleanAddressValue(details.street),
    cleanAddressValue(details.subdivision),
    "Mambog II",
    "Bacoor",
    "Cavite",
    "4102",
  ].filter(Boolean).join(", ");
};

function activityStatusLabel(activity: Activity) {
  const type = activity.type ? activity.type.replace(/[-_]/g, " ") : "activity";
  return type.replace(/\b\w/g, (char) => char.toUpperCase());
}

function childStatusDotClass(status?: ChildLink["status"]) {
  if (status === "approved") return "bg-emerald-500 ring-emerald-100";
  if (status === "rejected") return "bg-red-500 ring-red-100";
  return "bg-amber-500 ring-amber-100";
}

export default function ProfileSettings() {
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [activitySearch, setActivitySearch] = useState("");
  const [activityDateFilter, setActivityDateFilter] = useState("");
  const [activityTimeFilter, setActivityTimeFilter] = useState("");
  const [activityPage, setActivityPage] = useState(1);
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
  const [childSessionForm, setChildSessionForm] = useState<ChildSessionForm>({ fullName: "", email: "", avatarImage: "" });
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
  const [childActionModal, setChildActionModal] = useState<{ index: number } | null>(null);
  const [childRequestProgress, setChildRequestProgress] = useState(0);
  const [childSessionOtpModal, setChildSessionOtpModal] = useState<{ isOpen: boolean; otp: string; sending: boolean; verifying: boolean }>({
    isOpen: false,
    otp: "",
    sending: false,
    verifying: false,
  });

  const fetchProfile = async () => {
    try {
      const [userResult, activityResult] = await Promise.allSettled([
        quietApi.get("/api/auth/user"),
        quietApi.get("/api/admin/activity/me", { headers: authHeaders() }),
      ]);

      if (userResult.status !== "fulfilled") {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        const retryUserResult = await quietApi.get("/api/auth/user").catch((err) => ({ error: err }));
        if ("error" in retryUserResult) {
          setFeedback({
            isOpen: true,
            title: "Session Refreshing",
            message: "We could not refresh your profile yet. Please wait a moment, then reload Profile Settings.",
            type: "error",
          });
          return;
        }
        const user = retryUserResult.data;
        setActingChild(user.actingChild || null);
        setChildSessionForm({
          fullName: user.actingChild?.fullName || "",
          email: user.actingChild?.email || "",
          avatarImage: user.actingChild?.avatarImage || "",
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
        setActivities([]);
        return;
      }

      const user = userResult.value.data;
      setActingChild(user.actingChild || null);
      setChildSessionForm({
        fullName: user.actingChild?.fullName || "",
        email: user.actingChild?.email || "",
        avatarImage: user.actingChild?.avatarImage || "",
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

      if (activityResult.status === "fulfilled") {
        setActivities(Array.isArray(activityResult.value.data) ? activityResult.value.data : activityResult.value.data?.items || []);
      } else {
        setActivities([]);
      }
    } catch (err) {
      console.error("Failed to load profile settings:", err);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (["firstName", "middleName", "lastName"].includes(name)) {
      setFormData((prev) => ({ ...prev, [name]: cleanPersonNameInput(value, 80) }));
      return;
    }
    if (name === "contactNumber") {
      setFormData((prev) => ({ ...prev, contactNumber: digitOnly(value) }));
      return;
    }
    if (name === "civilStatus") {
      setFormData((prev) => ({
        ...prev,
        civilStatus: value,
        marriageContractImage: value === "married" ? prev.marriageContractImage : "",
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nextValue = ["blk", "lot", "street", "subdivision"].includes(name)
      ? value.replace(/\s{2,}/g, " ")
      : value;
    setAddressDetails((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleChildChange = (index: number, field: keyof ChildLink, value: string) => {
    const nextValue = field === "email"
      ? value.trim().toLowerCase()
      : field === "fullName"
        ? cleanPersonNameInput(value)
        : value;
    setChildren((prev) => prev.map((child, childIndex) => (
      childIndex === index ? { ...child, [field]: nextValue } : child
    )));
  };

  const addChildRow = () => {
    setChildren((prev) => [...prev, { fullName: "", email: "", birthDate: "", relationship: "Child" }]);
  };

  const removeChildRow = (index: number) => {
    setChildActionModal(null);
    setChildren((prev) => prev.filter((_, childIndex) => childIndex !== index));
  };

  const handleSendChildOtp = async (index: number) => {
    const child = children[index];
    if (!child?.fullName || !child?.email || !child?.birthDate) {
      setFeedback({ isOpen: true, title: "Incomplete Child Info", message: "Enter the child's full name, email, and birth date before sending OTP.", type: "error" });
      return;
    }
    if (!isValidPersonName(child.fullName)) {
      setFeedback({ isOpen: true, title: "Invalid Child Name", message: personNameMessage("Child full name"), type: "error" });
      return;
    }
    if (!emailPattern.test(child.email.trim().toLowerCase())) {
      setFeedback({ isOpen: true, title: "Invalid Child Email", message: "Enter a valid email for the linked child before sending OTP.", type: "error" });
      return;
    }
    const age = getAgeFromBirthDate(child.birthDate);
    if (age === null || age < 18) {
      setFeedback({ isOpen: true, title: "Child Access Requirement", message: "Linked child access records must be for children who are 18 years old or above.", type: "error" });
      return;
    }

    setChildActionModal(null);
    setChildRequestProgress(18);
    setChildOtpModal({ isOpen: true, index, otp: "", sending: true, verifying: false });
    try {
      setChildRequestProgress(34);
      const res = await api.post("/api/auth/child-access/request-otp", { child }, { headers: authHeaders() });
      setChildRequestProgress(52);
      setFeedback({ isOpen: true, title: "OTP Sent", message: appendDevOtp("A child access OTP was sent to your registered email.", res.data?.debugOtp), type: "success" });
      setChildOtpModal((prev) => ({ ...prev, sending: false }));
    } catch (err: any) {
      setChildRequestProgress(0);
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
      setChildRequestProgress(72);
      const res = await api.post("/api/auth/child-access/verify", { child, otp: childOtpModal.otp }, { headers: authHeaders() });
      setChildren(Array.isArray(res.data?.children) ? res.data.children : children);
      setChildOtpModal({ isOpen: false, index: null, otp: "", sending: false, verifying: false });
      setChildRequestProgress(100);
      setFeedback({ isOpen: true, title: "Child Request Submitted", message: "The child access request is now waiting for barangay approval.", type: "success" });
      window.setTimeout(() => setChildRequestProgress(0), 600);
    } catch (err: any) {
      setChildRequestProgress(52);
      setChildOtpModal((prev) => ({ ...prev, verifying: false }));
      setFeedback({ isOpen: true, title: "Verification Failed", message: err.response?.data?.msg || "Could not verify child access OTP.", type: "error" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPersonName(formData.firstName)) {
      setFeedback({ isOpen: true, title: "Invalid Name", message: personNameMessage("First name"), type: "error" });
      return;
    }
    if (!isValidPersonName(formData.middleName, { required: false })) {
      setFeedback({ isOpen: true, title: "Invalid Name", message: personNameMessage("Middle name"), type: "error" });
      return;
    }
    if (!isValidPersonName(formData.lastName)) {
      setFeedback({ isOpen: true, title: "Invalid Name", message: personNameMessage("Last name"), type: "error" });
      return;
    }
    const invalidChild = children.find((child) => child.fullName && !isValidPersonName(child.fullName));
    if (invalidChild) {
      setFeedback({ isOpen: true, title: "Invalid Child Name", message: personNameMessage("Child full name"), type: "error" });
      return;
    }
    if (!/^09\d{9}$/.test(formData.contactNumber)) {
      setFeedback({ isOpen: true, title: "Invalid Contact", message: "Phone number must be 11 digits and start with 09.", type: "error" });
      return;
    }
    const normalizedEmail = formData.email.trim().toLowerCase();

    if (!emailPattern.test(normalizedEmail)) {
      setFeedback({ isOpen: true, title: "Invalid Email", message: "Please keep a valid registered email address.", type: "error" });
      return;
    }
    if (!addressDetails.street.trim() || !addressDetails.subdivision.trim()) {
      setFeedback({ isOpen: true, title: "Address Required", message: "Please complete your Mambog II street and subdivision/compound/purok.", type: "error" });
      return;
    }
    if (formData.civilStatus === "married" && !formData.marriageContractImage) {
      setFeedback({ isOpen: true, title: "Marriage Contract Required", message: "Please upload your marriage contract when civil status is set to married.", type: "error" });
      return;
    }
    if (formData.newPassword && formData.newPassword !== formData.confirmNewPassword) {
      setFeedback({ isOpen: true, title: "Password Mismatch", message: "New password and confirm password do not match.", type: "error" });
      return;
    }

    const isEmailChanged = normalizedEmail !== (originalEmail || "").trim().toLowerCase();
    const isPasswordChanged = Boolean(formData.newPassword);

    if (isEmailChanged && !emailOtp) {
      setOtpSending(true);
      try {
        const res = await api.post(
          "/api/auth/change-email/request-otp",
          { newEmail: normalizedEmail },
          { headers: authHeaders() },
        );
        setShowEmailOtpModal(true);
        setFeedback({ isOpen: true, title: "OTP Sent", message: appendDevOtp("Check your new email for the OTP code to confirm the change.", res.data?.debugOtp), type: "success" });
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
        const res = await api.post("/api/auth/change-password/request-otp", {}, { headers: authHeaders() });
        setShowPasswordOtpModal(true);
        setFeedback({ isOpen: true, title: "OTP Sent", message: appendDevOtp("Check your registered email for the password-change OTP.", res.data?.debugOtp), type: "success" });
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
          ...(isEmailChanged ? { email: normalizedEmail, emailOtp } : {}),
          contactNumber: formData.contactNumber,
          avatarImage: formData.avatarImage,
          gender: formData.gender,
          civilStatus: formData.civilStatus,
          marriageContractImage: formData.marriageContractImage,
          preferredContactMethod: "Email",
          addressDetails: {
            ...addressDetails,
            blk: stripAddressPrefix(addressDetails.blk, "blk"),
            lot: stripAddressPrefix(addressDetails.lot, "lot"),
            street: cleanAddressValue(addressDetails.street),
            subdivision: cleanAddressValue(addressDetails.subdivision),
            barangay: "Mambog II",
            city: "Bacoor",
            province: "Cavite",
            zipCode: "4102",
          },
          address: composeResidentAddress(addressDetails),
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
      window.dispatchEvent(new Event("bayantrack:user-updated"));
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

  const handleChildSessionAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setFeedback({ isOpen: true, title: "Image Too Large", message: "Child profile image must be 2MB or below.", type: "error" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setChildSessionForm((prev) => ({ ...prev, avatarImage: String(reader.result || "") }));
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
      const res = await api.post("/api/auth/change-email/request-otp", { newEmail: formData.email }, { headers: authHeaders() });
      setFeedback({ isOpen: true, title: "OTP Resent", message: appendDevOtp("A new OTP was sent to your new email address.", res.data?.debugOtp), type: "success" });
    } catch (err: any) {
      setFeedback({ isOpen: true, title: "OTP Failed", message: err.response?.data?.msg || "Could not resend OTP.", type: "error" });
    } finally {
      setOtpSending(false);
    }
  };

  const previewActivities = activities.slice(0, 3);
  const visiblePreviewActivities = previewActivities.slice(0, 1);
  const blurredPreviewActivities = previewActivities.slice(1);
  const additionalHiddenCount = Math.max(0, activities.length - previewActivities.length);
  const filteredActivities = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    return activities.filter((activity) => {
      const date = new Date(activity.createdAt);
      const localDate = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-CA");
      const localTime = Number.isNaN(date.getTime()) ? "" : date.toTimeString().slice(0, 5);
      const matchesSearch = !query || [
        activity.title,
        activity.referenceNo,
        activity.type,
        activityStatusLabel(activity),
      ].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesDate = !activityDateFilter || localDate === activityDateFilter;
      const matchesTime = !activityTimeFilter || localTime === activityTimeFilter;
      return matchesSearch && matchesDate && matchesTime;
    });
  }, [activities, activityDateFilter, activitySearch, activityTimeFilter]);
  const activityTotalPages = Math.max(1, Math.ceil(filteredActivities.length / ACTIVITY_PAGE_SIZE));
  const currentActivityPage = Math.min(activityPage, activityTotalPages);
  const paginatedActivities = filteredActivities.slice(
    (currentActivityPage - 1) * ACTIVITY_PAGE_SIZE,
    currentActivityPage * ACTIVITY_PAGE_SIZE,
  );
  const isChildSession = Boolean(actingChild);

  useEffect(() => {
    setActivityPage(1);
  }, [activityDateFilter, activitySearch, activityTimeFilter]);

  const handleChildSessionRequestOtp = async () => {
    if (!childSessionForm.fullName.trim() || !childSessionForm.email.trim()) {
      setFeedback({ isOpen: true, title: "Incomplete Details", message: "Child name and email are required.", type: "error" });
      return;
    }
    if (!isValidPersonName(childSessionForm.fullName)) {
      setFeedback({ isOpen: true, title: "Invalid Child Name", message: personNameMessage("Child name"), type: "error" });
      return;
    }
    const normalizedChildEmail = childSessionForm.email.trim().toLowerCase();
    if (!emailPattern.test(normalizedChildEmail)) {
      setFeedback({ isOpen: true, title: "Invalid Child Email", message: "Enter a valid child email address before requesting OTP.", type: "error" });
      return;
    }
    setChildSessionOtpModal({ isOpen: true, otp: "", sending: true, verifying: false });
    try {
      const res = await api.post("/api/auth/child-session/request-otp", { ...childSessionForm, email: normalizedChildEmail }, { headers: authHeaders() });
      setChildSessionOtpModal((prev) => ({ ...prev, sending: false }));
      setFeedback({ isOpen: true, title: "OTP Sent", message: appendDevOtp("A verification OTP was sent to the parent email before updating the child profile.", res.data?.debugOtp), type: "success" });
    } catch (err: any) {
      setChildSessionOtpModal({ isOpen: false, otp: "", sending: false, verifying: false });
      setFeedback({ isOpen: true, title: "OTP Failed", message: err.response?.data?.msg || "Could not send child session OTP.", type: "error" });
    }
  };

  const handleChildSessionUpdate = async () => {
    if (!isValidPersonName(childSessionForm.fullName)) {
      setFeedback({ isOpen: true, title: "Invalid Child Name", message: personNameMessage("Child name"), type: "error" });
      return;
    }
    const normalizedChildEmail = childSessionForm.email.trim().toLowerCase();
    if (!emailPattern.test(normalizedChildEmail)) {
      setFeedback({ isOpen: true, title: "Invalid Child Email", message: "Enter a valid child email address before saving.", type: "error" });
      return;
    }
    if (!childSessionOtpModal.otp || childSessionOtpModal.otp.length < 6) {
      setFeedback({ isOpen: true, title: "OTP Required", message: "Enter the 6-digit OTP sent to the parent email.", type: "error" });
      return;
    }
    setChildSessionOtpModal((prev) => ({ ...prev, verifying: true }));
    try {
      const res = await api.put("/api/auth/child-session/update", { ...childSessionForm, email: normalizedChildEmail, otp: childSessionOtpModal.otp }, { headers: authHeaders() });
      setActingChild(res.data?.actingChild || actingChild);
      setChildren(Array.isArray(res.data?.children) ? res.data.children : children);
      setAuthSession(undefined, "resident", {
        actingChild: res.data?.actingChild
          ? {
              id: res.data.actingChild.id,
              fullName: res.data.actingChild.fullName,
              email: res.data.actingChild.email,
            }
          : null,
      });
      setChildSessionOtpModal({ isOpen: false, otp: "", sending: false, verifying: false });
      setFeedback({ isOpen: true, title: "Child Profile Updated", message: "The linked child profile was updated successfully.", type: "success" });
      await fetchProfile();
      window.dispatchEvent(new Event("bayantrack:user-updated"));
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
                    : "Account updates are reflected in the barangay staff review dashboard."}
                </p>
              </div>

              <section className="mb-8 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#1e3a8a]">Resident Help</h2>
                    <p className="mt-1 text-xs text-slate-500">Quick guidance for linked children, chatbot use, reports, and OTP requests.</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {RESIDENT_FAQS.map((item) => (
                    <details key={item.question} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">
                        {item.question}
                      </summary>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>

              {isChildSession ? (
                <div className="space-y-5">
                  <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <h2 className="text-sm font-bold text-[#1e3a8a]">Child Session Details</h2>
                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="mb-5 flex flex-wrap items-center gap-4">
                        <img
                          src={childSessionForm.avatarImage || "https://placehold.co/100x100/e2e8f0/475569?text=Child"}
                          alt="Child profile"
                          className="h-16 w-16 rounded-full border border-gray-200 object-cover"
                        />
                        <input ref={(el) => { avatarInputRef.current = el; }} type="file" accept="image/*" onChange={handleChildSessionAvatarUpload} className="hidden" />
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Choose Child Photo
                        </button>
                        <p className="text-xs text-slate-500">This will send an OTP to the parent email before saving the child profile.</p>
                      </div>
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
                            onChange={(e) => setChildSessionForm((prev) => ({ ...prev, fullName: cleanPersonNameInput(e.target.value) }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-gray-800">Child User Email</label>
                          <input
                            type="email"
                            className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700"
                            value={childSessionForm.email}
                            onChange={(e) => setChildSessionForm((prev) => ({ ...prev, email: e.target.value.trim().toLowerCase() }))}
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={handleChildSessionRequestOtp} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Send Parent OTP
                        </button>
                        <p className="self-center text-xs text-slate-500">Child name, email, and profile photo can be updated in child-session mode.</p>
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
                        <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" type="email" autoComplete="email" name="email" value={formData.email} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-gray-800">Contact Number</label>
                        <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" type="tel" inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} autoComplete="tel" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} />
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
                      <label className="block text-xs font-bold text-gray-800">Marriage Contract</label>
                      <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white px-4 py-6 text-center transition hover:bg-slate-50 md:max-w-md">
                        <input type="file" accept="image/*" onChange={handleMarriageContractUpload} className="hidden" />
                        <span className="text-sm font-semibold text-slate-700">{formData.marriageContractImage ? "Marriage contract uploaded" : "Upload marriage contract"}</span>
                        <span className="mt-1 text-xs text-slate-500">Required when civil status is married.</span>
                      </label>
                      {formData.marriageContractImage && (
                        <div className="flex flex-col gap-2 md:max-w-md">
                          <img src={formData.marriageContractImage} alt="Marriage contract" className="h-24 w-full rounded-lg border border-slate-200 object-cover md:w-72" />
                          <button type="button" onClick={() => setFormData((prev) => ({ ...prev, marriageContractImage: "" }))} className="w-fit rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">
                            Remove uploaded contract
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <h2 className="text-sm font-bold text-[#1e3a8a]">Address</h2>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Block / Phase</label>
                      <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="blk" placeholder="Example: 12 or Phase 2" value={addressDetails.blk} onChange={handleAddressChange} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Lot / House No.</label>
                      <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="lot" placeholder="Example: 8 or 24-A" value={addressDetails.lot} onChange={handleAddressChange} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Street</label>
                      <input className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="street" placeholder="Street / road in Mambog II" value={addressDetails.street} onChange={handleAddressChange} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-gray-800">Subdivision / Compound / Purok</label>
                      <input list="profile-mambog-subdivision-options" className="w-full rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" name="subdivision" placeholder="Select or type your Mambog II subdivision" value={addressDetails.subdivision} onChange={handleAddressChange} />
                      <datalist id="profile-mambog-subdivision-options">
                        {MAMBOG_II_SUBDIVISIONS.map((name) => <option key={name} value={name} />)}
                      </datalist>
                      <p className="text-[11px] text-slate-500">You can type manually if your exact Mambog II area is not listed.</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <span className="font-bold">Formal address preview:</span> {composeResidentAddress(addressDetails) || "Complete your address details."}
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
                  <p className="text-xs text-slate-500">Linked records must include full name, email, and a birth date showing 18 years old or above before they can be submitted for barangay review.</p>
                  <div className="space-y-3">
                    {children.map((child, index) => (
                      <div key={child._id || index} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[auto,1.1fr,1fr,0.95fr,1.2fr] md:items-start">
                        <div className="flex items-center gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                            {child.avatarImage ? (
                              <img
                                src={child.avatarImage}
                                alt={child.fullName || "Linked child"}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-[11px] font-bold text-slate-500">
                                {getChildInitials(child.fullName)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Linked Child</p>
                            <p className="truncate text-sm font-semibold text-slate-900">{child.fullName || "Linked child"}</p>
                            <p className="truncate text-xs text-slate-500">{child.email || "No child email yet"}</p>
                          </div>
                        </div>
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
                          <div className="flex items-center gap-2">
                            <select className="min-w-0 flex-1 rounded-md border border-gray-300 p-2.5 text-sm text-gray-700" value={child.relationship || "Child"} onChange={(e) => handleChildChange(index, "relationship", e.target.value)}>
                              {RELATIONSHIP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                            {child.status ? (
                              <span
                                className={`h-3.5 w-3.5 shrink-0 rounded-full ring-4 ${childStatusDotClass(child.status)}`}
                                title={`Status: ${child.status}`}
                                aria-label={`Child access status: ${child.status}`}
                              />
                            ) : null}
                            <button type="button" onClick={() => setChildActionModal({ index })} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" aria-label={`Open actions for ${child.fullName || "child"}`}>
                              <MoreHorizontal size={18} />
                            </button>
                          </div>
                        </div>
                        {childOtpModal.index === index && childRequestProgress > 0 ? (
                          <div className="md:col-span-5">
                            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                              <span>{childRequestProgress >= 100 ? "Request submitted to admin" : "Syncing child access request"}</span>
                              <span>{childRequestProgress}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full bg-[#395886] transition-all" style={{ width: `${childRequestProgress}%` }} />
                            </div>
                          </div>
                        ) : null}
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
                          autoComplete="new-password"
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
                          autoComplete="new-password"
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
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-[#1e3a8a] transition hover:bg-blue-100"
                  onClick={() => {
                    setActivityPage(1);
                    setShowAllActivities(true);
                  }}
                >
                  View All
                </button>
              </div>

              <div className="mb-4 w-full border-b border-gray-100" />

              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-gray-200 p-12 text-gray-400">
                  <Clock className="mb-4 opacity-20" size={48} />
                  <p className="text-[14px] italic">No recent account activity found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visiblePreviewActivities.map((activity) => (
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
                  {blurredPreviewActivities.map((activity) => (
                    <div key={activity._id} className="pointer-events-none flex flex-col gap-3 rounded-[16px] border border-gray-200 bg-gray-100/80 p-4 opacity-70 blur-[1px] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#1e3a8a]">{activity.referenceNo || activity.type}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{activity.title}</p>
                      </div>
                      <span className="rounded border border-gray-100 bg-white px-2 py-1 text-[11px] font-medium text-slate-400">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  {additionalHiddenCount > 0 && (
                    <div className="rounded-[16px] border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                      <p className="text-xs text-slate-500">+{additionalHiddenCount} more activities available in View All</p>
                    </div>
                  )}
                  {activities.length > 1 && (
                    <button
                      type="button"
                      className="w-full rounded-md border border-blue-200 bg-blue-50 py-2 text-sm font-semibold text-blue-700"
                      onClick={() => {
                        setActivityPage(1);
                        setShowAllActivities(true);
                      }}
                    >
                      View Full Activity History
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
          <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-500">Resident Records</p>
                <h3 className="text-xl font-bold text-slate-900">My Activity History</h3>
              </div>
              <button type="button" onClick={() => setShowAllActivities(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr,auto,auto]">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder="Search activity, reference, or status..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400"
                />
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                <Filter size={14} />
                <input type="date" value={activityDateFilter} onChange={(e) => setActivityDateFilter(e.target.value)} className="bg-transparent outline-none" />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                <Clock size={14} />
                <input type="time" value={activityTimeFilter} onChange={(e) => setActivityTimeFilter(e.target.value)} className="bg-transparent outline-none" />
              </label>
              {(activitySearch || activityDateFilter || activityTimeFilter) && (
                <button
                  type="button"
                  onClick={() => { setActivitySearch(""); setActivityDateFilter(""); setActivityTimeFilter(""); }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 md:col-span-3"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedActivities.map((activity) => {
                    const date = new Date(activity.createdAt);
                    return (
                      <tr key={activity._id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{activity.title}</p>
                          <p className="text-xs text-slate-500">{activity.referenceNo || activity.type}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-slate-600">{Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{activityStatusLabel(activity)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredActivities.length === 0 && <p className="p-5 text-sm text-slate-500">No activity matched the selected filters.</p>}
            </div>
            {filteredActivities.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold text-slate-500">
                  Showing {(currentActivityPage - 1) * ACTIVITY_PAGE_SIZE + 1}-{Math.min(currentActivityPage * ACTIVITY_PAGE_SIZE, filteredActivities.length)} of {filteredActivities.length}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={currentActivityPage <= 1}
                    onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700">
                    Page {currentActivityPage} of {activityTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentActivityPage >= activityTotalPages}
                    onClick={() => setActivityPage((page) => Math.min(activityTotalPages, page + 1))}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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
              onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
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

      {childActionModal && children[childActionModal.index] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Child Actions</h3>
                <p className="mt-1 text-xs text-slate-500">{children[childActionModal.index].fullName || "Linked child"}</p>
              </div>
              <button type="button" onClick={() => setChildActionModal(null)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleSendChildOtp(childActionModal.index)}
                className="flex w-full items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Send size={16} />
                Send OTP
              </button>
              <button
                type="button"
                onClick={() => removeChildRow(childActionModal.index)}
                className="flex w-full items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <Trash2 size={16} />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {childOtpModal.isOpen && childOtpModal.index !== null && children[childOtpModal.index] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Verify Child Access Request</h3>
              <button type="button" onClick={() => { setChildRequestProgress(0); setChildOtpModal({ isOpen: false, index: null, otp: "", sending: false, verifying: false }); }}>
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
            <p className="mt-3 text-sm text-slate-600">An OTP was sent to the parent email. Enter it below to submit this child access request for barangay approval.</p>
            {childRequestProgress > 0 ? (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>{childOtpModal.verifying ? "Verifying and saving your request" : "Waiting for OTP verification"}</span>
                  <span>{childRequestProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-[#395886] transition-all" style={{ width: `${childRequestProgress}%` }} />
                </div>
              </div>
            ) : null}
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
                    const res = await api.post("/api/auth/change-password/request-otp", {}, { headers: authHeaders() });
                    setFeedback({ isOpen: true, title: "OTP Resent", message: appendDevOtp("A new OTP was sent to your registered email.", res.data?.debugOtp), type: "success" });
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
