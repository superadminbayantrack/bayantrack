import express from 'express';
import mongoose from 'mongoose';
import Department from '../models/Department.js';
import ContactMessage from '../models/ContactMessage.js';
import { auth, optionalAuth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { getAdminNotificationRecipients, logSystemEvent, publicHandlerLabel, resolveHandledByDetails, sendUserMail } from '../utils/notifications.js';
import { cleanText, isValidContact, isValidEmail, personNameError, requireTextFields } from '../utils/validation.js';
import { paginatedPayload, parsePagination } from '../utils/pagination.js';

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
          ${lines.filter(Boolean).map((line) => `<p style="margin:0 0 8px;">${line}</p>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

async function notifyMessageUpdate({ message, title, textTitle, actor, comment = '' }) {
  const handler = actor ? publicHandlerLabel(actor) : '';
  const lines = [
    `<strong>Reference:</strong> ${message.referenceNo}`,
    `<strong>Sender:</strong> ${message.name}`,
    `<strong>Department:</strong> ${message.department}`,
    `<strong>Status:</strong> ${message.status}`,
    handler ? `<strong>Handled by:</strong> ${handler}` : '',
    comment ? `<strong>Comment from the admins:</strong> ${comment}` : '',
  ];
  const text = [
    textTitle,
    `Reference: ${message.referenceNo}`,
    `Sender: ${message.name}`,
    `Department: ${message.department}`,
    `Status: ${message.status}`,
    handler ? `Handled by: ${handler}` : '',
    comment ? `Comment from the admins: ${comment}` : '',
  ].filter(Boolean).join('\n');
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
    const name = cleanText(req.body.name, { max: 120 });
    if (!name) return res.status(400).json({ msg: 'Department name is required.' });
    const contactPersonError = personNameError(req.body.contactPerson, 'Contact person');
    if (contactPersonError) {
      return res.status(400).json({ msg: contactPersonError });
    }
    if (req.body.email && !isValidEmail(req.body.email)) {
      return res.status(400).json({ msg: 'Department email must be valid.' });
    }
    const dept = await Department.create({
      ...req.body,
      name,
      email: cleanText(req.body.email, { max: 254 }),
      phone: cleanText(req.body.phone, { max: 40 }),
      localNumber: cleanText(req.body.localNumber, { max: 30 }),
      contactPerson: cleanText(req.body.contactPerson, { max: 120 }),
    });
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
    const update = {
      ...req.body,
      ...(req.body.name !== undefined ? { name: cleanText(req.body.name, { max: 120 }) } : {}),
      ...(req.body.email !== undefined ? { email: cleanText(req.body.email, { max: 254 }) } : {}),
      ...(req.body.phone !== undefined ? { phone: cleanText(req.body.phone, { max: 40 }) } : {}),
      ...(req.body.localNumber !== undefined ? { localNumber: cleanText(req.body.localNumber, { max: 30 }) } : {}),
      ...(req.body.contactPerson !== undefined ? { contactPerson: cleanText(req.body.contactPerson, { max: 120 }) } : {}),
    };
    if (update.contactPerson !== undefined) {
      const contactPersonError = personNameError(update.contactPerson, 'Contact person');
      if (contactPersonError) {
        return res.status(400).json({ msg: contactPersonError });
      }
    }
    if (update.email && !isValidEmail(update.email)) {
      return res.status(400).json({ msg: 'Department email must be valid.' });
    }
    const updated = await Department.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
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
    const missing = requireTextFields(req.body, ['name', 'contact', 'department', 'message']);
    if (missing) return res.status(400).json({ msg: missing });
    const nameError = personNameError(req.body.name, 'Name');
    if (nameError) {
      return res.status(400).json({ msg: nameError });
    }
    if (!isValidContact(req.body.contact)) {
      return res.status(400).json({ msg: 'Contact must be a valid email address or 09XXXXXXXXX mobile number.' });
    }
    const messageBody = cleanText(req.body.message, { max: 2000 });
    if (messageBody.length < 10) {
      return res.status(400).json({ msg: 'Message must be at least 10 characters long.' });
    }
    const referenceNo = makeReference('MSG');
    const message = await ContactMessage.create({
      name: cleanText(req.body.name, { max: 120 }),
      contact: cleanText(req.body.contact, { max: 254 }),
      department: cleanText(req.body.department, { max: 120 }),
      message: messageBody,
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
    const query = {};
    const status = cleanText(req.query.status, { max: 40 });
    const search = cleanText(req.query.search, { max: 120 });
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
      ];
    }
    const { enabled, page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const messageQuery = ContactMessage.find(query).sort({ createdAt: -1 });
    if (enabled) messageQuery.skip(skip).limit(limit);
    const messages = await messageQuery.lean();
    if (enabled) {
      const total = await ContactMessage.countDocuments(query);
      return res.json(paginatedPayload({ items: messages, total, page, limit }));
    }
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch messages' });
  }
});

router.patch('/messages/:id/status', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('messages', 'edit'), async (req, res) => {
  try {
    const { status, adminComment } = req.body;
    if (!MESSAGE_STATUSES.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const actor = await resolveHandledByDetails(req.user, req.body);
    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, {
      status,
      ...(adminComment !== undefined ? { adminComment: String(adminComment || '').trim() } : {}),
      handledByName: actor.name,
      handledByRole: actor.role,
      handledAt: new Date(),
      handledByUser: mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null,
    }, { returnDocument: 'after' });
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
      actor,
      comment: updated.adminComment || '',
    });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to update message status' });
  }
});

router.put('/messages/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('messages', 'edit'), async (req, res) => {
  try {
    const update = {};
    ['name', 'contact', 'department', 'message', 'status', 'adminComment'].forEach((key) => {
      if (req.body[key] !== undefined) update[key] = typeof req.body[key] === 'string' ? cleanText(req.body[key], { max: key === 'message' ? 2000 : 500 }) : req.body[key];
    });
    if (update.name !== undefined) {
      const nameError = personNameError(update.name, 'Name');
      if (nameError) {
        return res.status(400).json({ msg: nameError });
      }
    }
    if (update.contact && !isValidContact(update.contact)) {
      return res.status(400).json({ msg: 'Contact must be a valid email address or 09XXXXXXXXX mobile number.' });
    }
    if (update.message !== undefined && String(update.message).length < 10) {
      return res.status(400).json({ msg: 'Message must be at least 10 characters long.' });
    }
    if (update.status && !MESSAGE_STATUSES.includes(update.status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const existing = await ContactMessage.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'Message not found' });
    }
    const previousHandler = `${existing.handledByName || ''}|${existing.handledByRole || ''}|${existing.handledByUser || ''}`;
    const actor = await resolveHandledByDetails(req.user, req.body);
    update.handledByName = actor.name;
    update.handledByRole = actor.role;
    update.handledAt = new Date();
    update.handledByUser = mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null;
    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });

    await logSystemEvent({
      user: req.user.id,
      type: 'message-management',
      title: `Edited message ${updated.referenceNo}`,
      referenceNo: updated.referenceNo,
      metadata: { action: 'update', module: 'messages' },
    });
    const handlerChanged = previousHandler !== `${updated.handledByName || ''}|${updated.handledByRole || ''}|${updated.handledByUser || ''}`;
    if ((update.status && update.status !== existing.status) || (update.adminComment !== undefined && update.adminComment !== existing.adminComment) || handlerChanged) {
      await notifyMessageUpdate({
        message: updated,
        title: `Message status was updated to ${updated.status}.`,
        textTitle: `Message ${updated.referenceNo} was updated to ${updated.status}.`,
        actor,
        comment: updated.adminComment || '',
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
