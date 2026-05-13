import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import User from '../models/User.js';
import ActivityLog from '../models/ActivityLog.js';
import ServiceRequest from '../models/ServiceRequest.js';
import IssueReport from '../models/IssueReport.js';
import ContactMessage from '../models/ContactMessage.js';
import Announcement from '../models/Announcement.js';
import Subscription from '../models/Subscription.js';
import SystemSetting from '../models/SystemSetting.js';
import { auth, requireRoles } from '../middleware/auth.js';
import { logSystemEvent, sendUserMail } from '../utils/notifications.js';
import { isReservedEmbeddedIdentity } from '../config/embeddedAccounts.js';

const router = express.Router();
const DAILY_ACTIVITY_DIR = path.join(os.tmpdir(), 'bayantrack-daily-activity');
const DEFAULT_ADMIN_PERMISSIONS = {
  officials: { view: true, add: true, edit: true, archive: true, delete: true },
  announcements: { view: true, add: true, edit: true, archive: true, delete: true },
  reports: { view: true, add: true, edit: true, archive: true, delete: true },
  serviceRequests: { view: true, add: true, edit: true, archive: true, delete: true },
  messages: { view: true, add: true, edit: true, archive: true, delete: true },
  subscribers: { view: true, add: true, edit: true, archive: true, delete: true },
};

function getManilaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function resolveDailyActivityRange(value) {
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? String(value)
    : getManilaDateKey();
  const start = new Date(`${dateKey}T00:00:00.000+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateKey, start, end };
}

function serializeActivityLog(a) {
  return {
    _id: a._id,
    type: a.type,
    title: a.title,
    referenceNo: a.referenceNo,
    createdAt: a.createdAt,
    userId: a.user?._id || a.metadata?.actorId || null,
    userName: a.user?.username || a.actorName || a.metadata?.actorName || 'system',
    userRole: a.user?.role || a.actorRole || a.metadata?.actorRole || 'system',
    metadata: a.metadata || {},
  };
}

function activityActorQuery(userId) {
  const id = String(userId || '');
  return mongoose.Types.ObjectId.isValid(id) ? { user: id } : { 'metadata.actorId': id };
}

async function persistDailyActivitySnapshot(dateKey, rows) {
  try {
    await fs.mkdir(DAILY_ACTIVITY_DIR, { recursive: true });
    await fs.writeFile(
      path.join(DAILY_ACTIVITY_DIR, `${dateKey}.json`),
      JSON.stringify({
        date: dateKey,
        timezone: 'Asia/Manila',
        refreshedAt: new Date().toISOString(),
        count: rows.length,
        items: rows,
      }, null, 2),
      'utf8',
    );
  } catch (err) {
    console.error('Failed to persist daily activity snapshot:', err);
  }
}

async function getOrCreateSettings() {
  let settings = await SystemSetting.findOne();
  if (!settings) {
    settings = await SystemSetting.create({});
  }
  return settings;
}

function composeUserAddress(addressDetails, fallback = '') {
  const details = addressDetails || {};
  const parts = [
    details.street,
    details.subdivision,
    details.barangay || 'Mambog II',
    details.city || 'Bacoor',
    details.province || 'Cavite',
    details.zipCode || '4102',
  ].map((item) => String(item || '').trim()).filter(Boolean);
  return fallback || parts.join(', ');
}

function buildUserFields(body, { includePassword = false } = {}) {
  const fields = {};
  [
    'username',
    'firstName',
    'middleName',
    'lastName',
    'email',
    'contactNumber',
    'address',
    'gender',
    'civilStatus',
    'validIdType',
    'validIdImage',
    'avatarImage',
    'marriageContractImage',
    'residentNote',
    'status',
    'validIdStatus',
  ].forEach((key) => {
    if (body[key] !== undefined) fields[key] = body[key];
  });
  if (body.addressDetails !== undefined) {
    fields.addressDetails = {
      blk: String(body.addressDetails?.blk || ''),
      lot: String(body.addressDetails?.lot || ''),
      street: String(body.addressDetails?.street || ''),
      subdivision: String(body.addressDetails?.subdivision || ''),
      barangay: 'Mambog II',
      city: 'Bacoor',
      province: 'Cavite',
      zipCode: '4102',
    };
    fields.address = composeUserAddress(fields.addressDetails, fields.address);
  }
  if (body.role && ['resident', 'admin', 'superadmin'].includes(body.role)) {
    fields.role = body.role;
    if (body.role === 'admin') fields.adminPermissions = DEFAULT_ADMIN_PERMISSIONS;
  }
  if (includePassword && body.password) fields.password = body.password;
  return fields;
}

function isResidentUsingStaffIdentity(fields = {}, existing = {}) {
  const nextRole = fields.role || existing.role || 'resident';
  if (nextRole !== 'resident') return false;

  return isReservedEmbeddedIdentity({
    username: fields.username ?? existing.username,
    email: fields.email ?? existing.email,
    contactNumber: fields.contactNumber ?? existing.contactNumber,
  });
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
          Your BayanTrack resident account has been approved. You can now log in and use the resident portal.
        </p>
        <p style="margin:0 0 12px;line-height:1.6;">
          By using the portal, please keep your account details private, submit only correct information,
          and use the services for barangay-related requests only. Your information is used to verify
          requests, contact you about updates, and help barangay staff respond properly.
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

function accountStatusUpdateHtml({ firstName, fullName, status, reason }) {
  const statusLabel = status === 'active'
    ? 'approved'
    : status === 'suspended'
      ? 'rejected / suspended'
      : 'returned to pending review';
  const reasonBlock = reason
    ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:12px 14px;margin:14px 0;">
          <p style="margin:0;font-size:12px;color:#9a3412;">Reason</p>
          <p style="margin:4px 0 0;font-weight:700;">${reason}</p>
       </div>`
    : '';
  return `
  <div style="font-family:Arial,sans-serif;background:#f6f8fc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:${status === 'active' ? '#166534' : status === 'suspended' ? '#991b1b' : '#92400e'};color:#fff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack - Mambog II</h2>
        <p style="margin:6px 0 0;font-size:12px;opacity:0.9;">Account Status Update</p>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 10px;">Hi <strong>${firstName || 'Resident'}</strong>,</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Your BayanTrack account was marked as <strong>${statusLabel}</strong>.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:14px 0;">
          <p style="margin:0;font-size:12px;color:#475569;">Account Name</p>
          <p style="margin:4px 0 0;font-weight:700;">${fullName || ''}</p>
        </div>
        ${reasonBlock}
        <p style="margin:0;color:#475569;">Thanks,<br/>BayanTrack Support Team</p>
      </div>
    </div>
  </div>
  `;
}

function childStatusUpdateHtml({ parentName, childName, status, reason }) {
  const statusLabel = status === 'approved' ? 'approved' : status === 'pending' ? 'returned to pending review' : 'rejected';
  const reasonBlock = reason
    ? `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:12px 14px;margin:14px 0;">
          <p style="margin:0;font-size:12px;color:#9a3412;">Reason</p>
          <p style="margin:4px 0 0;font-weight:700;">${reason}</p>
       </div>`
    : '';
  return `
  <div style="font-family:Arial,sans-serif;background:#f6f8fc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:${status === 'approved' ? '#166534' : status === 'pending' ? '#92400e' : '#991b1b'};color:#fff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack - Mambog II</h2>
        <p style="margin:6px 0 0;font-size:12px;opacity:0.9;">Child Access Request Update</p>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 10px;">Hi <strong>${parentName || 'Resident'}</strong>,</p>
        <p style="margin:0 0 12px;line-height:1.6;">
          The linked child access request for <strong>${childName}</strong> was <strong>${statusLabel}</strong>.
        </p>
        ${status === 'approved' ? `
        <p style="margin:0 0 12px;line-height:1.6;">
          The linked child may now access BayanTrack with your approval. To log in, the child should use
          the registered child email address and the parent account password. Once signed in, the child can
          request barangay services, contact the barangay office, and report an issue under the parent account.
        </p>
        <p style="margin:0 0 12px;line-height:1.6;">
          Please share the password only with the approved child and update it right away if you think
          someone else knows it. By using the account, both parent and child agree to provide accurate
          information, use the portal responsibly, and allow barangay staff to use submitted details only
          for verification, service processing, updates, and official response.
        </p>` : ''}
        ${reasonBlock}
        <p style="margin:0;color:#475569;">Thanks,<br/>BayanTrack Support Team</p>
      </div>
    </div>
  </div>
  `;
}

router.get('/users', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const query = {};
    const roleFilter = String(req.query.role || '').trim().toLowerCase();
    const approvalFilter = String(req.query.approval || '').trim().toLowerCase();

    if (roleFilter) {
      query.role = roleFilter === 'user' ? 'resident' : roleFilter;
    }

    if (approvalFilter === 'approved') {
      query.status = 'active';
    } else if (approvalFilter === 'not-approved') {
      query.status = { $ne: 'active' };
    }

    const users = await User.find(query)
      .select('-password -validIdImage -avatarImage -marriageContractImage')
      .sort({ createdAt: -1 })
      .lean();
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch users' });
  }
});

router.get('/users/:id', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    return res.json(user);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to fetch user details' });
  }
});

router.post('/users', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const required = ['username', 'firstName', 'lastName', 'email', 'contactNumber', 'password'];
    const missing = required.filter((key) => !String(req.body[key] || '').trim());
    if (missing.length > 0) {
      return res.status(400).json({ msg: `${missing.join(', ')} required` });
    }

    const duplicate = await User.findOne({
      $or: [
        { username: req.body.username },
        { email: String(req.body.email || '').toLowerCase().trim() },
        { contactNumber: req.body.contactNumber },
      ],
    });
    if (duplicate) {
      return res.status(400).json({ msg: 'Username, email, or contact number already exists.' });
    }

    const fields = buildUserFields(req.body, { includePassword: true });
    fields.email = String(fields.email || '').toLowerCase().trim();
    fields.address = fields.address || composeUserAddress(fields.addressDetails, 'Mambog II, Bacoor, Cavite 4102');
    fields.status = fields.status || 'active';
    fields.validIdStatus = fields.validIdStatus || (fields.status === 'active' ? 'approved' : 'pending');

    if (isResidentUsingStaffIdentity(fields)) {
      return res.status(400).json({ msg: 'These login details are reserved for barangay staff. Use a different resident email, username, or contact number.' });
    }

    const salt = await bcrypt.genSalt(10);
    fields.password = await bcrypt.hash(fields.password, salt);

    const user = await User.create(fields);
    await logSystemEvent({
      user: req.user.id,
      type: 'user-management',
      title: `Created user ${user.username}`,
      referenceNo: user._id.toString(),
      metadata: { action: 'create', module: 'users', targetRole: user.role },
    });
    const payload = user.toObject();
    delete payload.password;
    return res.status(201).json(payload);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to create user' });
  }
});

router.put('/users/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const existing = await User.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'User not found' });
    }
    if (existing.role === 'superadmin' && existing.username === 'superAdmin123' && req.body.role && req.body.role !== 'superadmin') {
      return res.status(400).json({ msg: 'Protected superadmin role cannot be changed.' });
    }

    const fields = buildUserFields(req.body, { includePassword: Boolean(req.body.password) });
    if (fields.email) fields.email = String(fields.email).toLowerCase().trim();
    if (fields.status && req.body.validIdStatus === undefined) {
      if (fields.status === 'active') fields.validIdStatus = 'approved';
      if (fields.status === 'pending') fields.validIdStatus = 'pending';
      if (fields.status === 'suspended') fields.validIdStatus = 'rejected';
    }

    if (isResidentUsingStaffIdentity(fields, existing)) {
      return res.status(400).json({ msg: 'These login details are reserved for barangay staff. Use a different resident email, username, or contact number.' });
    }

    const uniqueClauses = [];
    if (fields.username && fields.username !== existing.username) uniqueClauses.push({ username: fields.username });
    if (fields.email && fields.email !== existing.email) uniqueClauses.push({ email: fields.email });
    if (fields.contactNumber && fields.contactNumber !== existing.contactNumber) uniqueClauses.push({ contactNumber: fields.contactNumber });
    if (uniqueClauses.length > 0) {
      const duplicate = await User.findOne({ _id: { $ne: existing._id }, $or: uniqueClauses });
      if (duplicate) {
        return res.status(400).json({ msg: 'Username, email, or contact number already exists.' });
      }
    }

    if (fields.password) {
      const salt = await bcrypt.genSalt(10);
      fields.password = await bcrypt.hash(fields.password, salt);
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: fields }, { returnDocument: 'after' }).select('-password');
    await logSystemEvent({
      user: req.user.id,
      type: 'user-management',
      title: `Edited user ${user.username}`,
      referenceNo: user._id.toString(),
      metadata: { action: 'update', module: 'users', targetRole: user.role },
    });
    return res.json(user);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update user' });
  }
});

router.patch('/users/:id/status', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, role, validIdStatus, reason } = req.body;
    const update = {};
    const previousUser = await User.findById(req.params.id).select('-password');
    if (!previousUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (req.user.role === 'admin') {
      if (previousUser.role !== 'resident') {
        return res.status(403).json({ msg: 'Admins can only review resident accounts.' });
      }
      if (role && role !== previousUser.role) {
        return res.status(403).json({ msg: 'Admins cannot change user roles.' });
      }
    }

    if (status) update.status = status;
    if (role && ['resident', 'admin', 'superadmin'].includes(role)) update.role = role;
    if (role === 'admin') {
      update.adminPermissions = DEFAULT_ADMIN_PERMISSIONS;
    }
    if (validIdStatus && ['pending', 'approved', 'rejected'].includes(validIdStatus)) {
      update.validIdStatus = validIdStatus;
    }
    if ((status === 'active' || validIdStatus === 'approved') && isResidentUsingStaffIdentity(update, previousUser)) {
      return res.status(400).json({ msg: 'This resident account uses staff login details. Please change the resident email, username, or contact number before approval.' });
    }
    if (status === 'active') {
      update.validIdStatus = 'approved';
    }
    if (status === 'suspended') {
      update.validIdStatus = 'rejected';
    }
    if (status) {
      update.statusReason = String(reason || '').trim();
      update.statusReviewedAt = new Date();
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' }).select('-password');

    // When account is archived/suspended, also archive linked resident submissions.
    if (status === 'suspended') {
      await ServiceRequest.updateMany({ user: user._id }, { status: 'rejected' });
      await IssueReport.updateMany({ user: user._id }, { status: 'rejected', adminChecked: true, user: null });
      await ContactMessage.updateMany({ user: user._id }, { status: 'closed', user: null });
      await Subscription.updateMany({ createdBy: user._id }, { status: 'unsubscribed', createdBy: null });
      await Announcement.updateMany({ createdBy: user._id }, { createdBy: null });
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'user-management',
      title: `Updated user ${user.username} to ${status || user.status}`,
      referenceNo: user._id.toString(),
      metadata: { action: status === 'suspended' ? 'archive' : status === 'active' ? 'restore' : 'update', module: 'users', targetRole: user.role },
    });

    if (status === 'active' && previousUser.status !== 'active' && user.email) {
      try {
        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
        await sendUserMail({
          to: user.email,
          subject: 'Your BayanTrack Account Has Been Approved',
          html: accountApprovedHtml({ firstName: user.firstName, fullName }),
          text: `Hi ${user.firstName || 'Resident'}, your BayanTrack account has been approved. You can now log in.`,
        });
      } catch (mailErr) {
        console.error('Failed to send approval email:', mailErr);
      }
    } else if (status && previousUser.status !== status && user.email) {
      try {
        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
        await sendUserMail({
          to: user.email,
          subject: 'Your BayanTrack Account Status Was Updated',
          html: accountStatusUpdateHtml({ firstName: user.firstName, fullName, status, reason: update.statusReason || '' }),
          text: `Hi ${user.firstName || 'Resident'}, your BayanTrack account status was updated to ${status}.${update.statusReason ? ` Reason: ${update.statusReason}` : ''}`,
        });
      } catch (mailErr) {
        console.error('Failed to send status update email:', mailErr);
      }
    }

    return res.json(user);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to update user' });
  }
});

router.patch('/users/:id/children/:childId/status', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, reason } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(String(status || '').trim())) {
      return res.status(400).json({ msg: 'Invalid child request status.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (req.user.role === 'admin' && user.role !== 'resident') {
      return res.status(403).json({ msg: 'Admins can only review resident child requests.' });
    }

    const child = user.children.id(req.params.childId);
    if (!child) return res.status(404).json({ msg: 'Child request not found.' });

    child.status = status;
    child.reviewReason = String(reason || '').trim();
    child.reviewedAt = new Date();
    await user.save();

    await logSystemEvent({
      user: req.user.id,
      type: 'child-access',
      title: `${status === 'approved' ? 'Approved' : status === 'pending' ? 'Returned to pending' : 'Rejected'} child access for ${child.fullName}`,
      referenceNo: child._id.toString(),
      metadata: { module: 'users', action: status, parentUserId: user._id.toString() },
    });

    const parentName = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const html = childStatusUpdateHtml({ parentName, childName: child.fullName, status, reason: child.reviewReason || '' });
    const approvedGuide = status === 'approved'
      ? ' To log in, the child should use the registered child email address and the parent account password. The child can request barangay services, contact the barangay office, and report an issue under the parent account. Keep the password private and use the portal only for accurate barangay-related requests.'
      : '';
    const text = `Hi ${parentName || 'Resident'}, the child access request for ${child.fullName} was ${status}.${child.reviewReason ? ` Reason: ${child.reviewReason}` : ''}${approvedGuide}`;

    const recipients = [user.email, child.email].filter(Boolean);
    if (recipients.length > 0) {
      try {
        await sendUserMail({
          to: recipients.join(','),
          subject: `BayanTrack Child Access ${status === 'approved' ? 'Approved' : status === 'pending' ? 'Pending Review' : 'Rejected'}`,
          html,
          text,
        });
      } catch (mailErr) {
        console.error('Failed to send child status email:', mailErr);
      }
    }

    return res.json(user);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update child access status.' });
  }
});

router.delete('/users/:id/children/:childId', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (req.user.role === 'admin' && user.role !== 'resident') {
      return res.status(403).json({ msg: 'Admins can only manage resident child links.' });
    }

    const child = user.children.id(req.params.childId);
    if (!child) return res.status(404).json({ msg: 'Child link not found.' });
    const childName = child.fullName;

    child.deleteOne();
    await user.save();

    await logSystemEvent({
      user: req.user.id,
      type: 'child-access',
      title: `Removed child access link for ${childName}`,
      referenceNo: user._id.toString(),
      metadata: { module: 'users', action: 'delete-child-link' },
    });

    return res.json(user);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to remove child link.' });
  }
});

router.patch('/users/:id/permissions', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const { adminPermissions } = req.body;
    if (!adminPermissions || typeof adminPermissions !== 'object') {
      return res.status(400).json({ msg: 'adminPermissions payload is required.' });
    }

    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.role !== 'admin') {
      return res.status(400).json({ msg: 'Permissions can only be set for admin users.' });
    }

    user.adminPermissions = {
      ...DEFAULT_ADMIN_PERMISSIONS,
      ...adminPermissions,
      officials: { ...DEFAULT_ADMIN_PERMISSIONS.officials, ...(adminPermissions.officials || {}) },
      announcements: { ...DEFAULT_ADMIN_PERMISSIONS.announcements, ...(adminPermissions.announcements || {}) },
      reports: { ...DEFAULT_ADMIN_PERMISSIONS.reports, ...(adminPermissions.reports || {}) },
      serviceRequests: { ...DEFAULT_ADMIN_PERMISSIONS.serviceRequests, ...(adminPermissions.serviceRequests || {}) },
      messages: { ...DEFAULT_ADMIN_PERMISSIONS.messages, ...(adminPermissions.messages || {}) },
      subscribers: { ...DEFAULT_ADMIN_PERMISSIONS.subscribers, ...(adminPermissions.subscribers || {}) },
    };
    await user.save();
    await logSystemEvent({
      user: req.user.id,
      type: 'user-management',
      title: `Updated admin permissions for ${user.username}`,
      referenceNo: user._id.toString(),
      metadata: { action: 'permissions', module: 'users' },
    });
    return res.json(user);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update admin permissions' });
  }
});

router.delete('/users/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    if (user.role === 'superadmin' && user.username === 'superAdmin123') {
      return res.status(400).json({ msg: 'Protected superadmin account cannot be deleted.' });
    }

    if (user.email) {
      try {
        await sendUserMail({
          to: user.email,
          subject: 'Your BayanTrack Account Was Deleted',
          html: accountStatusUpdateHtml({
            firstName: user.firstName,
            fullName: [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' '),
            status: 'suspended',
            reason: 'Your account and linked records were permanently deleted by a barangay administrator.',
          }),
          text: `Hi ${user.firstName || 'Resident'}, your BayanTrack account and linked records were permanently deleted by a barangay administrator.`,
        });
      } catch (mailErr) {
        console.error('Failed to send account deletion email:', mailErr);
      }
    }

    await Promise.all([
      ServiceRequest.deleteMany({ user: user._id }),
      IssueReport.deleteMany({ user: user._id }),
      ContactMessage.deleteMany({ user: user._id }),
      ActivityLog.deleteMany({ user: user._id }),
      Subscription.deleteMany({ createdBy: user._id }),
      Announcement.updateMany({ createdBy: user._id }, { createdBy: null }),
      User.deleteOne({ _id: user._id }),
    ]);

    await logSystemEvent({
      user: req.user.id,
      type: 'user-management',
      title: `Deleted user ${user.username}`,
      referenceNo: user._id.toString(),
      metadata: { action: 'delete', module: 'users', targetRole: user.role },
    });

    return res.json({ msg: 'User and linked records deleted' });
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to delete user' });
  }
});

router.get('/activity/me', auth, async (req, res) => {
  try {
    const { dateKey, start, end } = resolveDailyActivityRange(req.query.date);
    const activities = await ActivityLog.find({
      ...activityActorQuery(req.user.id),
      createdAt: { $gte: start, $lt: end },
    })
      .sort({ createdAt: -1 })
      .limit(150)
      .populate('user', 'username role')
      .lean();

    const rows = activities.map(serializeActivityLog);
    return res.json({ date: dateKey, items: rows });
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch activity logs' });
  }
});

router.get('/activity', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const { dateKey, start, end } = resolveDailyActivityRange(req.query.date);
    const activities = await ActivityLog.find({ createdAt: { $gte: start, $lt: end } })
      .sort({ createdAt: -1 })
      .limit(150)
      .populate('user', 'username role')
      .lean();

    const rows = activities.map(serializeActivityLog);
    await persistDailyActivitySnapshot(dateKey, rows);

    return res.json({ date: dateKey, items: rows });
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch activity logs' });
  }
});

router.get('/notifications', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const { dateKey, start, end } = resolveDailyActivityRange(req.query.date);
    const activities = await ActivityLog.find({ createdAt: { $gte: start, $lt: end } })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user', 'username role')
      .lean();

    const items = activities.map(serializeActivityLog);
    await persistDailyActivitySnapshot(dateKey, items);

    return res.json({ date: dateKey, count: items.length, items });
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch notifications' });
  }
});

router.get('/system-settings', auth, requireRoles('admin', 'superadmin'), async (_req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return res.json(settings);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch system settings' });
  }
});

router.patch('/system-settings', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const allowed = [
      'autoArchiveReports',
      'requireAnnouncementReview',
      'emailDigest',
      'allowResidentRegistration',
      'maintenanceMode',
      'maintenanceMessage',
      'sessionTimeoutMinutes',
      'lockoutWindowMinutes',
      'developerOptionsEnabled',
      'notificationRecipientMode',
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    }

    const settings = await getOrCreateSettings();
    const updated = await SystemSetting.findByIdAndUpdate(
      settings._id,
      { $set: update },
      { returnDocument: 'after' },
    );
    await logSystemEvent({
      user: req.user.id,
      type: 'system-settings',
      title: 'Updated system settings',
      referenceNo: updated?._id?.toString?.() || '',
      metadata: { action: 'update', module: 'settings', fields: Object.keys(update) },
    });
    return res.json(updated);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update system settings' });
  }
});

export default router;
