import express from 'express';
import mongoose from 'mongoose';
import IssueReport from '../models/IssueReport.js';
import SeminarRequirement from '../models/SeminarRequirement.js';
import User from '../models/User.js';
import SystemSetting from '../models/SystemSetting.js';
import { auth, optionalAuth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { getAdminNotificationRecipients, logSystemEvent, publicHandlerLabel, resolveHandledByDetails, sendUserMail } from '../utils/notifications.js';
import { cleanText, isValidPhilippineMobile, personNameError, requireTextFields } from '../utils/validation.js';
import { paginatedPayload, parsePagination } from '../utils/pagination.js';

const router = express.Router();
const REPORT_STATUSES = [
  'new',
  'received',
  'in-review',
  'in-progress',
  'hearing-scheduled',
  'seminar-intervention-required',
  'seminar-completed',
  'missed-seminar',
  'failed-to-comply',
  're-scheduled',
  'for-resolution',
  'resolved',
  'dismissed',
  'closed',
  'rejected',
  'archived',
];
const REPORT_TYPES = ['community-issue', 'complaint', 'incident-report'];
const REPORT_PRIORITIES = ['low', 'normal', 'urgent'];
const CASE_CLOSING_STATUSES = ['resolved', 'dismissed', 'closed'];
const AUTO_ARCHIVE_RESOLVED_AFTER_DAYS = 7;
const MAX_REPORT_ATTACHMENT_DATA_URL_LENGTH = 3_000_000;

function normalizeReportType(value) {
  return REPORT_TYPES.includes(value) ? value : 'community-issue';
}

function normalizePriority(value) {
  return REPORT_PRIORITIES.includes(value) ? value : 'normal';
}

function normalizeLocation(value, fallbackAddress = '') {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return {
    address: cleanText(value?.address || fallbackAddress, { max: 300 }),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    note: cleanText(value?.note, { max: 240 }),
  };
}

function normalizeRelatedRecord(value, prefix) {
  const details = cleanText(value?.details, { max: 1000 });
  const status = cleanText(value?.status, { max: 80 });
  const referenceNo = cleanText(value?.referenceNo, { max: 80 }) || (details || status ? makeReference(prefix) : '');
  return {
    referenceNo,
    details,
    status,
    updatedAt: details || status || referenceNo ? new Date() : null,
  };
}

function normalizeHearingSchedule(value) {
  const date = cleanText(value?.date, { max: 40 });
  const time = cleanText(value?.time, { max: 40 });
  const venue = cleanText(value?.venue, { max: 180 });
  const remarks = cleanText(value?.remarks, { max: 1000 });
  const status = cleanText(value?.status || 'scheduled', { max: 80 });
  return {
    date,
    time,
    venue,
    remarks,
    status,
    updatedAt: date || time || venue || remarks ? new Date() : null,
  };
}

async function ensureCaseCanClose({ reportId, nextStatus, actor, overrideReason }) {
  if (!CASE_CLOSING_STATUSES.includes(nextStatus)) return { complianceResult: '', overrideReason: '' };
  const requirements = await SeminarRequirement.find({ relatedComplaintId: reportId })
    .select('status title referenceNumber')
    .lean();
  if (requirements.length === 0) return { complianceResult: 'No seminar/intervention required', overrideReason: '' };

  const incomplete = requirements.filter((item) => item.status !== 'Completed');
  if (incomplete.length === 0) {
    return { complianceResult: 'Completed', overrideReason: '' };
  }

  const reason = cleanText(overrideReason, { max: 800 });
  if (actor.role === 'superadmin' && reason) {
    return { complianceResult: `Overridden with ${incomplete.length} incomplete requirement(s)`, overrideReason: reason };
  }

  const label = incomplete.map((item) => `${item.referenceNumber || 'Requirement'} - ${item.status}`).join(', ');
  const error = new Error(`Cannot close this case yet. Complete the required seminar/intervention first: ${label}. Superadmin may override with a reason.`);
  error.statusCode = 409;
  throw error;
}

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
    .filter((item) => item.dataUrl.startsWith('data:image/') && item.dataUrl.length <= MAX_REPORT_ATTACHMENT_DATA_URL_LENGTH);
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
    `<strong>Type:</strong> ${report.reportType || 'community-issue'}`,
    `<strong>Category:</strong> ${report.category}`,
    `<strong>Priority:</strong> ${report.priority || 'normal'}`,
    `<strong>Status:</strong> ${report.status}`,
    `<strong>Reporter:</strong> ${report.fullName}`,
    report.hearingSchedule?.date ? `<strong>Hearing schedule:</strong> ${report.hearingSchedule.date} ${report.hearingSchedule.time || ''} at ${report.hearingSchedule.venue || 'barangay office'}` : '',
    publicHandler ? `<strong>Handled by:</strong> ${publicHandler}` : '',
    comment ? `<strong>Comment from the admins:</strong> ${comment}` : '',
  ];
  const text = [
    textTitle,
    `Reference: ${report.referenceNo}`,
    `Type: ${report.reportType || 'community-issue'}`,
    `Category: ${report.category}`,
    `Priority: ${report.priority || 'normal'}`,
    `Status: ${report.status}`,
    `Reporter: ${report.fullName}`,
    report.hearingSchedule?.date ? `Hearing schedule: ${report.hearingSchedule.date} ${report.hearingSchedule.time || ''} at ${report.hearingSchedule.venue || 'barangay office'}` : '',
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

async function autoArchiveResolvedReportsIfEnabled() {
  const settings = await SystemSetting.findOne().select('autoArchiveReports').lean();
  if (settings?.autoArchiveReports === false) return;

  const cutoff = new Date(Date.now() - AUTO_ARCHIVE_RESOLVED_AFTER_DAYS * 24 * 60 * 60 * 1000);
  await IssueReport.updateMany(
    {
      status: 'resolved',
      updatedAt: { $lt: cutoff },
    },
    {
      $set: {
        status: 'archived',
        adminChecked: true,
      },
    },
  );
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const missing = requireTextFields(req.body, ['fullName', 'contactNumber', 'address', 'category', 'description']);
    if (missing) return res.status(400).json({ msg: missing });
    const fullNameError = personNameError(req.body.fullName, 'Full name');
    if (fullNameError) {
      return res.status(400).json({ msg: fullNameError });
    }
    if (!isValidPhilippineMobile(req.body.contactNumber)) {
      return res.status(400).json({ msg: 'Contact number must be exactly 11 digits and start with 09.' });
    }
    const description = cleanText(req.body.description, { max: 3000 });
    if (description.length < 10) {
      return res.status(400).json({ msg: 'Description must be at least 10 characters long.' });
    }
    const referenceNo = makeReference('RPT');
    const payload = {
      fullName: cleanText(req.body.fullName, { max: 140 }),
      contactNumber: cleanText(req.body.contactNumber, { max: 20 }),
      address: cleanText(req.body.address, { max: 300 }),
      reportType: normalizeReportType(req.body.reportType),
      priority: normalizePriority(req.body.priority),
      category: cleanText(req.body.category, { max: 100 }),
      description,
      location: normalizeLocation(req.body.location, req.body.address),
      attachments: normalizeAttachments(req.body.attachments),
      referenceNo,
      user: mongoose.Types.ObjectId.isValid(String(req.user?.id || '')) ? req.user.id : null,
    };

    const report = await IssueReport.create(payload);

    if (req.user?.id) {
      await logSystemEvent({
        user: req.user.id,
        type: 'issue-report',
        title: `Submitted ${report.reportType}: ${report.category}`,
        referenceNo,
        metadata: { module: 'reports', action: 'create', priority: report.priority, reportType: report.reportType },
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

router.get('/', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    await autoArchiveResolvedReportsIfEnabled();
    const query = {};
    const status = cleanText(req.query.status, { max: 40 });
    const category = cleanText(req.query.category, { max: 80 });
    const reportType = cleanText(req.query.reportType, { max: 40 });
    const priority = cleanText(req.query.priority, { max: 40 });
    const search = cleanText(req.query.search, { max: 120 });
    if (status) query.status = status;
    if (category) query.category = category;
    if (REPORT_TYPES.includes(reportType)) query.reportType = reportType;
    if (REPORT_PRIORITIES.includes(priority)) query.priority = priority;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { referenceNo: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } },
      ];
    }
    const { enabled, page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    const reportQuery = IssueReport.find(query)
      .select('-attachments.dataUrl')
      .sort({ createdAt: -1 });
    if (enabled) reportQuery.skip(skip).limit(limit);
    const reports = await reportQuery.lean();
    if (enabled) {
      const total = await IssueReport.countDocuments(query);
      return res.json(paginatedPayload({ items: reports, total, page, limit }));
    }
    return res.json(reports);
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch reports' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.user.id || ''))) {
      return res.json([]);
    }
    const reports = await IssueReport.find({ user: req.user.id })
      .select('-attachments.dataUrl')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(50)
      .lean();
    return res.json(reports);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch your reports' });
  }
});

router.get('/:id', auth, requireRoles('admin', 'superadmin'), async (req, res) => {
  try {
    const report = await IssueReport.findById(req.params.id).lean();
    if (!report) {
      return res.status(404).json({ msg: 'Report not found' });
    }
    return res.json(report);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to fetch report details' });
  }
});

router.put('/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'edit'), async (req, res) => {
  try {
    const update = {};
    ['fullName', 'contactNumber', 'address', 'category', 'description', 'adminComment', 'assignedDepartment', 'assignedPersonnel'].forEach((key) => {
      if (req.body[key] !== undefined) update[key] = cleanText(req.body[key], { max: key === 'description' ? 3000 : 500 });
    });
    if (req.body.reportType !== undefined) update.reportType = normalizeReportType(req.body.reportType);
    if (req.body.priority !== undefined) update.priority = normalizePriority(req.body.priority);
    if (req.body.location !== undefined) update.location = normalizeLocation(req.body.location, update.address || req.body.address);
    if (update.fullName !== undefined) {
      const fullNameError = personNameError(update.fullName, 'Full name');
      if (fullNameError) {
        return res.status(400).json({ msg: fullNameError });
      }
    }
    if (update.contactNumber && !isValidPhilippineMobile(update.contactNumber)) {
      return res.status(400).json({ msg: 'Contact number must be exactly 11 digits and start with 09.' });
    }
    if (update.description !== undefined && String(update.description).length < 10) {
      return res.status(400).json({ msg: 'Description must be at least 10 characters long.' });
    }
    if (req.body.status !== undefined) {
      if (!REPORT_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      update.status = req.body.status;
      update.adminChecked = req.body.status !== 'new';
    }
    if (req.body.attachments !== undefined) {
      const normalizedAttachments = normalizeAttachments(req.body.attachments);
      if (normalizedAttachments.length > 0 || req.body.clearAttachments === true) {
        update.attachments = normalizedAttachments;
      }
    }
    if (req.body.blotterRecord !== undefined) update.blotterRecord = normalizeRelatedRecord(req.body.blotterRecord, 'BLOT');
    if (req.body.caseRecord !== undefined) update.caseRecord = normalizeRelatedRecord(req.body.caseRecord, 'CASE');
    if (req.body.hearingSchedule !== undefined) update.hearingSchedule = normalizeHearingSchedule(req.body.hearingSchedule);

    const existing = await IssueReport.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'Report not found' });
    }
    const previousHandler = `${existing.handledByName || ''}|${existing.handledByRole || ''}|${existing.handledByUser || ''}`;
    const actor = await resolveHandledByDetails(req.user, req.body);
    if (update.status) {
      const closureCheck = await ensureCaseCanClose({
        reportId: existing._id,
        nextStatus: update.status,
        actor,
        overrideReason: req.body.overrideReason,
      });
      if (CASE_CLOSING_STATUSES.includes(update.status)) {
        update.closure = {
          closedAt: new Date(),
          closedByUser: mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null,
          closedByName: actor.name,
          closedByRole: actor.role,
          reason: cleanText(req.body.closureReason || req.body.adminComment || 'Case reviewed and closed by barangay staff.', { max: 800 }),
          seminarComplianceResult: closureCheck.complianceResult,
          overrideReason: closureCheck.overrideReason,
          finalRemarks: cleanText(req.body.finalRemarks || req.body.adminComment, { max: 1000 }),
        };
      }
    }
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
      metadata: {
        action: update.hearingSchedule?.date ? 'hearing-schedule' : 'update',
        module: 'reports',
        reportType: report.reportType,
        hearingSchedule: update.hearingSchedule?.date ? update.hearingSchedule : undefined,
      },
    });
    const handlerChanged = previousHandler !== `${report.handledByName || ''}|${report.handledByRole || ''}|${report.handledByUser || ''}`;
    const hearingChanged = update.hearingSchedule?.date && JSON.stringify(existing.hearingSchedule || {}) !== JSON.stringify(update.hearingSchedule || {});
    if ((update.status && existing.status !== update.status) || (update.adminComment !== undefined && existing.adminComment !== update.adminComment) || handlerChanged || hearingChanged) {
      await notifyReportUpdate({
        report,
        title: hearingChanged ? 'A hearing schedule was added or updated.' : `Report status was updated to ${report.status}.`,
        textTitle: hearingChanged ? `A hearing schedule was added or updated for report ${report.referenceNo}.` : `Report ${report.referenceNo} was updated to ${report.status}.`,
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
    if (update.status) {
      const closureCheck = await ensureCaseCanClose({
        reportId: existing._id,
        nextStatus: update.status,
        actor,
        overrideReason: req.body.overrideReason,
      });
      if (CASE_CLOSING_STATUSES.includes(update.status)) {
        update.closure = {
          closedAt: new Date(),
          closedByUser: mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null,
          closedByName: actor.name,
          closedByRole: actor.role,
          reason: cleanText(req.body.closureReason || adminComment || 'Case reviewed and closed by barangay staff.', { max: 800 }),
          seminarComplianceResult: closureCheck.complianceResult,
          overrideReason: closureCheck.overrideReason,
          finalRemarks: cleanText(req.body.finalRemarks || adminComment, { max: 1000 }),
        };
      }
    }
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
