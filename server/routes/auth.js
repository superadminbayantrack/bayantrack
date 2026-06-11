import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import ActivityLog from '../models/ActivityLog.js';
import NotificationState from '../models/NotificationState.js';
import SystemSetting from '../models/SystemSetting.js';
import ServiceRequest from '../models/ServiceRequest.js';
import IssueReport from '../models/IssueReport.js';
import SeminarRequirement from '../models/SeminarRequirement.js';
import { auth } from '../middleware/auth.js';
import { AUTH_COOKIE_NAME, getAuthCookieOptions, getJwtSecret, isProductionEnv } from '../config/env.js';
import { getAdminNotificationRecipients, logSystemEvent, sendUserMail } from '../utils/notifications.js';
import { findEmbeddedAccount, getEmbeddedAccountById, isReservedEmbeddedIdentity } from '../config/embeddedAccounts.js';
import { cleanText, isValidEmail, isValidPhilippineMobile, personNameError } from '../utils/validation.js';

const router = express.Router();
const AUTH_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '7d';
const ALLOWED_BARANGAY_KEYWORDS = ['mambog ii', 'mambog 2'];
const ALLOWED_CITY_KEYWORDS = ['bacoor'];
const ALLOWED_PROVINCE_KEYWORDS = ['cavite'];
const OTP_EMAIL_UNAVAILABLE_MESSAGE = 'OTP email service is currently unavailable. Check the Vercel email environment variables.';

async function sendOtpMailWithFallback({ to, subject, html, text, otp, context }) {
  const sent = await sendUserMail({ to, subject, html, text });
  if (sent) {
    return { sent: true, debugOtp: '' };
  }

  if (!isProductionEnv()) {
    console.warn(`[DEV OTP] ${context} -> ${to}: ${otp}`);
    return { sent: true, debugOtp: otp };
  }

  return { sent: false, debugOtp: '' };
}

function residentNotificationActorKey(userPayload = {}) {
  return `resident:${String(userPayload?.id || userPayload?._id || 'unknown').trim() || 'unknown'}`;
}

function setAuthCookie(req, res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions(req));
}

function clearAuthCookie(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthCookieOptions(req));
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeLoginIdentifier(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizePhilippineMobile(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return digits;
}

function normalizeOptionalImageDataUrl(value, label = 'Image') {
  if (value === undefined || value === null) return '';
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(text)) {
    const error = new Error(`${label} must be a PNG, JPG, WEBP, or GIF image.`);
    error.statusCode = 400;
    throw error;
  }
  if (text.length > 3_000_000) {
    const error = new Error(`${label} must be 2MB or below.`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function composeAddress(addressDetails) {
  if (!addressDetails) return '';
  const normalized = {
    ...addressDetails,
    barangay: 'Mambog II',
    city: 'Bacoor',
    province: 'Cavite',
    zipCode: '4102',
  };
  const block = String(normalized.blk || '').trim().replace(/^blk\.?\s*/i, '');
  const lot = String(normalized.lot || '').trim().replace(/^lot\.?\s*/i, '');
  const parts = [
    block ? `Blk ${block}` : '',
    lot ? `Lot ${lot}` : '',
    normalized.street || '',
    normalized.subdivision || '',
    normalized.barangay || '',
    normalized.city || '',
    normalized.province || '',
    normalized.zipCode || '',
  ].filter(Boolean);
  return parts.join(', ');
}

function normalizeAddressDetails(addressDetails) {
  return {
    blk: String(addressDetails?.blk || '').trim().replace(/^blk\.?\s*/i, ''),
    lot: String(addressDetails?.lot || '').trim().replace(/^lot\.?\s*/i, ''),
    street: String(addressDetails?.street || '').trim(),
    subdivision: String(addressDetails?.subdivision || '').trim(),
    barangay: 'Mambog II',
    city: 'Bacoor',
    province: 'Cavite',
    zipCode: '4102',
  };
}

function getAgeFromBirthDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDelta = today.getMonth() - date.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

function normalizeChildren(children) {
  if (!Array.isArray(children)) return [];
  return children
    .map((child) => ({
      _id: child?._id,
      fullName: cleanText(child?.fullName, { max: 140 }),
      email: String(child?.email || '').trim().toLowerCase(),
      birthDate: String(child?.birthDate || '').trim(),
      relationship: String(child?.relationship || 'Child').trim() || 'Child',
      avatarImage: String(child?.avatarImage || '').trim(),
      status: ['pending', 'approved', 'rejected'].includes(String(child?.status || '').trim()) ? String(child?.status).trim() : 'pending',
      reviewReason: String(child?.reviewReason || '').trim(),
      reviewedAt: child?.reviewedAt || null,
    }))
    .filter((child) => child.fullName && child.birthDate && child.email);
}

function validateChildren(children) {
  const emailSet = new Set();
  for (const child of children) {
    const childNameError = personNameError(child.fullName, 'Child full name');
    if (childNameError) {
      return {
        ok: false,
        msg: childNameError,
      };
    }
    const age = getAgeFromBirthDate(child.birthDate);
    if (age === null) {
      return {
        ok: false,
        msg: `Child record "${child.fullName}" has an invalid birth date.`,
      };
    }
    if (age < 18) {
      return {
        ok: false,
        msg: `Child record "${child.fullName}" must be 18 years old or above.`,
      };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(child.email)) {
      return {
        ok: false,
        msg: `Child record "${child.fullName}" must have a valid email address.`,
      };
    }
    if (emailSet.has(child.email)) {
      return {
        ok: false,
        msg: `Child email "${child.email}" is duplicated in the list.`,
      };
    }
    emailSet.add(child.email);
  }
  return { ok: true };
}

function ensureResidentAddress({ address, addressDetails }) {
  const source = normalizeText(address || composeAddress(addressDetails));
  if (!source) {
    return { ok: false, msg: 'Complete address is required.' };
  }

  const hasBarangay = ALLOWED_BARANGAY_KEYWORDS.some((k) => source.includes(k));
  const hasCity = ALLOWED_CITY_KEYWORDS.some((k) => source.includes(k));
  const hasProvince = ALLOWED_PROVINCE_KEYWORDS.some((k) => source.includes(k));
  const subdivision = String(addressDetails?.subdivision || '').trim();

  if (!hasBarangay || !hasCity || !hasProvince) {
    return {
      ok: false,
      msg: 'Registration is exclusive to residents of Mambog II, Bacoor City, Cavite.',
    };
  }

  if (!subdivision) {
    return {
      ok: false,
      msg: 'Please enter your Mambog II subdivision, compound, purok, or landmark.',
    };
  }

  return { ok: true };
}

function isStrongPassword(value) {
  const pwd = String(value || '');
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/.test(pwd);
}

async function readSystemSettings() {
  const settings = await SystemSetting.findOne();
  return settings || { allowResidentRegistration: true, lockoutWindowMinutes: 15 };
}

function maintenanceMessage(settings) {
  return settings?.maintenanceMessage || 'The resident portal is temporarily under maintenance. Please try again later.';
}

function registrationWelcomeHtml({ firstName, fullName }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f6f8fc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:#1e3a8a;color:#fff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack - Mambog II</h2>
        <p style="margin:6px 0 0;font-size:12px;opacity:0.9;">Resident Portal Registration</p>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 10px;">Hi <strong>${firstName || 'Resident'}</strong>,</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Thank you for registering with BayanTrack. Your account has been received and is now
          waiting for barangay approval.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:14px 0;">
          <p style="margin:0;font-size:12px;color:#475569;">Registered Name</p>
          <p style="margin:4px 0 0;font-weight:700;">${fullName || ''}</p>
        </div>
        <p style="margin:0 0 8px;line-height:1.6;">We will send another update once your account is approved.</p>
        <p style="margin:0;color:#475569;">Thanks,<br/>BayanTrack Support Team</p>
      </div>
    </div>
  </div>
  `;
}

function accountApprovedHtml({ firstName, fullName }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f6f8fc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:#166534;color:#fff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack - Mambog II</h2>
        <p style="margin:6px 0 0;font-size:12px;opacity:0.9;">Account Approval Notice</p>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 10px;">Hi <strong>${firstName || 'Resident'}</strong>,</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Your BayanTrack resident account has been approved. You can now log in and use the system.
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin:14px 0;">
          <p style="margin:0;font-size:12px;color:#166534;">Approved Account</p>
          <p style="margin:4px 0 0;font-weight:700;">${fullName || ''}</p>
        </div>
        <p style="margin:0;color:#475569;">Thanks,<br/>BayanTrack Support Team</p>
      </div>
    </div>
  </div>
  `;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function otpNoticeHtml({ firstName, title, intro, otp, label = 'OTP Code', details = [] }) {
  const safeDetails = details
    .filter((item) => item?.label && item?.value)
    .map((item) => `
          <p style="margin:0 0 6px;font-size:13px;line-height:1.5;">
            <strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}
          </p>`)
    .join('');

  return `
  <div style="font-family:Arial,sans-serif;background:#f6f8fc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:#166534;color:#ffffff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;line-height:1.3;">BayanTrack - Mambog II</h2>
        <p style="margin:8px 0 0;font-size:12px;opacity:0.92;">${escapeHtml(title)}</p>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 12px;">Hi <strong>${escapeHtml(firstName || 'Resident')}</strong>,</p>
        <p style="margin:0 0 14px;line-height:1.6;">${escapeHtml(intro)}</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin:16px 0;">
          <p style="margin:0;font-size:12px;color:#166534;">${escapeHtml(label)}</p>
          <p style="margin:6px 0 0;font-size:24px;font-weight:700;letter-spacing:6px;color:#0f172a;">${escapeHtml(otp)}</p>
        </div>
        ${safeDetails ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:14px 0;">${safeDetails}</div>` : ''}
        <p style="margin:0 0 8px;line-height:1.6;color:#475569;">This code expires in 5 minutes. Please do not share it with anyone.</p>
        <p style="margin:0;color:#475569;">Thanks,<br/>BayanTrack Support Team</p>
      </div>
    </div>
  </div>
  `;
}

function otpNoticeText({ title, intro, otp, details = [] }) {
  return [
    `BayanTrack - Mambog II`,
    title,
    ``,
    intro,
    ``,
    `OTP Code: ${otp}`,
    `This code expires in 5 minutes. Please do not share it with anyone.`,
    ...details.filter((item) => item?.label && item?.value).flatMap((item) => [``, `${item.label}: ${item.value}`]),
    ``,
    `Thanks,`,
    `BayanTrack Support Team`,
  ].join('\n');
}

function childAccessOtpText({ otp, child, parentName }) {
  return [
    `BayanTrack Child Access OTP`,
    ``,
    `Parent: ${parentName || 'Resident'}`,
    `Requested child full name: ${child.fullName}`,
    `Child email: ${child.email}`,
    `Birth date: ${child.birthDate}`,
    `Relationship: ${child.relationship || 'Child'}`,
    ``,
    `OTP Code: ${otp}`,
    `This code expires in 5 minutes.`,
  ].join('\n');
}

function childProfileUpdateOtpText({ otp, child, parentName }) {
  return [
    `BayanTrack Child Profile Update OTP`,
    ``,
    `Parent: ${parentName || 'Resident'}`,
    `Child full name: ${child.fullName}`,
    `Child email: ${child.email}`,
    ``,
    `OTP Code: ${otp}`,
    `This code expires in 5 minutes.`,
  ].join('\n');
}

function childAccessSubmittedHtml({ parentName, child }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#1e3a8a;color:#ffffff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack Child Access Request</h2>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 12px;font-weight:700;">A linked child request is pending review.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
          <p style="margin:0 0 8px;"><strong>Parent:</strong> ${parentName || 'Resident'}</p>
          <p style="margin:0 0 8px;"><strong>Child:</strong> ${child.fullName}</p>
          <p style="margin:0 0 8px;"><strong>Child Email:</strong> ${child.email}</p>
          <p style="margin:0;"><strong>Status:</strong> pending</p>
        </div>
      </div>
    </div>
  </div>`;
}

// @route   POST api/auth/send-otp
// @desc    Send OTP to email for registration
// @access  Public
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  try {
    const settings = await readSystemSettings();
    if (settings.maintenanceMode) {
      return res.status(503).json({ msg: maintenanceMessage(settings) });
    }
    if (!settings.allowResidentRegistration) {
      return res.status(403).json({ msg: 'Resident registration is temporarily disabled by system settings.' });
    }

    // Check if user already exists
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ msg: 'Email is required.' });
    }
    if (isReservedEmbeddedIdentity({ email: normalizedEmail })) {
      return res.status(400).json({ msg: 'This email is reserved for barangay staff login. Please use a different resident email.' });
    }

    let user = await User.findOne({ email: normalizedEmail });
    if (user) {
      return res.status(400).json({ msg: 'User with this email already exists' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to DB (upsert: update if exists, insert if not)
    await Otp.findOneAndUpdate(
      { email: normalizedEmail },
      { email: normalizedEmail, otp },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Send Email
    const otpMail = {
      firstName: 'Resident',
      title: 'Registration OTP',
      intro: 'Use this one-time password to continue creating your BayanTrack account.',
      otp,
      label: 'Registration OTP',
    };
    const { sent, debugOtp } = await sendOtpMailWithFallback({
      to: normalizedEmail,
      subject: 'Your BayanTrack Registration OTP',
      html: otpNoticeHtml(otpMail),
      text: otpNoticeText(otpMail),
      otp,
      context: 'registration-otp',
    });

    if (!sent) {
      await Otp.deleteOne({ email: normalizedEmail });
      return res.status(503).json({
        msg: OTP_EMAIL_UNAVAILABLE_MESSAGE,
      });
    }
    res.json({ msg: 'OTP sent to email', debugOtp });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error sending email');
  }
});

// @route   POST api/auth/register/check
// @desc    Validate registration fields before sending OTP
// @access  Public
router.post('/register/check', async (req, res) => {
  const { username, firstName, middleName, lastName, email, contactNumber, address, addressDetails } = req.body;
  try {
    const settings = await readSystemSettings();
    if (settings.maintenanceMode) {
      return res.status(503).json({ msg: maintenanceMessage(settings) });
    }
    if (!settings.allowResidentRegistration) {
      return res.status(403).json({ msg: 'Resident registration is temporarily disabled by system settings.' });
    }
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedContactNumber = normalizePhilippineMobile(contactNumber);

    if (!username || !email || !contactNumber) {
      return res.status(400).json({ msg: 'Username, email, and phone number are required.' });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ msg: 'Valid email address is required.' });
    }
    if (!isValidPhilippineMobile(normalizedContactNumber)) {
      return res.status(400).json({ msg: 'Contact number must be exactly 11 digits and start with 09.' });
    }
    const registrationNameError =
      personNameError(firstName, 'First name') ||
      personNameError(middleName, 'Middle name', { required: false }) ||
      personNameError(lastName, 'Last name');
    if (registrationNameError) {
      return res.status(400).json({ msg: registrationNameError });
    }
    if (isReservedEmbeddedIdentity({ username, email: normalizedEmail, contactNumber: normalizedContactNumber })) {
      return res.status(400).json({ msg: 'These login details are reserved for barangay staff. Please use different resident details.' });
    }

    const normalizedAddress = normalizeAddressDetails(addressDetails);
    const residentCheck = ensureResidentAddress({ address, addressDetails: normalizedAddress });
    if (!residentCheck.ok) {
      return res.status(400).json({ msg: residentCheck.msg });
    }

    const user = await User.findOne({ $or: [{ email: normalizedEmail }, { username }, { contactNumber: normalizedContactNumber }] });
    if (user) {
      if (user.email === normalizedEmail) return res.status(400).json({ msg: 'Email is already registered.' });
      if (user.username === username) return res.status(400).json({ msg: 'Username is already taken.' });
      if (user.contactNumber === normalizedContactNumber) return res.status(400).json({ msg: 'Phone number is already registered.' });
      return res.status(400).json({ msg: 'Account details already in use.' });
    }

    return res.json({ msg: 'Registration details are available.' });
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to validate registration details.' });
  }
});

// @route   POST api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  const {
    username,
    firstName,
    middleName,
    lastName,
    address,
    addressDetails,
    contactNumber,
    email,
    password,
    otp,
    validIdType,
    validIdImage,
    gender,
    civilStatus,
    marriageContractImage,
    residentNote,
    children,
  } = req.body;

  try {
    const settings = await readSystemSettings();
    if (settings.maintenanceMode) {
      return res.status(503).json({ msg: maintenanceMessage(settings) });
    }
    if (!settings.allowResidentRegistration) {
      return res.status(403).json({ msg: 'Resident registration is temporarily disabled by system settings.' });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedContactNumber = normalizePhilippineMobile(contactNumber);
    const normalizedAddress = normalizeAddressDetails(addressDetails);
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ msg: 'Valid email address is required.' });
    }
    if (isReservedEmbeddedIdentity({ username, email: normalizedEmail, contactNumber: normalizedContactNumber })) {
      return res.status(400).json({ msg: 'These login details are reserved for barangay staff. Please use different resident details.' });
    }

    // Verify OTP
    const validOtp = await Otp.findOne({ email: normalizedEmail, otp: String(otp || '').trim() });
    if (!validOtp) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    // Validate Contact Number (Must be 11 digits)
    if (!isValidPhilippineMobile(normalizedContactNumber)) {
      return res.status(400).json({ msg: 'Contact number must be exactly 11 digits and start with 09.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ msg: 'Password must be at least 8 characters and include uppercase, lowercase, and 1 special character.' });
    }
    const registrationNameError =
      personNameError(firstName, 'First name') ||
      personNameError(middleName, 'Middle name', { required: false }) ||
      personNameError(lastName, 'Last name');
    if (registrationNameError) {
      return res.status(400).json({ msg: registrationNameError });
    }

    let user = await User.findOne({ $or: [{ email: normalizedEmail }, { username }, { contactNumber: normalizedContactNumber }] });
    if (user) {
      if (user.email === normalizedEmail) {
        return res.status(400).json({ msg: 'Email is already registered.' });
      }
      if (user.username === username) {
        return res.status(400).json({ msg: 'Username is already taken.' });
      }
      if (user.contactNumber === normalizedContactNumber) {
        return res.status(400).json({ msg: 'Phone number is already registered.' });
      }
      return res.status(400).json({ msg: 'Account details already in use.' });
    }

    if (!validIdType || !validIdImage) {
      return res.status(400).json({ msg: 'Valid ID type and image are required' });
    }

    const residentCheck = ensureResidentAddress({ address, addressDetails: normalizedAddress });
    if (!residentCheck.ok) {
      return res.status(400).json({ msg: residentCheck.msg });
    }

    const childRows = normalizeChildren(children);
    const childCheck = validateChildren(childRows);
    if (!childCheck.ok) {
      return res.status(400).json({ msg: childCheck.msg });
    }

    const mergedAddress = address || composeAddress(normalizedAddress);

    user = new User({
      username,
      firstName: cleanText(firstName, { max: 80 }),
      middleName: cleanText(middleName, { max: 80 }),
      lastName: cleanText(lastName, { max: 80 }),
      address: mergedAddress,
      addressDetails: normalizedAddress,
      contactNumber: normalizedContactNumber,
      email: normalizedEmail,
      password,
      gender,
      civilStatus,
      marriageContractImage: marriageContractImage || '',
      residentNote: residentNote || '',
      children: childRows,
      validIdType,
      validIdImage,
      status: 'pending',
      validIdStatus: 'pending',
    });

    // Hash password before saving
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    
    // Delete used OTP
    await Otp.deleteOne({ _id: validOtp._id });

    try {
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      await sendUserMail({
        to: normalizedEmail,
        subject: 'Welcome to BayanTrack - Registration Received',
        html: registrationWelcomeHtml({ firstName, fullName }),
        text: `Hi ${firstName || ''}, thanks for registering in BayanTrack. Please wait for the admin to approve your account.`,
      });
    } catch (mailErr) {
      console.error('Failed to send registration welcome email:', mailErr);
    }

    await logSystemEvent({
      user: user._id,
      type: 'resident-registration',
      title: `New resident registration submitted by ${username}`,
      referenceNo: user._id.toString(),
      metadata: { module: 'auth', action: 'register', status: 'pending', residentEmail: normalizedEmail },
    });

    res.send('Registration submitted. Awaiting barangay approval.');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { identifier, password } = req.body; // identifier can be username, email or phone

  try {
    const embeddedAccount = findEmbeddedAccount(identifier, password);
    if (embeddedAccount) {
      const payload = {
        user: {
          id: embeddedAccount.id,
        },
      };
      return jwt.sign(payload, getJwtSecret(), { expiresIn: AUTH_TOKEN_TTL }, (err, token) => {
        if (err) throw err;
        setAuthCookie(req, res, token);
        return res.json({ role: embeddedAccount.role, actingChild: null });
      });
    }

    const settings = await readSystemSettings();
    const lockoutMinutes = Number(settings.lockoutWindowMinutes) > 0 ? Number(settings.lockoutWindowMinutes) : 15;
    const rawIdentifier = String(identifier || '').trim();
    const normalizedIdentifier = normalizeLoginIdentifier(rawIdentifier);
    const normalizedPhoneIdentifier = normalizePhilippineMobile(rawIdentifier);
    const loginIdentityFilters = [
      { email: normalizedIdentifier },
      { username: rawIdentifier },
      ...(normalizedIdentifier && normalizedIdentifier !== rawIdentifier ? [{ username: normalizedIdentifier }] : []),
      ...(isValidPhilippineMobile(normalizedPhoneIdentifier) ? [{ contactNumber: normalizedPhoneIdentifier }] : []),
    ];

    // Check for user by Username OR Email OR Contact Number
    let user = await User.findOne({
      $or: loginIdentityFilters
    });
    let actingChild = null;

    if (!user) {
      const childMatchedUser = await User.findOne({
        children: {
          $elemMatch: {
            status: 'approved',
            $or: [
              { email: normalizedIdentifier },
              { fullName: new RegExp(`^${rawIdentifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, 'i') },
            ],
          },
        },
      });
      if (childMatchedUser) {
        user = childMatchedUser;
        actingChild = (childMatchedUser.children || []).find((child) =>
          String(child.status || '') === 'approved' &&
          (
            normalizeLoginIdentifier(child.email) === normalizedIdentifier ||
            normalizeLoginIdentifier(child.fullName) === normalizedIdentifier
          )
        ) || null;
      }
    }

    if (!user) {
      return res.status(404).json({ msg: 'Account is not registered yet or may have been deleted.' });
    }

    if (user.role === 'resident' && isReservedEmbeddedIdentity({ username: user.username, email: user.email, contactNumber: user.contactNumber })) {
      return res.status(403).json({ msg: 'These login details are reserved for barangay staff. Please use the staff login account or register with a different resident email.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (user.lockUntil && user.lockUntil > new Date()) {
      if (isMatch && ['admin', 'superadmin'].includes(user.role)) {
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        await user.save();
      } else {
        return res.status(423).json({
          msg: 'Too many failed login attempts. Please use Forgot Password (OTP) or try again later.',
        });
      }
    }

    if (!isMatch) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const lockNow = attempts >= 3;
      user.failedLoginAttempts = lockNow ? 0 : attempts;
      user.lockUntil = lockNow ? new Date(Date.now() + lockoutMinutes * 60 * 1000) : null;
      await user.save();
      if (lockNow) {
        return res.status(423).json({
          msg: `Too many failed login attempts. Please use Forgot Password (OTP) or try again in ${lockoutMinutes} minutes.`,
        });
      }
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    if (settings.maintenanceMode && user.role === 'resident') {
      return res.status(503).json({ msg: maintenanceMessage(settings) });
    }

    // superadmin account must always be login-capable even if status is not active
    if (user.role !== 'superadmin' && user.status !== 'active') {
      if (user.status === 'suspended') {
        return res.status(403).json({ msg: 'This account was archived by a barangay administrator. Contact support or use Forgot Password.' });
      }
      return res.status(403).json({ msg: 'Account is pending barangay approval.' });
    }

    if (user.failedLoginAttempts || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    // The JWT is stored in an httpOnly cookie so browser JavaScript cannot read it.
    const payload = {
      user: {
        id: user.id,
        ...(actingChild ? {
          actingChild: {
            id: actingChild._id?.toString?.() || '',
          },
        } : {}),
      },
    };
    jwt.sign(payload, getJwtSecret(), { expiresIn: AUTH_TOKEN_TTL }, (err, token) => {
      if (err) throw err;
      setAuthCookie(req, res, token);
      res.json({ role: user.role, actingChild });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

router.post('/logout', (req, res) => {
  clearAuthCookie(req, res);
  return res.json({ msg: 'Logged out successfully.' });
});

// @route   GET api/auth/user
// @desc    Get user data
// @access  Private
router.get('/user', auth, async (req, res) => {
  try {
    const embeddedAccount = getEmbeddedAccountById(req.user.id);
    if (embeddedAccount) {
      return res.json({
        _id: embeddedAccount.id,
        username: embeddedAccount.username,
        firstName: embeddedAccount.firstName,
        lastName: embeddedAccount.lastName,
        email: embeddedAccount.email,
        contactNumber: embeddedAccount.contactNumber,
        address: embeddedAccount.address,
        role: embeddedAccount.role,
        status: embeddedAccount.status,
        adminPermissions: embeddedAccount.adminPermissions,
        actingChild: null,
      });
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    const payload = user.toObject();
    if (req.user.actingChild?.id) {
      const freshChild = (user.children || []).find((child) => String(child._id) === String(req.user.actingChild.id));
      payload.actingChild = freshChild
        ? {
            id: freshChild._id?.toString?.() || '',
            fullName: freshChild.fullName || '',
            email: freshChild.email || '',
            avatarImage: freshChild.avatarImage || '',
          }
        : req.user.actingChild || null;
    } else {
      payload.actingChild = req.user.actingChild || null;
    }
    res.json(payload);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/auth/user
// @desc    Update user data
// @access  Private
router.put('/user', auth, async (req, res) => {
  const {
    username,
    firstName,
    middleName,
    lastName,
    address,
    addressDetails,
    contactNumber,
    email,
    avatarImage,
    password,
    preferredContactMethod,
    emailOtp,
    passwordOtp,
    gender,
    civilStatus,
    marriageContractImage,
    residentNote,
    children,
  } = req.body;
   
  // Build user object
  const userFields = {};
  const normalizedProfileContactNumber = contactNumber ? normalizePhilippineMobile(contactNumber) : '';
  if (username) userFields.username = username;
  if (firstName) userFields.firstName = cleanText(firstName, { max: 80 });
  if (middleName) userFields.middleName = cleanText(middleName, { max: 80 });
  if (lastName) userFields.lastName = cleanText(lastName, { max: 80 });
  if (address) userFields.address = address;
  if (addressDetails) {
    userFields.addressDetails = normalizeAddressDetails(addressDetails);
    userFields.address = composeAddress(userFields.addressDetails);
  }
  if (normalizedProfileContactNumber) userFields.contactNumber = normalizedProfileContactNumber;
  const normalizedProfileEmail = email ? String(email).trim().toLowerCase() : '';
  if (normalizedProfileEmail) userFields.email = normalizedProfileEmail;
  if (avatarImage !== undefined) userFields.avatarImage = avatarImage;
  if (preferredContactMethod) userFields.preferredContactMethod = 'Email';
  if (gender) userFields.gender = gender;
  if (civilStatus) userFields.civilStatus = civilStatus;
  if (marriageContractImage !== undefined) userFields.marriageContractImage = marriageContractImage;
  if (residentNote !== undefined) userFields.residentNote = residentNote;
  if (children !== undefined) userFields.children = normalizeChildren(children);

  try {
    let user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    const isEmailChange = Boolean(normalizedProfileEmail && normalizedProfileEmail !== String(user.email || '').toLowerCase());

    const profileNameError =
      (firstName !== undefined ? personNameError(firstName, 'First name') : '') ||
      (middleName !== undefined ? personNameError(middleName, 'Middle name', { required: false }) : '') ||
      (lastName !== undefined ? personNameError(lastName, 'Last name') : '');
    if (profileNameError) {
      return res.status(400).json({ msg: profileNameError });
    }

    if (isEmailChange) {
      const emailExists = await User.findOne({ email: normalizedProfileEmail, _id: { $ne: req.user.id } });
      if (emailExists) return res.status(400).json({ msg: 'Email is already registered.' });
      if (!emailOtp) return res.status(400).json({ msg: 'OTP is required to change email.' });
      const validOtp = await Otp.findOne({ email: normalizedProfileEmail, otp: emailOtp });
      if (!validOtp) return res.status(400).json({ msg: 'Invalid or expired email OTP.' });
    }

    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username, _id: { $ne: req.user.id } });
      if (usernameExists) return res.status(400).json({ msg: 'Username is already taken.' });
    }

    if (normalizedProfileContactNumber && normalizedProfileContactNumber !== user.contactNumber) {
      if (!isValidPhilippineMobile(normalizedProfileContactNumber)) {
        return res.status(400).json({ msg: 'Contact number must be exactly 11 digits and start with 09.' });
      }
      const phoneExists = await User.findOne({ contactNumber: normalizedProfileContactNumber, _id: { $ne: req.user.id } });
      if (phoneExists) return res.status(400).json({ msg: 'Phone number is already registered.' });
    }

    if (address || addressDetails) {
      const residentCheck = ensureResidentAddress({
        address: userFields.address || address,
        addressDetails: userFields.addressDetails || normalizeAddressDetails(addressDetails),
      });
      if (!residentCheck.ok) {
        return res.status(400).json({ msg: residentCheck.msg });
      }
    }

    if ((civilStatus === 'married' || userFields.civilStatus === 'married') && !String(userFields.marriageContractImage ?? user.marriageContractImage ?? '').trim()) {
      return res.status(400).json({ msg: 'Marriage contract is required for married residents.' });
    }

    if (children !== undefined) {
      const childCheck = validateChildren(userFields.children || []);
      if (!childCheck.ok) {
        return res.status(400).json({ msg: childCheck.msg });
      }
    }

    if (password) {
      if (!isStrongPassword(password)) {
        return res.status(400).json({ msg: 'Password must be at least 8 characters and include uppercase, lowercase, and 1 special character.' });
      }
      if (!passwordOtp) return res.status(400).json({ msg: 'OTP is required to change password.' });
      const validPasswordOtp = await Otp.findOne({ email: user.email, otp: passwordOtp });
      if (!validPasswordOtp) return res.status(400).json({ msg: 'Invalid or expired password OTP.' });
      const salt = await bcrypt.genSalt(10);
      userFields.password = await bcrypt.hash(password, salt);
      await Otp.deleteMany({ email: user.email });
    }

    user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: userFields },
      { returnDocument: 'after' }
    ).select('-password');

    await logSystemEvent({
      user: req.user.id,
      type: 'profile-update',
      title: 'Updated profile settings',
      metadata: { module: 'profile', action: 'update' },
      notifySuperadmin: true,
    });

    if (isEmailChange) {
      await Otp.deleteMany({ email: normalizedProfileEmail });
    }

    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/auth/notifications
// @desc    Resident notification feed (latest status updates)
// @access  Private
router.get('/notifications', auth, async (req, res) => {
  try {
    const state = await NotificationState.findOne({ actorId: residentNotificationActorKey(req.user) }).lean();
    const clearedAt = state?.clearedAt ? new Date(state.clearedAt) : null;
    const [latestServices, latestReports, latestSeminars, latestActivity] = await Promise.all([
      ServiceRequest.find({ user: req.user.id })
        .sort({ updatedAt: -1 })
        .limit(6)
        .select('referenceNo serviceType status issuedDocument updatedAt createdAt'),
      IssueReport.find({ user: req.user.id })
        .sort({ updatedAt: -1 })
        .limit(6)
        .select('referenceNo reportType category status priority hearingSchedule updatedAt createdAt'),
      SeminarRequirement.find({ residentId: req.user.id })
        .sort({ updatedAt: -1 })
        .limit(6)
        .select('referenceNumber relatedReferenceNo type title scheduleDate scheduleTime venue status remarks updatedAt createdAt'),
      ActivityLog.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .limit(6)
        .select('title type referenceNo createdAt'),
    ]);

    const notices = [
      ...latestServices.map((s) => ({
        id: `svc-${s._id}`,
        kind: 'service',
        title: `${s.serviceType} is now ${s.status}`,
        subtitle: s.referenceNo,
        createdAt: s.updatedAt || s.createdAt,
      })),
      ...latestReports.map((r) => ({
        id: `rpt-${r._id}`,
        kind: 'report',
        title: `${r.category} report is now ${r.status}`,
        subtitle: r.hearingSchedule?.date ? `${r.referenceNo} - hearing ${r.hearingSchedule.date}` : r.referenceNo,
        createdAt: r.updatedAt || r.createdAt,
      })),
      ...latestSeminars.map((s) => ({
        id: `sem-${s._id}`,
        kind: 'seminar-intervention',
        title: `${s.title} is ${s.status}`,
        subtitle: [s.relatedReferenceNo || s.referenceNumber, s.scheduleDate ? `${s.scheduleDate} ${s.scheduleTime || ''}`.trim() : '', s.venue].filter(Boolean).join(' - '),
        createdAt: s.updatedAt || s.createdAt,
      })),
      ...latestActivity.map((a) => ({
        id: `act-${a._id}`,
        kind: 'activity',
        title: a.title,
        subtitle: a.referenceNo || a.type,
        createdAt: a.createdAt,
      })),
    ]
      .filter((notice) => !clearedAt || new Date(notice.createdAt).getTime() > clearedAt.getTime())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return res.json({ count: notices.length, items: notices });
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch notifications' });
  }
});

// @route   PATCH api/auth/notifications/clear
// @desc    Clear resident notification feed for the current account
// @access  Private
router.patch('/notifications/clear', auth, async (req, res) => {
  try {
    const actorId = residentNotificationActorKey(req.user);
    const clearedAt = new Date();
    const state = await NotificationState.findOneAndUpdate(
      { actorId },
      { actorId, clearedAt },
      { new: true, upsert: true },
    ).lean();

    return res.json({ msg: 'Notifications cleared', clearedAt: state.clearedAt });
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to clear notifications' });
  }
});

// @route   POST api/auth/change-email/request-otp
// @desc    Send OTP to new email before changing resident email
// @access  Private
router.post('/change-email/request-otp', auth, async (req, res) => {
  const { newEmail } = req.body;

  try {
    const normalizedNewEmail = String(newEmail || '').trim().toLowerCase();
    if (!normalizedNewEmail) return res.status(400).json({ msg: 'New email is required.' });

    const currentUser = await User.findById(req.user.id).select('firstName lastName email');
    if (!currentUser) return res.status(404).json({ msg: 'User not found' });

    if (normalizedNewEmail === String(currentUser.email || '').toLowerCase()) {
      return res.status(400).json({ msg: 'New email must be different from current email.' });
    }

    const existing = await User.findOne({ email: normalizedNewEmail, _id: { $ne: req.user.id } });
    if (existing) return res.status(400).json({ msg: 'Email is already registered.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { email: normalizedNewEmail },
      { email: normalizedNewEmail, otp },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    const otpMail = {
      firstName: currentUser.firstName,
      title: 'Email Change OTP',
      intro: 'Use this one-time password to confirm your new BayanTrack email address.',
      otp,
      label: 'Email Change OTP',
      details: [{ label: 'New Email', value: normalizedNewEmail }],
    };
    const { sent, debugOtp } = await sendOtpMailWithFallback({
      to: normalizedNewEmail,
      subject: 'Confirm Email Change (BayanTrack OTP)',
      html: otpNoticeHtml(otpMail),
      text: otpNoticeText(otpMail),
      otp,
      context: 'change-email-otp',
    });

    if (!sent) {
      await Otp.deleteOne({ email: normalizedNewEmail });
      return res.status(503).json({ msg: OTP_EMAIL_UNAVAILABLE_MESSAGE });
    }

    return res.json({ msg: 'OTP sent to new email.', debugOtp });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Failed to send OTP.' });
  }
});

// @route   POST api/auth/change-password/request-otp
// @desc    Send OTP to currently registered email before password change
// @access  Private
router.post('/change-password/request-otp', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('firstName lastName email');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (!user.email) return res.status(400).json({ msg: 'No registered email found for this account.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { email: user.email },
      { email: user.email, otp },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    const otpMail = {
      firstName: user.firstName,
      title: 'Password Change OTP',
      intro: 'Use this one-time password to confirm your BayanTrack password change.',
      otp,
      label: 'Password Change OTP',
    };
    const { sent, debugOtp } = await sendOtpMailWithFallback({
      to: user.email,
      subject: 'Confirm Password Change (BayanTrack OTP)',
      html: otpNoticeHtml(otpMail),
      text: otpNoticeText(otpMail),
      otp,
      context: 'change-password-otp',
    });

    if (!sent) {
      await Otp.deleteOne({ email: user.email });
      return res.status(503).json({ msg: OTP_EMAIL_UNAVAILABLE_MESSAGE });
    }

    return res.json({ msg: 'OTP sent to your registered email.', debugOtp });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: 'Failed to send OTP.' });
  }
});

// @route   POST api/auth/child-access/request-otp
// @desc    Send OTP to parent email before saving child access request
// @access  Private
router.post('/child-access/request-otp', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found.' });

    const childRows = normalizeChildren([req.body.child]);
    if (childRows.length === 0) {
      return res.status(400).json({ msg: 'Complete child information is required.' });
    }
    const child = childRows[0];
    const childCheck = validateChildren([child]);
    if (!childCheck.ok) {
      return res.status(400).json({ msg: childCheck.msg });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { email: user.email },
      { email: user.email, otp },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const parentName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const otpMail = {
      firstName: user.firstName,
      title: 'Child Access OTP',
      intro: 'Use this one-time password to submit a child access request for barangay review.',
      otp,
      label: 'Child Access OTP',
      details: [
        { label: 'Parent', value: parentName || 'Resident' },
        { label: 'Requested Child', value: child.fullName },
        { label: 'Child Email', value: child.email },
        { label: 'Birth Date', value: child.birthDate },
        { label: 'Relationship', value: child.relationship || 'Child' },
      ],
    };
    const { sent, debugOtp } = await sendOtpMailWithFallback({
      to: user.email,
      subject: 'Confirm Child Access Request (BayanTrack OTP)',
      html: otpNoticeHtml(otpMail),
      text: otpNoticeText(otpMail),
      otp,
      context: 'child-access-otp',
    });

    if (!sent) {
      await Otp.deleteOne({ email: user.email });
      return res.status(503).json({ msg: OTP_EMAIL_UNAVAILABLE_MESSAGE });
    }

    return res.json({ msg: 'OTP sent to your registered email.', debugOtp });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ msg: 'Failed to send child access OTP.' });
  }
});

// @route   POST api/auth/child-access/verify
// @desc    Verify OTP and save child access request to resident record
// @access  Private
router.post('/child-access/verify', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found.' });

    const childRows = normalizeChildren([req.body.child]);
    if (childRows.length === 0) {
      return res.status(400).json({ msg: 'Complete child information is required.' });
    }
    const child = childRows[0];
    const childCheck = validateChildren([child]);
    if (!childCheck.ok) {
      return res.status(400).json({ msg: childCheck.msg });
    }

    const otp = String(req.body.otp || '').trim();
    if (!otp) return res.status(400).json({ msg: 'OTP is required.' });

    const validOtp = await Otp.findOne({ email: user.email, otp });
    if (!validOtp) {
      return res.status(400).json({ msg: 'Invalid or expired OTP.' });
    }

    const existingChildren = Array.isArray(user.children) ? user.children.map((item) => ({
      _id: item._id,
      fullName: String(item.fullName || '').trim(),
      email: String(item.email || '').trim().toLowerCase(),
      birthDate: String(item.birthDate || '').trim(),
      relationship: String(item.relationship || 'Child').trim() || 'Child',
      status: String(item.status || 'pending').trim() || 'pending',
      reviewReason: String(item.reviewReason || '').trim(),
      reviewedAt: item.reviewedAt || null,
    })) : [];

    const nextChildren = [
      ...existingChildren.filter((item) => item.email !== child.email),
      { ...child, status: 'pending', reviewReason: '', reviewedAt: null },
    ];

    user.children = nextChildren;
    await user.save();
    await Otp.deleteOne({ _id: validOtp._id });

    await logSystemEvent({
      user: req.user.id,
      title: `Submitted child access request for ${child.fullName}`,
      type: 'child-access',
      metadata: { module: 'child-access', action: 'submit', childEmail: child.email, status: 'pending' },
    });

    const adminRecipients = await getAdminNotificationRecipients();
    if (adminRecipients.length > 0) {
      const parentName = [user.firstName, user.lastName].filter(Boolean).join(' ');
      await sendUserMail({
        to: adminRecipients.join(','),
        subject: `New Child Access Request: ${child.fullName}`,
        html: childAccessSubmittedHtml({ parentName, child }),
        text: `New child access request pending review.\nParent: ${parentName || 'Resident'}\nChild: ${child.fullName}\nChild Email: ${child.email}\nStatus: pending`,
      });
    }

    return res.json({ msg: 'Child access request submitted and is now pending barangay approval.', children: user.children });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ msg: 'Failed to verify child access request.' });
  }
});

// @route   POST api/auth/child-session/request-otp
// @desc    Send OTP to parent email before child session profile update
// @access  Private
router.post('/child-session/request-otp', auth, async (req, res) => {
  try {
    if (!req.user.actingChild?.id) {
      return res.status(403).json({ msg: 'Only child-session users can request this update.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found.' });

    const child = user.children.id(req.user.actingChild.id);
    if (!child || child.status !== 'approved') {
      return res.status(404).json({ msg: 'Approved child session not found.' });
    }

    const nextFullName = String(req.body.fullName || '').trim();
    const nextEmail = String(req.body.email || '').trim().toLowerCase();
    const nextAvatarImage = normalizeOptionalImageDataUrl(req.body.avatarImage, 'Child profile photo');
    if (!nextFullName || !nextEmail) {
      return res.status(400).json({ msg: 'Child name and email are required.' });
    }
    const childNameError = personNameError(nextFullName, 'Child name');
    if (childNameError) {
      return res.status(400).json({ msg: childNameError });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return res.status(400).json({ msg: 'Enter a valid child email address.' });
    }

    const existingUser = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
    if (existingUser) {
      return res.status(400).json({ msg: 'That email is already used by another account.' });
    }
    const duplicateChild = (user.children || []).find((item) => String(item._id) !== String(child._id) && String(item.email || '').toLowerCase() === nextEmail);
    if (duplicateChild) {
      return res.status(400).json({ msg: 'That email is already used by another linked child.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { email: user.email },
      { email: user.email, otp },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    const parentName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const otpMail = {
      firstName: user.firstName,
      title: 'Child Profile Update OTP',
      intro: 'Use this one-time password to confirm the child session profile update.',
      otp,
      label: 'Child Profile OTP',
      details: [
        { label: 'Parent', value: parentName || 'Resident' },
        { label: 'Child Full Name', value: nextFullName },
        { label: 'Child Email', value: nextEmail },
        ...(nextAvatarImage ? [{ label: 'Profile Photo', value: 'New child profile photo selected' }] : []),
      ],
    };
    const { sent, debugOtp } = await sendOtpMailWithFallback({
      to: user.email,
      subject: 'Confirm Child Profile Update (BayanTrack OTP)',
      html: otpNoticeHtml(otpMail),
      text: otpNoticeText(otpMail),
      otp,
      context: 'child-session-otp',
    });

    if (!sent) {
      await Otp.deleteOne({ email: user.email });
      return res.status(503).json({ msg: OTP_EMAIL_UNAVAILABLE_MESSAGE });
    }

    return res.json({ msg: 'OTP sent to parent email.', debugOtp });
  } catch (err) {
    console.error(err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    return res.status(500).json({ msg: 'Failed to send child profile OTP.' });
  }
});

// @route   PUT api/auth/child-session/update
// @desc    Update the approved child session profile after parent OTP verification
// @access  Private
router.put('/child-session/update', auth, async (req, res) => {
  try {
    if (!req.user.actingChild?.id) {
      return res.status(403).json({ msg: 'Only child-session users can update this profile.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found.' });

    const child = user.children.id(req.user.actingChild.id);
    if (!child || child.status !== 'approved') {
      return res.status(404).json({ msg: 'Approved child session not found.' });
    }

    const nextFullName = String(req.body.fullName || '').trim();
    const nextEmail = String(req.body.email || '').trim().toLowerCase();
    const nextAvatarImage = normalizeOptionalImageDataUrl(req.body.avatarImage, 'Child profile photo');
    const otp = String(req.body.otp || '').trim();

    if (!nextFullName || !nextEmail) {
      return res.status(400).json({ msg: 'Child name and email are required.' });
    }
    const childNameError = personNameError(nextFullName, 'Child name');
    if (childNameError) {
      return res.status(400).json({ msg: childNameError });
    }
    if (!otp) {
      return res.status(400).json({ msg: 'OTP is required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return res.status(400).json({ msg: 'Enter a valid child email address.' });
    }

    const validOtp = await Otp.findOne({ email: user.email, otp });
    if (!validOtp) {
      return res.status(400).json({ msg: 'Invalid or expired OTP.' });
    }

    const existingUser = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
    if (existingUser) {
      return res.status(400).json({ msg: 'That email is already used by another account.' });
    }
    const duplicateChild = (user.children || []).find((item) => String(item._id) !== String(child._id) && String(item.email || '').toLowerCase() === nextEmail);
    if (duplicateChild) {
      return res.status(400).json({ msg: 'That email is already used by another linked child.' });
    }

    child.fullName = nextFullName;
    child.email = nextEmail;
    child.avatarImage = nextAvatarImage;
    await user.save();
    await Otp.deleteOne({ _id: validOtp._id });

    await logSystemEvent({
      user: req.user.id,
      type: 'child-profile-update',
      title: `Updated child session profile for ${nextFullName}`,
      referenceNo: child._id?.toString?.() || '',
      metadata: { module: 'child-access', action: 'update-profile', childEmail: nextEmail },
    });

    return res.json({
      msg: 'Child profile updated successfully.',
      actingChild: {
        id: child._id?.toString?.() || '',
        fullName: child.fullName || '',
        email: child.email || '',
        avatarImage: child.avatarImage || '',
      },
      children: user.children || [],
    });
  } catch (err) {
    console.error(err.message);
    if (err.statusCode) {
      return res.status(err.statusCode).json({ msg: err.message });
    }
    return res.status(500).json({ msg: 'Failed to update child session profile.' });
  }
});

// @route   POST api/auth/forgot-password
// @desc    Send OTP for password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ msg: "No account found with this email." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to DB
    await Otp.findOneAndUpdate(
      { email: normalizedEmail },
      { email: normalizedEmail, otp },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // Send Email
    const otpMail = {
      firstName: user.firstName,
      title: 'Forgot Password OTP',
      intro: 'Use this one-time password to reset your BayanTrack account password.',
      otp,
      label: 'Password Reset OTP',
    };
    const { sent, debugOtp } = await sendOtpMailWithFallback({
      to: normalizedEmail,
      subject: 'Password Reset OTP (BayanTrack)',
      html: otpNoticeHtml(otpMail),
      text: otpNoticeText(otpMail),
      otp,
      context: 'forgot-password-otp',
    });

    if (!sent) {
      await Otp.deleteOne({ email: normalizedEmail });
      return res.status(503).json({
        msg: OTP_EMAIL_UNAVAILABLE_MESSAGE,
      });
    }

    res.json({ msg: "OTP sent successfully", debugOtp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Failed to send email." });
  }
});

// @route   POST api/auth/reset-password
// @desc    Reset password with OTP
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    // Verify OTP
    const validOtp = await Otp.findOne({ email: normalizedEmail, otp });
    if (!validOtp) {
      return res.status(400).json({ msg: "Invalid or expired OTP" });
    }
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({ msg: 'Password must be at least 8 characters and include uppercase, lowercase, and 1 special character.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Delete used OTP
    await Otp.deleteOne({ _id: validOtp._id });

    await logSystemEvent({
      user: user._id,
      type: 'password-reset',
      title: `Password reset completed for ${user.username}`,
      referenceNo: user._id.toString(),
      metadata: { module: 'auth', action: 'reset-password' },
    });

    res.json({ msg: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
});

export default router;
