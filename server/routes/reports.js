import express from 'express';
import mongoose from 'mongoose';
import IssueReport from '../models/IssueReport.js';
import User from '../models/User.js';
import { auth, optionalAuth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { getAdminNotificationRecipients, logSystemEvent, publicHandlerLabel, resolveHandledByDetails, sendUserMail } from '../utils/notifications.js';

const router = express.Router();
const REPORT_STATUSES = ['new', 'in-review', 'resolved', 'rejected'];

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

function reportEmailHtml({ title, lines = [] }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#7f1d1d;color:#ffffff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack Report Update</h2>
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

async function notifyReportUpdate({ report, title, textTitle, actor, comment = '' }) {
  const publicHandler = actor ? publicHandlerLabel(actor) : '';
  const lines = [
    `<strong>Reference:</strong> ${report.referenceNo}`,
    `<strong>Category:</strong> ${report.category}`,
    `<strong>Status:</strong> ${report.status}`,
    `<strong>Reporter:</strong> ${report.fullName}`,
    publicHandler ? `<strong>Handled by:</strong> ${publicHandler}` : '',
    comment ? `<strong>Comment from the admins:</strong> ${comment}` : '',
  ];
  const text = [
    textTitle,
    `Reference: ${report.referenceNo}`,
    `Category: ${report.category}`,
    `Status: ${report.status}`,
    `Reporter: ${report.fullName}`,
    publicHandler ? `Handled by: ${publicHandler}` : '',
    comment ? `Comment from the admins: ${comment}` : '',
  ].filter(Boolean).join('\n');
  const recipients = await getAdminNotificationRecipients();

  if (recipients.length > 0) {
    await sendUserMail({
      to: recipients.join(','),
      subject: `BayanTrack Report ${report.referenceNo}: ${report.status}`,
      html: reportEmailHtml({ title, lines }),
      text,
    });
  }

  if (report.user) {
    const owner = await User.findById(report.user).select('email');
    if (owner?.email) {
      await sendUserMail({
        to: owner.email,
        subject: `Your BayanTrack Report ${report.referenceNo} Was Updated`,
        html: reportEmailHtml({ title: 'Your issue report was updated.', lines }),
        text,
      });
    }
  }
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const referenceNo = makeReference('RPT');
    const payload = {
      ...req.body,
      attachments: normalizeAttachments(req.body.attachments),
      referenceNo,
      user: mongoose.Types.ObjectId.isValid(String(req.user?.id || '')) ? req.user.id : null,
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

    await notifyReportUpdate({
      report,
      title: 'A new issue report was submitted.',
      textTitle: 'New issue report submitted.',
    });

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
    ['fullName', 'contactNumber', 'address', 'category', 'description', 'adminComment'].forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });
    if (req.body.status !== undefined) {
      if (!REPORT_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      update.status = req.body.status;
      update.adminChecked = req.body.status !== 'new';
    }
    if (req.body.attachments !== undefined) update.attachments = normalizeAttachments(req.body.attachments);

    const existing = await IssueReport.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'Report not found' });
    }
    const previousHandler = `${existing.handledByName || ''}|${existing.handledByRole || ''}|${existing.handledByUser || ''}`;
    const actor = await resolveHandledByDetails(req.user, req.body);
    update.handledByName = actor.name;
    update.handledByRole = actor.role;
    update.handledAt = new Date();
    update.handledByUser = mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null;

    const report = await IssueReport.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });

    await logSystemEvent({
      user: req.user.id,
      type: 'report-management',
      title: `Edited report ${report.referenceNo}`,
      referenceNo: report.referenceNo,
      metadata: { action: 'update', module: 'reports' },
    });
    const handlerChanged = previousHandler !== `${report.handledByName || ''}|${report.handledByRole || ''}|${report.handledByUser || ''}`;
    if ((update.status && existing.status !== update.status) || (update.adminComment !== undefined && existing.adminComment !== update.adminComment) || handlerChanged) {
      await notifyReportUpdate({
        report,
        title: `Report status was updated to ${report.status}.`,
        textTitle: `Report ${report.referenceNo} was updated to ${report.status}.`,
        actor,
        comment: report.adminComment || '',
      });
    }
    return res.json(report);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update report' });
  }
});

router.patch('/:id/status', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'edit'), async (req, res) => {
  try {
    const { status, adminChecked, adminComment } = req.body;
    if (status && !REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const update = {};
    if (status) update.status = status;
    if (typeof adminChecked === 'boolean') update.adminChecked = adminChecked;
    if (adminComment !== undefined) update.adminComment = String(adminComment || '').trim();

    const existing = await IssueReport.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'Report not found' });
    }
    const previousHandler = `${existing.handledByName || ''}|${existing.handledByRole || ''}|${existing.handledByUser || ''}`;
    const actor = await resolveHandledByDetails(req.user, req.body);
    update.handledByName = actor.name;
    update.handledByRole = actor.role;
    update.handledAt = new Date();
    update.handledByUser = mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null;

    const report = await IssueReport.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });

    await logSystemEvent({
      user: req.user.id,
      type: 'report-management',
      title: `Updated report ${report.referenceNo} to ${report.status}`,
      referenceNo: report.referenceNo,
      metadata: { action: report.status === 'rejected' ? 'archive' : 'update', module: 'reports' },
    });
    const handlerChanged = previousHandler !== `${report.handledByName || ''}|${report.handledByRole || ''}|${report.handledByUser || ''}`;
    if ((status && existing.status !== report.status) || (adminComment !== undefined && existing.adminComment !== report.adminComment) || handlerChanged) {
      await notifyReportUpdate({
        report,
        title: `Report status was updated to ${report.status}.`,
        textTitle: `Report ${report.referenceNo} was updated to ${report.status}.`,
        actor,
        comment: report.adminComment || '',
      });
    }
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
