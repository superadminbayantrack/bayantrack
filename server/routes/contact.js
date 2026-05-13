import express from 'express';
import mongoose from 'mongoose';
import Department from '../models/Department.js';
import ContactMessage from '../models/ContactMessage.js';
import { auth, optionalAuth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { getAdminNotificationRecipients, logSystemEvent, sendUserMail } from '../utils/notifications.js';

const router = express.Router();
const MESSAGE_STATUSES = ['new', 'read', 'closed'];

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function messageEmailHtml({ title, lines = [] }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#0f766e;color:#ffffff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack Message Update</h2>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 12px;font-weight:700;">${title}</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
          ${lines.map((line) => `<p style="margin:0 0 8px;">${line}</p>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

async function notifyMessageUpdate({ message, title, textTitle }) {
  const lines = [
    `<strong>Reference:</strong> ${message.referenceNo}`,
    `<strong>Sender:</strong> ${message.name}`,
    `<strong>Department:</strong> ${message.department}`,
    `<strong>Status:</strong> ${message.status}`,
  ];
  const text = `${textTitle}\nReference: ${message.referenceNo}\nSender: ${message.name}\nDepartment: ${message.department}\nStatus: ${message.status}`;
  const adminRecipients = await getAdminNotificationRecipients();
  if (adminRecipients.length > 0) {
    await sendUserMail({
      to: adminRecipients.join(','),
      subject: `BayanTrack Message ${message.referenceNo}: ${message.status}`,
      html: messageEmailHtml({ title, lines }),
      text,
    });
  }
  if (looksLikeEmail(message.contact)) {
    await sendUserMail({
      to: String(message.contact).trim(),
      subject: `Your BayanTrack Message ${message.referenceNo} Was Updated`,
      html: messageEmailHtml({ title: 'Your message status was updated.', lines }),
      text,
    });
  }
}

router.get('/departments', async (_req, res) => {
  try {
    const departments = await Department.find({ active: true }).sort({ name: 1 }).lean();
    return res.json(departments);
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch departments' });
  }
});

router.post('/departments', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const dept = await Department.create(req.body);
    await logSystemEvent({
      user: req.user.id,
      type: 'department-management',
      title: `Created department ${dept.name}`,
      referenceNo: dept._id.toString(),
      metadata: { action: 'create', module: 'departments' },
    });
    return res.status(201).json(dept);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to create department' });
  }
});

router.put('/departments/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const updated = await Department.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!updated) {
      return res.status(404).json({ msg: 'Department not found' });
    }
    await logSystemEvent({
      user: req.user.id,
      type: 'department-management',
      title: `Updated department ${updated.name}`,
      referenceNo: updated._id.toString(),
      metadata: { action: 'update', module: 'departments' },
    });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to update department' });
  }
});

router.delete('/departments/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const deleted = await Department.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ msg: 'Department not found' });
    }
    await logSystemEvent({
      user: req.user.id,
      type: 'department-management',
      title: `Deleted department ${deleted.name}`,
      referenceNo: deleted._id.toString(),
      metadata: { action: 'delete', module: 'departments' },
    });
    return res.json({ msg: 'Department removed' });
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to delete department' });
  }
});

router.post('/messages', optionalAuth, async (req, res) => {
  try {
    const referenceNo = makeReference('MSG');
    const message = await ContactMessage.create({
      ...req.body,
      referenceNo,
      user: mongoose.Types.ObjectId.isValid(String(req.user?.id || '')) ? req.user.id : null,
    });

    if (req.user?.id) {
      await logSystemEvent({
        user: req.user.id,
        type: 'contact-message',
        title: `Sent message to ${message.department}`,
        referenceNo,
        metadata: { module: 'messages', action: 'create' },
      });
    }

    await notifyMessageUpdate({
      message,
      title: 'A new contact message was submitted.',
      textTitle: 'New contact message submitted.',
    });

    return res.status(201).json(message);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to send message' });
  }
});

router.get('/messages', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 }).lean();
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch messages' });
  }
});

router.patch('/messages/:id/status', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('messages', 'edit'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!MESSAGE_STATUSES.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' });
    if (!updated) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'message-management',
      title: `Updated message ${updated.referenceNo} to ${status}`,
      referenceNo: updated.referenceNo,
      metadata: { action: status === 'closed' ? 'archive' : 'update', module: 'messages' },
    });
    await notifyMessageUpdate({
      message: updated,
      title: `Message status was updated to ${status}.`,
      textTitle: `Message ${updated.referenceNo} was updated to ${status}.`,
    });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to update message status' });
  }
});

router.put('/messages/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('messages', 'edit'), async (req, res) => {
  try {
    const update = {};
    ['name', 'contact', 'department', 'message', 'status'].forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });
    if (update.status && !MESSAGE_STATUSES.includes(update.status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const existing = await ContactMessage.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'Message not found' });
    }
    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });

    await logSystemEvent({
      user: req.user.id,
      type: 'message-management',
      title: `Edited message ${updated.referenceNo}`,
      referenceNo: updated.referenceNo,
      metadata: { action: 'update', module: 'messages' },
    });
    if (update.status && update.status !== existing.status) {
      await notifyMessageUpdate({
        message: updated,
        title: `Message status was updated to ${updated.status}.`,
        textTitle: `Message ${updated.referenceNo} was updated to ${updated.status}.`,
      });
    }
    return res.json(updated);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update message' });
  }
});

router.delete('/messages/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('messages', 'delete'), async (req, res) => {
  try {
    const deleted = await ContactMessage.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'message-management',
      title: `Deleted message ${deleted.referenceNo}`,
      referenceNo: deleted.referenceNo,
      metadata: { action: 'delete', module: 'messages' },
    });
    return res.json({ msg: 'Message deleted' });
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to delete message' });
  }
});

export default router;
