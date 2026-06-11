import express from 'express';
import mongoose from 'mongoose';
import SeminarRequirement from '../models/SeminarRequirement.js';
import IssueReport from '../models/IssueReport.js';
import User from '../models/User.js';
import { auth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { logSystemEvent, resolveActorDetails } from '../utils/notifications.js';
import { cleanText } from '../utils/validation.js';

const router = express.Router();

const SEMINAR_TYPES = ['Barangay Seminar', 'Counseling', 'Mediation', 'Community Service', 'Orientation', 'Custom Procedure'];
const SEMINAR_STATUSES = ['Not Yet Scheduled', 'Scheduled', 'Attended', 'Missed', 'Completed', 'Failed to Comply', 'Cancelled', 'Re-Scheduled'];
const MAX_PROOF_DATA_URL_LENGTH = 3_000_000;

function normalizeSeminarType(value) {
  return SEMINAR_TYPES.includes(value) ? value : 'Barangay Seminar';
}

function normalizeSeminarStatus(value) {
  return SEMINAR_STATUSES.includes(value) ? value : 'Not Yet Scheduled';
}

function normalizeCompletionProof(value) {
  if (!value || typeof value !== 'object') return {};
  const dataUrl = String(value.dataUrl || '').trim();
  if (!dataUrl) return {};
  if (!dataUrl.startsWith('data:image/') || dataUrl.length > MAX_PROOF_DATA_URL_LENGTH) {
    const error = new Error('Completion proof must be an image under the allowed size limit.');
    error.statusCode = 400;
    throw error;
  }
  return {
    name: String(value.name || 'completion-proof').slice(0, 160),
    type: String(value.type || 'image').slice(0, 80),
    size: Number(value.size) || 0,
    dataUrl,
  };
}

function statusToReportStatus(status) {
  if (status === 'Completed') return 'seminar-completed';
  if (status === 'Missed') return 'missed-seminar';
  if (status === 'Failed to Comply') return 'failed-to-comply';
  if (status === 'Re-Scheduled') return 're-scheduled';
  if (status === 'Scheduled' || status === 'Attended' || status === 'Not Yet Scheduled') return 'seminar-intervention-required';
  return '';
}

function populateSeminarQuery(query) {
  return query
    .populate('residentId', 'firstName middleName lastName username email contactNumber address')
    .populate('relatedComplaintId', 'referenceNo category reportType status hearingSchedule')
    .sort({ updatedAt: -1, createdAt: -1 });
}

function residentDisplayName(user) {
  return [user?.firstName, user?.middleName, user?.lastName].filter(Boolean).join(' ').trim()
    || user?.username
    || user?.email
    || '';
}

async function resolveResidentAndReport(body) {
  const relatedComplaintId = String(body.relatedComplaintId || body.relatedCaseId || body.relatedBlotterId || '').trim();
  const relatedReferenceNo = cleanText(body.relatedReferenceNo || body.referenceNo, { max: 80 });
  let report = null;

  if (relatedComplaintId && mongoose.Types.ObjectId.isValid(relatedComplaintId)) {
    report = await IssueReport.findById(relatedComplaintId);
  } else if (relatedReferenceNo) {
    report = await IssueReport.findOne({
      $or: [
        { referenceNo: relatedReferenceNo },
        { 'caseRecord.referenceNo': relatedReferenceNo },
        { 'blotterRecord.referenceNo': relatedReferenceNo },
      ],
    });
  }

  const residentId = String(body.residentId || report?.user || '').trim();
  if (!mongoose.Types.ObjectId.isValid(residentId)) {
    const error = new Error('A valid resident or related complaint with a resident is required.');
    error.statusCode = 400;
    throw error;
  }

  const resident = await User.findById(residentId).select('firstName middleName lastName username email');
  if (!resident) {
    const error = new Error('Resident not found.');
    error.statusCode = 404;
    throw error;
  }

  return { resident, report };
}

function buildSeminarPayload(body, actor, resident, report) {
  const title = cleanText(body.title, { max: 180 });
  if (!title) {
    const error = new Error('Seminar or intervention title is required.');
    error.statusCode = 400;
    throw error;
  }

  const status = normalizeSeminarStatus(body.status);
  const relatedId = report?._id || null;
  const proof = normalizeCompletionProof(body.completionProof);

  return {
    residentId: resident._id,
    relatedCaseId: relatedId,
    relatedBlotterId: relatedId,
    relatedComplaintId: relatedId,
    hearingScheduleRef: report?.hearingSchedule?.date ? `${report.hearingSchedule.date} ${report.hearingSchedule.time || ''}`.trim() : '',
    relatedReferenceNo: cleanText(body.relatedReferenceNo || report?.referenceNo, { max: 80 }),
    residentName: cleanText(body.residentName || residentDisplayName(resident), { max: 160 }),
    type: normalizeSeminarType(body.type),
    title,
    description: cleanText(body.description, { max: 1500 }),
    scheduleDate: cleanText(body.scheduleDate, { max: 40 }),
    scheduleTime: cleanText(body.scheduleTime, { max: 40 }),
    venue: cleanText(body.venue, { max: 180 }),
    status,
    completionProof: proof,
    remarks: cleanText(body.remarks, { max: 1500 }),
    assignedBy: mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null,
    assignedByName: actor.name,
    assignedByRole: actor.role,
    completedBy: status === 'Completed' && mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null,
    completedByName: status === 'Completed' ? actor.name : '',
    completedAt: status === 'Completed' ? new Date() : null,
    dismissalEligible: status === 'Completed',
    overrideReason: cleanText(body.overrideReason, { max: 800 }),
  };
}

async function syncReportForSeminar(seminar, actor, action = 'seminar-update') {
  if (!seminar.relatedComplaintId) return;
  const nextReportStatus = statusToReportStatus(seminar.status);
  const update = {
    adminChecked: true,
    handledByName: actor.name,
    handledByRole: actor.role,
    handledByUser: mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null,
    handledAt: new Date(),
  };
  if (nextReportStatus) update.status = nextReportStatus;
  if (seminar.remarks) update.adminComment = seminar.remarks;
  await IssueReport.findByIdAndUpdate(seminar.relatedComplaintId, { $set: update });
  await logSystemEvent({
    user: seminar.residentId,
    type: 'seminar-intervention',
    title: `${seminar.title} is ${seminar.status}`,
    referenceNo: seminar.referenceNumber,
    metadata: {
      module: 'seminar-intervention',
      action,
      relatedReferenceNo: seminar.relatedReferenceNo,
      status: seminar.status,
    },
  });
}

router.get('/', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'view'), async (_req, res) => {
  try {
    const requirements = await populateSeminarQuery(SeminarRequirement.find()).lean();
    return res.json(requirements);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch seminar requirements' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.user.id || ''))) return res.json([]);
    const requirements = await populateSeminarQuery(SeminarRequirement.find({ residentId: req.user.id }).select('-completionProof.dataUrl')).lean();
    return res.json(requirements);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch your seminar requirements' });
  }
});

router.post('/', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'edit'), async (req, res) => {
  try {
    const actor = await resolveActorDetails(req.user);
    const { resident, report } = await resolveResidentAndReport(req.body);
    const payload = buildSeminarPayload(req.body, actor, resident, report);
    payload.referenceNumber = makeReference('SEM');

    const seminar = await SeminarRequirement.create(payload);
    await syncReportForSeminar(seminar, actor, 'assign');
    const populated = await populateSeminarQuery(SeminarRequirement.findById(seminar._id)).lean();
    return res.status(201).json(populated);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ msg: err.message || 'Failed to create seminar requirement' });
  }
});

router.put('/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'edit'), async (req, res) => {
  try {
    const actor = await resolveActorDetails(req.user);
    const existing = await SeminarRequirement.findById(req.params.id);
    if (!existing) return res.status(404).json({ msg: 'Seminar requirement not found' });

    const { resident, report } = await resolveResidentAndReport({
      ...req.body,
      residentId: req.body.residentId || existing.residentId,
      relatedComplaintId: req.body.relatedComplaintId || existing.relatedComplaintId,
      relatedReferenceNo: req.body.relatedReferenceNo || existing.relatedReferenceNo,
    });
    const payload = buildSeminarPayload(req.body, actor, resident, report);
    payload.referenceNumber = existing.referenceNumber;

    const seminar = await SeminarRequirement.findByIdAndUpdate(req.params.id, { $set: payload }, { returnDocument: 'after' });
    await syncReportForSeminar(seminar, actor, 'update');
    const populated = await populateSeminarQuery(SeminarRequirement.findById(seminar._id)).lean();
    return res.json(populated);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ msg: err.message || 'Failed to update seminar requirement' });
  }
});

router.patch('/:id/status', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('reports', 'edit'), async (req, res) => {
  try {
    const actor = await resolveActorDetails(req.user);
    const status = normalizeSeminarStatus(req.body.status);
    const update = {
      status,
      remarks: cleanText(req.body.remarks, { max: 1500 }),
      dismissalEligible: status === 'Completed',
      completedBy: status === 'Completed' && mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null,
      completedByName: status === 'Completed' ? actor.name : '',
      completedAt: status === 'Completed' ? new Date() : null,
    };
    if (req.body.completionProof !== undefined) update.completionProof = normalizeCompletionProof(req.body.completionProof);

    const seminar = await SeminarRequirement.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after' });
    if (!seminar) return res.status(404).json({ msg: 'Seminar requirement not found' });
    await syncReportForSeminar(seminar, actor, 'status');
    const populated = await populateSeminarQuery(SeminarRequirement.findById(seminar._id)).lean();
    return res.json(populated);
  } catch (err) {
    return res.status(err.statusCode || 400).json({ msg: err.message || 'Failed to update seminar status' });
  }
});

export default router;
