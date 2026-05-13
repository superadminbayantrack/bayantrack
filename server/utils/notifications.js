import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';
import SystemSetting from '../models/SystemSetting.js';
import { getNotificationEmail, safeSendMail } from './mailer.js';
import mongoose from 'mongoose';
import { getEmbeddedAccountById } from '../config/embeddedAccounts.js';

function buildSystemEventHtml({ title, type, referenceNo, metadata }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#0f172a;color:#ffffff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack System Update</h2>
        <p style="margin:6px 0 0;font-size:12px;opacity:0.9;">Realtime admin notification</p>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 12px;font-weight:700;">${title}</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
          <p style="margin:0 0 8px;"><strong>Type:</strong> ${type || 'system'}</p>
          <p style="margin:0 0 8px;"><strong>Reference:</strong> ${referenceNo || 'N/A'}</p>
          <p style="margin:0;"><strong>Module:</strong> ${metadata?.module || 'general'}</p>
        </div>
      </div>
    </div>
  </div>`;
}

export async function resolveActorDetails(userPayload = {}) {
  const actorId = String(userPayload?.id || userPayload || '').trim();
  const embeddedAccount = actorId ? getEmbeddedAccountById(actorId) : null;

  if (embeddedAccount) {
    return {
      id: embeddedAccount.id,
      name: [embeddedAccount.firstName, embeddedAccount.lastName].filter(Boolean).join(' ') || embeddedAccount.username,
      role: embeddedAccount.role || 'staff',
    };
  }

  if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
    const user = await User.findById(actorId).select('firstName middleName lastName username role').lean();
    if (user) {
      const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();
      return {
        id: actorId,
        name: fullName || user.username || 'Barangay Staff',
        role: user.role || userPayload?.role || 'staff',
      };
    }
  }

  return {
    id: actorId || '',
    name: userPayload?.username || 'Barangay Staff',
    role: userPayload?.role || 'staff',
  };
}

export async function resolveHandledByDetails(userPayload = {}, body = {}) {
  const hasHandlerPayload =
    Object.prototype.hasOwnProperty.call(body || {}, 'handledByName') ||
    Object.prototype.hasOwnProperty.call(body || {}, 'handledByRole') ||
    Object.prototype.hasOwnProperty.call(body || {}, 'handledByUser');
  const selectedName = String(body?.handledByName || '').trim();
  const selectedRole = String(body?.handledByRole || '').trim();
  const selectedId = String(body?.handledByUser || '').trim();

  if (selectedName || selectedRole) {
    return {
      id: selectedId,
      name: selectedName || 'Assigned staff',
      role: selectedRole || 'staff',
    };
  }

  if (hasHandlerPayload) {
    return { id: '', name: '', role: '' };
  }

  return resolveActorDetails(userPayload);
}

export function publicHandlerLabel(handler = {}) {
  if (!handler?.name && !handler?.role) return '';
  const role = String(handler?.role || '').toLowerCase();
  if (role.includes('admin') || role.includes('superadmin')) return 'Admin';
  if (
    role.includes('official') ||
    role.includes('barangay') ||
    role.includes('kagawad') ||
    role.includes('captain') ||
    role.includes('tanod') ||
    role.includes('secretary') ||
    role.includes('treasurer') ||
    role.includes('staff')
  ) {
    return 'Barangay Official/Staff';
  }
  return 'Barangay Staff';
}

export async function logSystemEvent({
  user,
  type,
  title,
  referenceNo = '',
  metadata = {},
  notifySuperadmin = true,
}) {
  let created = null;
  try {
    const actorId = user ? String(user) : '';
    const embeddedAccount = actorId ? getEmbeddedAccountById(actorId) : null;
    const hasMongoActor = actorId && mongoose.Types.ObjectId.isValid(actorId);
    created = await ActivityLog.create({
      ...(hasMongoActor ? { user: actorId } : {}),
      actorName: embeddedAccount?.username || metadata.actorName || (hasMongoActor ? '' : actorId || 'system'),
      actorRole: embeddedAccount?.role || metadata.actorRole || '',
      type,
      title,
      referenceNo,
      metadata: {
        ...metadata,
        ...(actorId && !hasMongoActor ? { actorId } : {}),
        ...(embeddedAccount ? { actorName: embeddedAccount.username, actorRole: embeddedAccount.role } : {}),
      },
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }

  if (notifySuperadmin) {
    const recipients = await getAdminNotificationRecipients();
    if (recipients.length > 0) {
      try {
        await safeSendMail({
          to: recipients.join(','),
          subject: `BayanTrack System Update: ${title}`,
          html: buildSystemEventHtml({ title, type, referenceNo, metadata }),
          text: `${title}\nType: ${type}\nReference: ${referenceNo || 'N/A'}\nModule: ${metadata?.module || 'general'}`,
        });
      } catch (err) {
        console.error('Failed to send system notification email:', err);
      }
    }
  }

  return created;
}

export async function sendUserMail(options) {
  try {
    return await safeSendMail(options);
  } catch (err) {
    console.error('Failed to send user email:', err);
    return false;
  }
}

export async function getAdminNotificationRecipients() {
  const settings = await SystemSetting.findOne()
    .select('emailDigest notificationRecipientMode')
    .lean();

  if (settings?.emailDigest === false) {
    return [];
  }

  const mode = ['all', 'superadmin', 'admin'].includes(settings?.notificationRecipientMode)
    ? settings.notificationRecipientMode
    : 'all';
  const roles = mode === 'superadmin'
    ? ['superadmin']
    : mode === 'admin'
      ? ['admin']
      : ['admin', 'superadmin'];

  const users = await User.find({
    role: { $in: roles },
    status: 'active',
    email: { $exists: true, $ne: '' },
  }).select('email');

  const fallbackEmail = mode === 'admin' ? '' : getNotificationEmail();
  const emails = Array.from(new Set([
    fallbackEmail,
    ...users.map((item) => String(item.email || '').trim()).filter(Boolean),
  ].filter(Boolean)));

  return emails;
}
