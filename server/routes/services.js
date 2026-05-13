import express from 'express';
import mongoose from 'mongoose';
import ServiceRequest from '../models/ServiceRequest.js';
import ServiceCatalog from '../models/ServiceCatalog.js';
import EvacuationCenter from '../models/EvacuationCenter.js';
import EmergencyHotline from '../models/EmergencyHotline.js';
import User from '../models/User.js';
import { auth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { makeReference } from '../utils/reference.js';
import { getAdminNotificationRecipients, logSystemEvent, sendUserMail } from '../utils/notifications.js';

const router = express.Router();

const SERVICE_CATALOG = [
  {
    code: 'barangay-clearance',
    title: 'Barangay Clearance',
    desc: 'Official document certifying good moral character and residency.',
    usage: 'Employment, Bank Accounts',
    requirements: ['Valid ID', 'Recent Cedula'],
    time: '15 Mins',
  },
  {
    code: 'certificate-of-indigency',
    title: 'Certificate of Indigency',
    desc: 'Certification of financial status for assistance programs.',
    usage: 'Medical Assistance, Scholarships',
    requirements: ['Valid ID', 'Purok Leader Endorsement'],
    time: '15 Mins',
  },
  {
    code: 'barangay-id',
    title: 'Barangay ID',
    desc: 'Identification card for verified barangay residents.',
    usage: 'Barangay Transactions, Identity Verification',
    requirements: ['Valid ID', 'Proof of Residency', '2x2 Photo'],
    time: '20 Mins',
  },
  {
    code: 'residency-certificate',
    title: 'Residency Certificate',
    desc: 'Proof that the requester is a resident of Barangay Mambog II.',
    usage: 'School, employment, local verification',
    requirements: ['Valid ID', 'Proof of current address'],
    time: '15 Mins',
  },
];

const EMERGENCY_HOTLINES = [
  {
    name: 'Barangay Mambog II Hall',
    type: 'ADMIN',
    number: '(046) 472-0110',
    desc: 'General inquiries, barangay clearance, disputes.',
    when: ['Business hours concerns', 'Certificate follow-ups'],
    prepare: ['Name', 'Address', 'Nature of inquiry'],
  },
  {
    name: 'Bacoor PNP',
    type: 'POLICE',
    number: '(046) 417-6366',
    desc: 'Crime reporting, immediate police assistance.',
    when: ['Crime in progress', 'Suspicious persons', 'Traffic accidents'],
    prepare: ['Location', 'Description of suspect/incident'],
  },
  {
    name: 'BFP Bacoor (Fire)',
    type: 'FIRE',
    number: '(046) 417-6060',
    desc: 'Fire emergencies and rescue operations.',
    when: ['Smoke or fire visible', 'Chemical spills'],
    prepare: ['Exact address', 'Type of building'],
  },
];

function toRad(v) {
  return (Number(v) * Math.PI) / 180;
}

function kmBetween(aLat, aLng, bLat, bLng) {
  const earthKm = 6371;
  const dLat = toRad(Number(bLat) - Number(aLat));
  const dLng = toRad(Number(bLng) - Number(aLng));
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return earthKm * c;
}

async function seedEvacuationCentersIfNeeded() {
  const count = await EvacuationCenter.countDocuments();
  if (count > 0) return;

  await EvacuationCenter.insertMany([
    {
      name: 'Mambog II Covered Court',
      address: 'Mambog II Covered Court, Bacoor City, Cavite',
      active: true,
      capacity: 450,
      hazardsCovered: ['typhoon', 'flood', 'earthquake', 'fire'],
      location: { lat: 14.4149, lng: 120.9526 },
      notes: 'Primary evacuation center designated by barangay.',
    },
    {
      name: 'Mambog Elementary School',
      address: 'Mambog Elementary School, Bacoor City, Cavite',
      active: true,
      capacity: 320,
      hazardsCovered: ['typhoon', 'flood', 'earthquake'],
      location: { lat: 14.417, lng: 120.95 },
      notes: 'Secondary evacuation center for families.',
    },
  ]);
}

async function seedCatalogIfNeeded() {
  const count = await ServiceCatalog.countDocuments();
  if (count === 0) {
    await ServiceCatalog.insertMany(
      SERVICE_CATALOG.map((item, idx) => ({
        ...item,
        active: true,
        sortOrder: idx + 1,
      })),
    );
  }
}

async function seedEmergencyHotlinesIfNeeded() {
  const count = await EmergencyHotline.countDocuments();
  if (count > 0) return;
  await EmergencyHotline.insertMany(EMERGENCY_HOTLINES.map((x) => ({ ...x, active: true })));
}

function serviceRequestEmailHtml({ title, bodyLines = [] }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#0f172a;color:#ffffff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack Service Request Update</h2>
      </div>
      <div style="padding:20px;color:#0f172a;">
        <p style="margin:0 0 12px;font-weight:700;">${title}</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
          ${bodyLines.map((line) => `<p style="margin:0 0 8px;">${line}</p>`).join('')}
        </div>
      </div>
    </div>
</div>`;
}

async function notifyServiceRequestStatus({ item, residentUser, actorRole, note = '', title = 'A service request status was updated.' }) {
  const residentRecipients = Array.from(new Set([
    residentUser?.email,
    ...((residentUser?.children || []).map((child) => String(child.email || '').trim()).filter(Boolean)),
  ].filter(Boolean)));
  const adminRecipients = await getAdminNotificationRecipients();
  const statusLines = [
    `<strong>Reference:</strong> ${item.referenceNo}`,
    `<strong>Service:</strong> ${item.serviceType}`,
    `<strong>Updated status:</strong> ${item.status}`,
    `<strong>Updated by:</strong> ${actorRole || 'system'}`,
    note ? `<strong>Note:</strong> ${note}` : '',
  ].filter(Boolean);

  if (residentRecipients.length > 0) {
    await sendUserMail({
      to: residentRecipients.join(','),
      subject: `Service Request ${item.referenceNo} Updated to ${item.status}`,
      html: serviceRequestEmailHtml({ title: 'Your service request status was updated.', bodyLines: statusLines }),
      text: `Service request ${item.referenceNo} was updated to ${item.status}.${note ? ` Note: ${note}` : ''}`,
    });
  }
  if (adminRecipients.length > 0) {
    await sendUserMail({
      to: adminRecipients.join(','),
      subject: `Service Request ${item.referenceNo} Status Updated`,
      html: serviceRequestEmailHtml({ title, bodyLines: statusLines }),
      text: `Service request ${item.referenceNo} was updated to ${item.status} by ${actorRole || 'system'}.${note ? ` Note: ${note}` : ''}`,
    });
  }
}

router.get('/catalog', (_req, res) => {
  return seedCatalogIfNeeded()
    .then(async () => {
      const rows = await ServiceCatalog.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
      return res.json(rows);
    })
    .catch(() => res.status(500).json({ msg: 'Failed to fetch service catalog' }));
});

router.get('/catalog/all', auth, requireRoles('admin', 'superadmin'), async (_req, res) => {
  try {
    await seedCatalogIfNeeded();
    const rows = await ServiceCatalog.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
    return res.json(rows);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch service catalog' });
  }
});

router.post('/catalog', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      code: String(req.body.code || '').trim().toLowerCase(),
    };
    if (!payload.code || !payload.title) {
      return res.status(400).json({ msg: 'Service code and title are required.' });
    }
    const created = await ServiceCatalog.create(payload);
    await logSystemEvent({ user: req.user.id, type: 'service-catalog', title: `Created service catalog item ${created.title}`, referenceNo: created._id.toString(), metadata: { action: 'create', module: 'service-catalog' } });
    return res.status(201).json(created);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to create service catalog item' });
  }
});

router.put('/catalog/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const updated = await ServiceCatalog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after' },
    );
    if (!updated) return res.status(404).json({ msg: 'Service catalog item not found' });
    await logSystemEvent({ user: req.user.id, type: 'service-catalog', title: `Updated service catalog item ${updated.title}`, referenceNo: updated._id.toString(), metadata: { action: 'update', module: 'service-catalog' } });
    return res.json(updated);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update service catalog item' });
  }
});

router.patch('/catalog/:id/archive', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const { active } = req.body;
    const updated = await ServiceCatalog.findByIdAndUpdate(
      req.params.id,
      { active: Boolean(active) },
      { returnDocument: 'after' },
    );
    if (!updated) return res.status(404).json({ msg: 'Service catalog item not found' });
    await logSystemEvent({ user: req.user.id, type: 'service-catalog', title: `${Boolean(active) ? 'Restored' : 'Archived'} service catalog item ${updated.title}`, referenceNo: updated._id.toString(), metadata: { action: Boolean(active) ? 'restore' : 'archive', module: 'service-catalog' } });
    return res.json(updated);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to archive service catalog item' });
  }
});

router.delete('/catalog/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const deleted = await ServiceCatalog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ msg: 'Service catalog item not found' });
    await logSystemEvent({ user: req.user.id, type: 'service-catalog', title: `Deleted service catalog item ${deleted.title}`, referenceNo: deleted._id.toString(), metadata: { action: 'delete', module: 'service-catalog' } });
    return res.json({ msg: 'Service catalog item removed' });
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to delete service catalog item' });
  }
});

router.post('/requests', auth, async (req, res) => {
  try {
    const hasMongoActor = mongoose.Types.ObjectId.isValid(String(req.user.id || ''));
    const parentUser = hasMongoActor
      ? await User.findById(req.user.id).select('firstName lastName email children')
      : null;
    if (req.user.role === 'resident' && !parentUser) {
      return res.status(404).json({ msg: 'User not found' });
    }
    const referenceNo = makeReference('SVC');
    const actingChild = parentUser && req.user.actingChild
      ? (parentUser.children || []).find((child) => String(child._id) === String(req.user.actingChild.id))
      : null;
    const request = await ServiceRequest.create({
      ...req.body,
      user: parentUser?._id || null,
      referenceNo,
      history: [{ status: 'pending', by: hasMongoActor ? req.user.id : undefined, note: 'Request submitted' }],
    });

    await logSystemEvent({
      user: req.user.id,
      type: 'service-request',
      title: `Submitted ${request.serviceType}${actingChild ? ` under child access for ${actingChild.fullName}` : ''}`,
      referenceNo,
      metadata: { module: 'service-requests', action: 'create', actingChild: actingChild ? { fullName: actingChild.fullName, email: actingChild.email } : null },
    });

    const adminRecipients = await getAdminNotificationRecipients();
    const residentRecipients = Array.from(new Set([
      parentUser?.email,
      ...(actingChild?.email ? [actingChild.email] : []),
    ].filter(Boolean)));

    const submissionLines = [
      `<strong>Reference:</strong> ${referenceNo}`,
      `<strong>Service:</strong> ${request.serviceType}`,
      `<strong>Submitted by:</strong> ${actingChild ? `${actingChild.fullName} using parent account` : request.fullName}`,
      parentUser?.email ? `<strong>Parent account:</strong> ${parentUser.email}` : `<strong>Created by:</strong> ${req.user.role}`,
      `<strong>Status:</strong> pending`,
    ];

    if (adminRecipients.length > 0) {
      await sendUserMail({
        to: adminRecipients.join(','),
        subject: `New Service Request Submitted: ${request.serviceType}`,
        html: serviceRequestEmailHtml({ title: 'A new service request was submitted.', bodyLines: submissionLines }),
        text: `New service request submitted.\nReference: ${referenceNo}\nService: ${request.serviceType}\nSubmitted by: ${actingChild ? `${actingChild.fullName} using parent account` : request.fullName}\n${parentUser?.email ? `Parent account: ${parentUser.email}` : `Created by: ${req.user.role}`}\nStatus: pending`,
      });
    }
    if (residentRecipients.length > 0) {
      await sendUserMail({
        to: residentRecipients.join(','),
        subject: `Your BayanTrack Service Request Was Submitted`,
        html: serviceRequestEmailHtml({ title: 'Your service request was submitted successfully.', bodyLines: submissionLines }),
        text: `Your service request was submitted.\nReference: ${referenceNo}\nService: ${request.serviceType}\nStatus: pending`,
      });
    }

    return res.status(201).json(request);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to submit service request' });
  }
});

router.get('/requests/me', auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.user.id || ''))) {
      return res.json([]);
    }
    const items = await ServiceRequest.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch your requests' });
  }
});

router.get('/requests/track/:referenceNo', auth, async (req, res) => {
  try {
    const item = await ServiceRequest.findOne({ referenceNo: req.params.referenceNo }).lean();
    if (!item) {
      return res.status(404).json({ msg: 'Request not found' });
    }

    if (req.user.role === 'resident' && (!item.user || item.user.toString() !== req.user.id)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    return res.json(item);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to track request' });
  }
});

router.get('/requests', auth, requireRoles('admin', 'superadmin'), async (_req, res) => {
  try {
    const items = await ServiceRequest.find().sort({ createdAt: -1 }).lean();
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ msg: 'Failed to fetch requests' });
  }
});

router.patch('/requests/:id/status', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('serviceRequests', 'edit'), async (req, res) => {
  try {
    const { status, note } = req.body;

    if (status && !['pending', 'in-review', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const item = await ServiceRequest.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ msg: 'Request not found' });
    }
    const residentUser = await User.findById(item.user).select('firstName lastName email children');

    if (status) {
      const hasMongoActor = mongoose.Types.ObjectId.isValid(String(req.user.id || ''));
      item.status = status;
      item.history.push({ status, by: hasMongoActor ? req.user.id : undefined, note: note || '' });
    }

    await item.save();

    await logSystemEvent({
      user: req.user.id,
      type: 'service-request',
      title: `Updated service request ${item.referenceNo} to ${item.status}`,
      referenceNo: item.referenceNo,
      metadata: { byRole: req.user.role, action: item.status === 'rejected' ? 'archive' : 'update', module: 'service-requests', residentUser: item.user },
    });

    await notifyServiceRequestStatus({ item, residentUser, actorRole: req.user.role, note });

    return res.json(item);
  } catch (err) {
    return res.status(400).json({ msg: 'Failed to update request status' });
  }
});

router.put('/requests/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('serviceRequests', 'edit'), async (req, res) => {
  try {
    const update = {};
    ['serviceType', 'fullName', 'contactNumber', 'address', 'purpose', 'status'].forEach((key) => {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    });
    if (update.status && !['pending', 'in-review', 'approved', 'rejected', 'completed'].includes(update.status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const existing = await ServiceRequest.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'Request not found' });
    }
    const previousStatus = existing.status;
    const item = await ServiceRequest.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (update.status && update.status !== previousStatus) {
      const hasMongoActor = mongoose.Types.ObjectId.isValid(String(req.user.id || ''));
      item.history.push({ status: update.status, by: hasMongoActor ? req.user.id : undefined, note: req.body.note || 'Updated from dashboard' });
      await item.save();
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'service-request',
      title: `Edited service request ${item.referenceNo}`,
      referenceNo: item.referenceNo,
      metadata: { action: 'update', module: 'service-requests', residentUser: item.user },
    });
    if (update.status && update.status !== previousStatus) {
      const residentUser = await User.findById(item.user).select('firstName lastName email children');
      await notifyServiceRequestStatus({ item, residentUser, actorRole: req.user.role, note: req.body.note || 'Updated from dashboard' });
    }
    return res.json(item);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update service request' });
  }
});

router.delete('/requests/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('serviceRequests', 'delete'), async (req, res) => {
  try {
    const deleted = await ServiceRequest.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ msg: 'Request not found' });
    }

    await logSystemEvent({
      user: req.user.id,
      type: 'service-request',
      title: `Deleted service request ${deleted.referenceNo}`,
      referenceNo: deleted.referenceNo,
      metadata: { action: 'delete', module: 'service-requests', residentUser: deleted.user },
    });
    return res.json({ msg: 'Service request deleted' });
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to delete service request' });
  }
});

router.get('/evacuation-centers/public', async (_req, res) => {
  try {
    await seedEvacuationCentersIfNeeded();
    const rows = await EvacuationCenter.find({ active: true }).sort({ name: 1 }).lean();
    return res.json(rows);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch evacuation centers' });
  }
});

router.get('/evacuation-centers', auth, requireRoles('superadmin'), async (_req, res) => {
  try {
    await seedEvacuationCentersIfNeeded();
    const rows = await EvacuationCenter.find().sort({ active: -1, name: 1 }).lean();
    return res.json(rows);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch evacuation centers' });
  }
});

router.get('/emergency-hotlines', async (req, res) => {
  try {
    await seedEmergencyHotlinesIfNeeded();
    const includeInactive = req.user?.role === 'superadmin' || req.user?.role === 'admin';
    const rows = await EmergencyHotline.find(includeInactive ? {} : { active: true }).sort({ name: 1 }).lean();
    return res.json(rows);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch emergency hotlines' });
  }
});

router.post('/emergency-hotlines', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      when: Array.isArray(req.body.when) ? req.body.when : String(req.body.when || '').split(',').map((x) => x.trim()).filter(Boolean),
      prepare: Array.isArray(req.body.prepare) ? req.body.prepare : String(req.body.prepare || '').split(',').map((x) => x.trim()).filter(Boolean),
    };
    const created = await EmergencyHotline.create(payload);
    await logSystemEvent({ user: req.user.id, type: 'hotline-management', title: `Created emergency hotline ${created.name}`, referenceNo: created._id.toString(), metadata: { action: 'create', module: 'hotlines' } });
    return res.status(201).json(created);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to create emergency hotline' });
  }
});

router.put('/emergency-hotlines/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      when: Array.isArray(req.body.when) ? req.body.when : String(req.body.when || '').split(',').map((x) => x.trim()).filter(Boolean),
      prepare: Array.isArray(req.body.prepare) ? req.body.prepare : String(req.body.prepare || '').split(',').map((x) => x.trim()).filter(Boolean),
    };
    const updated = await EmergencyHotline.findByIdAndUpdate(req.params.id, payload, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ msg: 'Emergency hotline not found' });
    await logSystemEvent({ user: req.user.id, type: 'hotline-management', title: `Updated emergency hotline ${updated.name}`, referenceNo: updated._id.toString(), metadata: { action: 'update', module: 'hotlines' } });
    return res.json(updated);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update emergency hotline' });
  }
});

router.patch('/emergency-hotlines/:id/archive', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const updated = await EmergencyHotline.findByIdAndUpdate(
      req.params.id,
      { active: Boolean(req.body.active) },
      { returnDocument: 'after' },
    );
    if (!updated) return res.status(404).json({ msg: 'Emergency hotline not found' });
    await logSystemEvent({ user: req.user.id, type: 'hotline-management', title: `${Boolean(req.body.active) ? 'Restored' : 'Archived'} emergency hotline ${updated.name}`, referenceNo: updated._id.toString(), metadata: { action: Boolean(req.body.active) ? 'restore' : 'archive', module: 'hotlines' } });
    return res.json(updated);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to archive emergency hotline' });
  }
});

router.delete('/emergency-hotlines/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const deleted = await EmergencyHotline.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ msg: 'Emergency hotline not found' });
    await logSystemEvent({ user: req.user.id, type: 'hotline-management', title: `Deleted emergency hotline ${deleted.name}`, referenceNo: deleted._id.toString(), metadata: { action: 'delete', module: 'hotlines' } });
    return res.json({ msg: 'Emergency hotline removed' });
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to delete emergency hotline' });
  }
});

router.post('/evacuation-centers', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const created = await EvacuationCenter.create(req.body);
    await logSystemEvent({ user: req.user.id, type: 'evacuation-center', title: `Created evacuation center ${created.name}`, referenceNo: created._id.toString(), metadata: { action: 'create', module: 'evacuation-centers' } });
    return res.status(201).json(created);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to create evacuation center' });
  }
});

router.put('/evacuation-centers/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const updated = await EvacuationCenter.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
    if (!updated) return res.status(404).json({ msg: 'Evacuation center not found' });
    await logSystemEvent({ user: req.user.id, type: 'evacuation-center', title: `Updated evacuation center ${updated.name}`, referenceNo: updated._id.toString(), metadata: { action: req.body.active === false ? 'archive' : req.body.active === true ? 'restore' : 'update', module: 'evacuation-centers' } });
    return res.json(updated);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update evacuation center' });
  }
});

router.delete('/evacuation-centers/:id', auth, requireRoles('superadmin'), async (req, res) => {
  try {
    const deleted = await EvacuationCenter.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ msg: 'Evacuation center not found' });
    await logSystemEvent({ user: req.user.id, type: 'evacuation-center', title: `Deleted evacuation center ${deleted.name}`, referenceNo: deleted._id.toString(), metadata: { action: 'delete', module: 'evacuation-centers' } });
    return res.json({ msg: 'Evacuation center removed' });
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to delete evacuation center' });
  }
});

router.get('/evacuation/nearest', auth, async (req, res) => {
  try {
    await seedEvacuationCentersIfNeeded();
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const hazard = String(req.query.hazard || '').toLowerCase();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ msg: 'Valid lat/lng query params are required.' });
    }

    const centers = await EvacuationCenter.find({ active: true }).lean();
    const filtered = hazard
      ? centers.filter((c) => (c.hazardsCovered || []).map((x) => String(x).toLowerCase()).includes(hazard))
      : centers;

    if (filtered.length === 0) {
      return res.status(404).json({ msg: 'No active evacuation center available.' });
    }

    const ranked = filtered
      .map((c) => {
        const distanceKm = kmBetween(lat, lng, c.location?.lat, c.location?.lng);
        return {
          _id: c._id,
          name: c.name,
          address: c.address,
          hazardsCovered: c.hazardsCovered || [],
          capacity: c.capacity || 0,
          notes: c.notes || '',
          location: c.location,
          distanceKm: Number(distanceKm.toFixed(2)),
          routeHint: `Proceed to ${c.name} via the main accessible roads. Keep to elevated routes where possible.`,
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json({
      nearest: ranked[0],
      alternatives: ranked.slice(1, 4),
    });
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to find nearest evacuation center' });
  }
});

export default router;
