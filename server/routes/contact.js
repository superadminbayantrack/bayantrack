import express from 'express';
import Department from '../models/Department.js';
import ContactMessage from '../models/ContactMessage.js';
import { auth, optionalAuth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { logSystemEvent } from '../utils/notifications.js';

const router = express.Router();

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
      user: req.user?.id || null,
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
    const allowed = ['new', 'read', 'closed'];
    if (!allowed.includes(status)) {
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
    if (update.status && !['new', 'read', 'closed'].includes(update.status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const updated = await ContactMessage.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!updated) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'message-management',
      title: `Edited message ${updated.referenceNo}`,
      referenceNo: updated.referenceNo,
      metadata: { action: 'update', module: 'messages' },
    });
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
