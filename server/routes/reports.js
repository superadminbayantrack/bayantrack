import express from 'express';
import IssueReport from '../models/IssueReport.js';
import { auth, optionalAuth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { logSystemEvent } from '../utils/notifications.js';

const router = express.Router();

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 3)
    .map((item) => ({
      name: String(item?.name || '').slice(0, 160),
      type: String(item?.type || '').slice(0, 80),
      size: Number(item?.size) || 0,
      dataUrl: String(item?.dataUrl || ''),
    }))
    .filter((item) => item.dataUrl.startsWith('data:image/'));
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const referenceNo = makeReference('RPT');
    const payload = {
      ...req.body,
      attachments: normalizeAttachments(req.body.attachments),
      referenceNo,
      user: req.user?.id || null,
    };

    const report = await IssueReport.create(payload);

    if (req.user?.id) {
      await logSystemEvent({
        user: req.user.id,
        type: 'issue-report',
        title: `Submitted issue report: ${report.category}`,
        referenceNo,
        metadata: { module: 'reports', action: 'create' },
      });
    }

    return res.status(201).json(report);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to submit report' });
  }
});

router.get('/', auth, requireRoles('admin', 'superadmin'), async (_req, res) => {
  try {
    const reports = await IssueReport.find().sort({ createdAt: -1 }).lean();
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch reports' });
  }
});

router.put('/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'edit'), async (req, res) => {
  try {
    const update = {};
    ['fullName', 'contactNumber', 'address', 'category', 'description'].forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });
    if (req.body.attachments !== undefined) update.attachments = normalizeAttachments(req.body.attachments);

    const report = await IssueReport.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'report-management',
      title: `Edited report ${report.referenceNo}`,
      referenceNo: report.referenceNo,
      metadata: { action: 'update', module: 'reports' },
    });
    return res.json(report);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update report' });
  }
});

router.patch('/:id/status', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'edit'), async (req, res) => {
  try {
    const { status, adminChecked } = req.body;

    if (req.user.role === 'admin' && status && status !== 'in-review') {
      return res.status(403).json({ msg: 'Admin can only move reports to in-review' });
    }

    const update = {};
    if (status) update.status = status;
    if (typeof adminChecked === 'boolean') update.adminChecked = adminChecked;

    const report = await IssueReport.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'report-management',
      title: `Updated report ${report.referenceNo} to ${report.status}`,
      referenceNo: report.referenceNo,
      metadata: { action: report.status === 'rejected' ? 'archive' : 'update', module: 'reports' },
    });
    return res.json(report);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to update report' });
  }
});

router.delete('/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'delete'), async (req, res) => {
  try {
    const deleted = await IssueReport.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ msg: 'Report not found' });
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'report-management',
      title: `Deleted report ${deleted.referenceNo}`,
      referenceNo: deleted.referenceNo,
      metadata: { action: 'delete', module: 'reports' },
    });
    return res.json({ msg: 'Report deleted' });
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to delete report' });
  }
});

export default router;
