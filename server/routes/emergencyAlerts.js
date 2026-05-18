import express from 'express';
import mongoose from 'mongoose';
import EmergencyAlert from '../models/EmergencyAlert.js';
import User from '../models/User.js';
import { auth, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { logSystemEvent, resolveActorDetails } from '../utils/notifications.js';

const router = express.Router();
const ALERT_STATUSES = ['active', 'acknowledged', 'resolved', 'cancelled'];
const CHAT_MESSAGE_LIMIT = 200;
const CHAT_ATTACHMENT_LIMIT = 3;
const MAX_ATTACHMENT_DATA_URL_LENGTH = 6_500_000;

function normalizeSituation(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 240) || 'Emergency assistance requested';
}

function normalizeLocation(value = {}) {
  const lat = Number(value.lat ?? value.latitude);
  const lng = Number(value.lng ?? value.longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  return {
    lat,
    lng,
    accuracy: Number.isFinite(Number(value.accuracy)) ? Number(value.accuracy) : null,
    heading: Number.isFinite(Number(value.heading)) ? Number(value.heading) : null,
    speed: Number.isFinite(Number(value.speed)) ? Number(value.speed) : null,
    at: value.at ? new Date(value.at) : new Date(),
  };
}

function calculateAge(birthDate) {
  if (!birthDate) return '';
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? String(age) : '';
}

function fullName(user) {
  return [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ').trim();
}

function residentSnapshot(user, actingChild) {
  const childAge = actingChild?.birthDate ? calculateAge(actingChild.birthDate) : '';
  const childName = actingChild?.fullName || '';
  return {
    userId: String(user?._id || ''),
    username: user?.username || '',
    fullName: childName || fullName(user) || user?.username || 'Resident',
    email: actingChild?.email || user?.email || '',
    contactNumber: user?.contactNumber || '',
    age: childAge || 'Not recorded',
    address: user?.address || '',
  };
}

async function writeAlertEvent({ userId, type, title, referenceNo, metadata = {}, notifySuperadmin = true }) {
  await logSystemEvent({
    user: userId,
    type,
    title,
    referenceNo,
    metadata: {
      module: 'emergency-alerts',
      ...metadata,
    },
    notifySuperadmin,
  });
}

function isStaffUser(userPayload = {}) {
  return ['admin', 'superadmin'].includes(userPayload.role);
}

function normalizeChatMessage(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function normalizeChatAttachments(value = []) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, CHAT_ATTACHMENT_LIMIT).map((item) => {
    const dataUrl = String(item?.dataUrl || '');
    const type = String(item?.type || '').slice(0, 120);
    if (!dataUrl.startsWith('data:') || dataUrl.length > MAX_ATTACHMENT_DATA_URL_LENGTH) return null;
    if (!type.startsWith('image/') && !type.startsWith('video/')) return null;
    return {
      name: String(item?.name || 'attachment').replace(/\s+/g, ' ').trim().slice(0, 160),
      type,
      size: Number.isFinite(Number(item?.size)) ? Number(item.size) : 0,
      dataUrl,
    };
  }).filter(Boolean);
}

function freshTypingState(value = {}) {
  if (!value?.isTyping || !value?.at) return null;
  const typedAt = new Date(value.at);
  if (Number.isNaN(typedAt.getTime())) return null;
  if (Date.now() - typedAt.getTime() > 7000) return null;
  return {
    isTyping: true,
    name: value.name || '',
    role: value.role || '',
    at: typedAt,
  };
}

function alertChatPayload(alert) {
  const item = typeof alert.toObject === 'function' ? alert.toObject() : alert;
  return {
    alert: {
      _id: item._id,
      referenceNo: item.referenceNo,
      situation: item.situation,
      status: item.status,
      archived: item.archived,
      chatEndedAt: item.chatEndedAt,
      chatEndedByName: item.chatEndedByName,
      chatEndedByRole: item.chatEndedByRole,
      residentRating: item.residentRating,
      residentRatingComment: item.residentRatingComment,
      residentRatedAt: item.residentRatedAt,
      residentSnapshot: item.residentSnapshot,
      currentLocation: item.currentLocation,
      updatedAt: item.updatedAt,
    },
    messages: item.chatMessages || [],
    typing: {
      resident: freshTypingState(item.typing?.resident),
      staff: freshTypingState(item.typing?.staff),
    },
  };
}

async function findAccessibleAlert(req, res) {
  const alert = await EmergencyAlert.findById(req.params.id);
  if (!alert) {
    res.status(404).json({ msg: 'Live alert not found.' });
    return null;
  }

  const isOwner = String(alert.user) === String(req.user.id);
  if (!isOwner && !isStaffUser(req.user)) {
    res.status(403).json({ msg: 'Forbidden' });
    return null;
  }

  return alert;
}

async function getChatSender(req, alert) {
  if (isStaffUser(req.user)) {
    const actor = await resolveActorDetails(req.user);
    return {
      senderUser: String(actor.id || req.user.id || ''),
      senderRole: actor.role || req.user.role || 'staff',
      senderName: actor.name || 'Barangay Staff',
      typingKey: 'staff',
    };
  }

  const user = await User.findById(req.user.id).select('username firstName middleName lastName email').lean();
  const childName = req.user.actingChild?.fullName || '';
  const name = childName || fullName(user) || user?.username || alert.residentSnapshot?.fullName || 'Resident';
  return {
    senderUser: String(req.user.id || ''),
    senderRole: 'resident',
    senderName: name,
    typingKey: 'resident',
  };
}

router.post('/', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.user.id))) {
      return res.status(403).json({ msg: 'Live alerts must be sent from a resident account.' });
    }

    const user = await User.findById(req.user.id)
      .select('username firstName middleName lastName email contactNumber address status role')
      .lean();

    if (!user || user.status !== 'active') {
      return res.status(403).json({ msg: 'Your account must be active before sending a live alert.' });
    }

    const location = normalizeLocation(req.body.location);
    if (!location) {
      return res.status(400).json({ msg: 'Current location is required.' });
    }

    const referenceNo = makeReference('LIVE');
    const alert = await EmergencyAlert.create({
      user: user._id,
      referenceNo,
      situation: normalizeSituation(req.body.situation),
      residentSnapshot: residentSnapshot(user, req.user.actingChild),
      currentLocation: location,
      locationHistory: [location],
    });

    await writeAlertEvent({
      userId: req.user.id,
      type: 'emergency-alert',
      title: `Live emergency alert received: ${alert.situation}`,
      referenceNo: alert.referenceNo,
      metadata: {
        action: 'created',
        situation: alert.situation,
        residentUsername: alert.residentSnapshot.username,
      },
    });

    return res.status(201).json(alert);
  } catch (err) {
    console.error('Failed to create emergency alert:', err);
    return res.status(500).json({ msg: 'Failed to send live emergency alert.' });
  }
});

router.get('/', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const includeArchived = String(req.query.includeArchived || '').toLowerCase() === 'true';
    const query = {
      ...(ALERT_STATUSES.includes(status) ? { status } : {}),
      ...(includeArchived ? {} : { archived: { $ne: true } }),
    };
    const alerts = await EmergencyAlert.find(query).sort({ updatedAt: -1, createdAt: -1 }).limit(100).lean();
    return res.json(alerts);
  } catch (err) {
    console.error('Failed to fetch emergency alerts:', err);
    return res.status(500).json({ msg: 'Failed to fetch live emergency alerts.' });
  }
});

router.get('/:id/messages', auth, async (req, res) => {
  try {
    const alert = await findAccessibleAlert(req, res);
    if (!alert) return null;
    return res.json(alertChatPayload(alert));
  } catch (err) {
    console.error('Failed to fetch emergency alert chat:', err);
    return res.status(500).json({ msg: 'Failed to load live alert chat.' });
  }
});

router.post('/:id/messages', auth, async (req, res) => {
  try {
    const alert = await findAccessibleAlert(req, res);
    if (!alert) return null;

    if (!['active', 'acknowledged'].includes(alert.status) && !isStaffUser(req.user)) {
      return res.status(409).json({ msg: 'This live alert chat is already closed.' });
    }

    const message = normalizeChatMessage(req.body.message);
    const attachments = normalizeChatAttachments(req.body.attachments);
    if (!message && attachments.length === 0) {
      return res.status(400).json({ msg: 'Message or attachment is required.' });
    }

    const sender = await getChatSender(req, alert);
    alert.chatMessages.push({
      senderUser: sender.senderUser,
      senderRole: sender.senderRole,
      senderName: sender.senderName,
      message,
      attachments,
      createdAt: new Date(),
    });
    if (alert.chatMessages.length > CHAT_MESSAGE_LIMIT) {
      alert.chatMessages = alert.chatMessages.slice(-CHAT_MESSAGE_LIMIT);
    }
    alert.typing = alert.typing || {};
    alert.typing[sender.typingKey] = {
      isTyping: false,
      name: sender.senderName,
      role: sender.senderRole,
      at: new Date(),
    };
    await alert.save();

    await writeAlertEvent({
      userId: req.user.id,
      type: 'emergency-alert',
      title: `Live alert chat updated: ${alert.referenceNo}`,
      referenceNo: alert.referenceNo,
      metadata: { action: 'chat-message', situation: alert.situation },
      notifySuperadmin: isStaffUser(req.user) ? false : true,
    });

    return res.status(201).json(alertChatPayload(alert));
  } catch (err) {
    console.error('Failed to send emergency alert chat message:', err);
    return res.status(500).json({ msg: 'Failed to send live chat message.' });
  }
});

router.patch('/:id/end-chat', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ msg: 'Live alert not found.' });
    }

    const actor = await resolveActorDetails(req.user);
    const endedAt = new Date();
    const note = normalizeChatMessage(req.body.message)
      || `The live chat was ended by ${actor.role === 'superadmin' ? 'the superadmin' : 'barangay staff'}.`;

    alert.status = 'resolved';
    alert.chatEndedAt = endedAt;
    alert.chatEndedByName = actor.name;
    alert.chatEndedByRole = actor.role;
    alert.handledByName = actor.name;
    alert.handledByRole = actor.role;
    alert.handledByUser = mongoose.Types.ObjectId.isValid(String(actor.id)) ? actor.id : null;
    alert.handledAt = endedAt;
    alert.typing = alert.typing || {};
    alert.typing.resident = { isTyping: false, name: alert.typing?.resident?.name || '', role: 'resident', at: endedAt };
    alert.typing.staff = { isTyping: false, name: actor.name, role: actor.role, at: endedAt };
    alert.chatMessages.push({
      senderUser: String(actor.id || req.user.id || ''),
      senderRole: 'system',
      senderName: 'BayanTrack System',
      message: note,
      createdAt: endedAt,
    });
    if (alert.chatMessages.length > CHAT_MESSAGE_LIMIT) {
      alert.chatMessages = alert.chatMessages.slice(-CHAT_MESSAGE_LIMIT);
    }

    await alert.save();

    await writeAlertEvent({
      userId: req.user.id,
      type: 'emergency-alert',
      title: `Live emergency chat ended: ${alert.referenceNo}`,
      referenceNo: alert.referenceNo,
      metadata: { action: 'end-chat', situation: alert.situation },
    });

    return res.json(alertChatPayload(alert));
  } catch (err) {
    console.error('Failed to end emergency alert chat:', err);
    return res.status(500).json({ msg: 'Failed to end live chat.' });
  }
});

router.patch('/:id/rating', auth, async (req, res) => {
  try {
    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ msg: 'Live alert not found.' });
    }
    if (String(alert.user) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }
    if (!alert.chatEndedAt && alert.status !== 'resolved') {
      return res.status(409).json({ msg: 'You can rate this chat after it is resolved.' });
    }

    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ msg: 'Rating must be from 1 to 5.' });
    }

    alert.residentRating = rating;
    alert.residentRatingComment = String(req.body.comment || '').replace(/\s+/g, ' ').trim().slice(0, 800);
    alert.residentRatedAt = new Date();
    alert.chatMessages.push({
      senderUser: String(req.user.id || ''),
      senderRole: 'system',
      senderName: 'BayanTrack System',
      message: `Resident submitted a ${rating}/5 help rating${alert.residentRatingComment ? `: ${alert.residentRatingComment}` : '.'}`,
      createdAt: alert.residentRatedAt,
    });
    if (alert.chatMessages.length > CHAT_MESSAGE_LIMIT) {
      alert.chatMessages = alert.chatMessages.slice(-CHAT_MESSAGE_LIMIT);
    }
    await alert.save();

    await writeAlertEvent({
      userId: req.user.id,
      type: 'emergency-alert',
      title: `Resident rated live chat ${rating}/5: ${alert.referenceNo}`,
      referenceNo: alert.referenceNo,
      metadata: { action: 'rating', rating, situation: alert.situation },
    });

    return res.json(alertChatPayload(alert));
  } catch (err) {
    console.error('Failed to submit emergency alert rating:', err);
    return res.status(500).json({ msg: 'Failed to submit live chat rating.' });
  }
});

router.patch('/:id/typing', auth, async (req, res) => {
  try {
    const alert = await findAccessibleAlert(req, res);
    if (!alert) return null;

    const sender = await getChatSender(req, alert);
    const isTyping = req.body.isTyping !== false;
    alert.typing = alert.typing || {};
    alert.typing[sender.typingKey] = {
      isTyping,
      name: sender.senderName,
      role: sender.senderRole,
      at: new Date(),
    };
    await alert.save();
    return res.json(alertChatPayload(alert));
  } catch (err) {
    console.error('Failed to update emergency alert typing:', err);
    return res.status(500).json({ msg: 'Failed to update live chat typing status.' });
  }
});

router.patch('/:id/location', auth, async (req, res) => {
  try {
    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ msg: 'Live alert not found.' });
    }

    const isOwner = String(alert.user) === String(req.user.id);
    const isStaff = ['admin', 'superadmin'].includes(req.user.role);
    if (!isOwner && !isStaff) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    if (!['active', 'acknowledged'].includes(alert.status)) {
      return res.status(409).json({ msg: 'This live alert is no longer active.' });
    }

    const location = normalizeLocation(req.body.location);
    if (!location) {
      return res.status(400).json({ msg: 'Valid location is required.' });
    }

    alert.currentLocation = location;
    alert.locationHistory.push(location);
    if (alert.locationHistory.length > 240) {
      alert.locationHistory = alert.locationHistory.slice(-240);
    }
    await alert.save();

    return res.json(alert);
  } catch (err) {
    console.error('Failed to update emergency alert location:', err);
    return res.status(500).json({ msg: 'Failed to update live location.' });
  }
});

router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const alert = await EmergencyAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ msg: 'Live alert not found.' });
    }
    if (String(alert.user) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    alert.status = 'cancelled';
    alert.adminComment = String(req.body.reason || 'Live sharing stopped by resident.').slice(0, 400);
    await alert.save();

    await writeAlertEvent({
      userId: req.user.id,
      type: 'emergency-alert',
      title: `Live emergency alert cancelled: ${alert.referenceNo}`,
      referenceNo: alert.referenceNo,
      metadata: { action: 'cancelled', situation: alert.situation },
    });

    return res.json(alert);
  } catch (err) {
    console.error('Failed to cancel emergency alert:', err);
    return res.status(500).json({ msg: 'Failed to stop live location sharing.' });
  }
});

router.patch('/:id/status', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const status = String(req.body.status || '').trim();
    if (!ALERT_STATUSES.includes(status)) {
      return res.status(400).json({ msg: 'Invalid live alert status.' });
    }

    const actor = await resolveActorDetails(req.user);
    const handledAt = new Date();
    const alert = await EmergencyAlert.findByIdAndUpdate(
      req.params.id,
      {
        status,
        adminComment: String(req.body.adminComment || '').slice(0, 600),
        handledByName: actor.name,
        handledByRole: actor.role,
        handledByUser: mongoose.Types.ObjectId.isValid(String(actor.id)) ? actor.id : null,
        handledAt,
        ...(status === 'resolved' ? { 'typing.resident.isTyping': false, 'typing.staff.isTyping': false } : {}),
      },
      { returnDocument: 'after' },
    );

    if (!alert) {
      return res.status(404).json({ msg: 'Live alert not found.' });
    }

    await writeAlertEvent({
      userId: req.user.id,
      type: 'emergency-alert',
      title: `Live emergency alert marked ${status}: ${alert.referenceNo}`,
      referenceNo: alert.referenceNo,
      metadata: { action: status, situation: alert.situation },
    });

    return res.json(alert);
  } catch (err) {
    console.error('Failed to update emergency alert status:', err);
    return res.status(500).json({ msg: 'Failed to update live alert status.' });
  }
});

router.patch('/:id/archive', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const archived = req.body.archived !== false;
    const actor = await resolveActorDetails(req.user);
    const alert = await EmergencyAlert.findByIdAndUpdate(
      req.params.id,
      {
        archived,
        handledByName: actor.name,
        handledByRole: actor.role,
        handledByUser: mongoose.Types.ObjectId.isValid(String(actor.id)) ? actor.id : null,
        handledAt: new Date(),
      },
      { returnDocument: 'after' },
    );

    if (!alert) {
      return res.status(404).json({ msg: 'Live alert not found.' });
    }

    await writeAlertEvent({
      userId: req.user.id,
      type: 'emergency-alert',
      title: `${archived ? 'Archived' : 'Restored'} live emergency alert: ${alert.referenceNo}`,
      referenceNo: alert.referenceNo,
      metadata: { action: archived ? 'archive' : 'restore', situation: alert.situation },
    });

    return res.json(alert);
  } catch (err) {
    console.error('Failed to archive emergency alert:', err);
    return res.status(500).json({ msg: 'Failed to archive live alert.' });
  }
});

router.delete('/:id', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const alert = await EmergencyAlert.findByIdAndDelete(req.params.id);
    if (!alert) {
      return res.status(404).json({ msg: 'Live alert not found.' });
    }

    await writeAlertEvent({
      userId: req.user.id,
      type: 'emergency-alert',
      title: `Deleted live emergency alert: ${alert.referenceNo}`,
      referenceNo: alert.referenceNo,
      metadata: { action: 'delete', situation: alert.situation },
    });

    return res.json({ msg: 'Live alert deleted.' });
  } catch (err) {
    console.error('Failed to delete emergency alert:', err);
    return res.status(500).json({ msg: 'Failed to delete live alert.' });
  }
});

export default router;
