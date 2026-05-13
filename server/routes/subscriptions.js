import express from 'express';
import mongoose from 'mongoose';
import Subscription from '../models/Subscription.js';
import { auth, optionalAuth, requireAdminPermission, requireRoles } from '../middleware/auth.js';
import { getAdminNotificationRecipients, logSystemEvent, resolveActorDetails, sendUserMail } from '../utils/notifications.js';

const router = express.Router();
const SUBSCRIPTION_STATUSES = ['active', 'unsubscribed'];

function subscriptionEmailHtml({ title, lines = [] }) {
  return `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <div style="background:#1e3a8a;color:#ffffff;padding:18px 20px;">
        <h2 style="margin:0;font-size:20px;">BayanTrack Subscription Update</h2>
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

async function notifySubscriptionUpdate({ item, title, textTitle, actor, notifySubscriber = true }) {
  const handler = actor?.name ? `${actor.name}${actor.role ? ` (${actor.role})` : ''}` : '';
  const lines = [
    `<strong>Email:</strong> ${item.email}`,
    `<strong>Status:</strong> ${item.status}`,
    `<strong>Source:</strong> ${item.source || 'homepage'}`,
    handler ? `<strong>Handled by:</strong> ${handler}` : '',
    item.adminComment ? `<strong>Comment from the admins:</strong> ${item.adminComment}` : '',
  ];
  const text = [
    textTitle,
    `Email: ${item.email}`,
    `Status: ${item.status}`,
    `Source: ${item.source || 'homepage'}`,
    handler ? `Handled by: ${handler}` : '',
    item.adminComment ? `Comment from the admins: ${item.adminComment}` : '',
  ].filter(Boolean).join('\n');
  const adminRecipients = await getAdminNotificationRecipients();
  if (adminRecipients.length > 0) {
    await sendUserMail({
      to: adminRecipients.join(','),
      subject: `BayanTrack Subscriber ${item.email}: ${item.status}`,
      html: subscriptionEmailHtml({ title, lines }),
      text,
    });
  }
  if (notifySubscriber && item.email) {
    await sendUserMail({
      to: item.email,
      subject: 'Your BayanTrack Subscription Was Updated',
      html: subscriptionEmailHtml({ title: 'Your subscription status was updated.', lines }),
      text,
    });
  }
}

router.post('/', optionalAuth, async (req, res) => {
  try {
    const { email, source } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ msg: 'Valid email is required' });
    }

    const payload = {
      email: String(email).toLowerCase().trim(),
      status: 'active',
      source: source || 'homepage',
      createdBy: mongoose.Types.ObjectId.isValid(String(req.user?.id || '')) ? req.user.id : null,
    };

    const item = await Subscription.findOneAndUpdate(
      { email: payload.email },
      payload,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );

    if (req.user?.id) {
      await logSystemEvent({ user: req.user.id, type: 'subscription', title: `Subscribed ${payload.email}`, referenceNo: item._id.toString(), metadata: { action: 'create', module: 'subscribers' } });
    }
    await notifySubscriptionUpdate({
      item,
      title: 'A subscriber record was saved.',
      textTitle: 'Subscriber record saved.',
    });

    return res.status(201).json(item);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to save subscription' });
  }
});

router.get('/', auth, requireRoles('admin', 'superadmin'), async (_req, res) => {
  try {
    const items = await Subscription.find().sort({ createdAt: -1 }).limit(500).lean();
    return res.json(items);
  } catch (_err) {
    return res.status(500).json({ msg: 'Failed to fetch subscriptions' });
  }
});

router.patch('/:id/status', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('subscribers', 'edit'), async (req, res) => {
  try {
    const { status, adminComment } = req.body;
    if (!SUBSCRIPTION_STATUSES.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const actor = await resolveActorDetails(req.user);
    const item = await Subscription.findByIdAndUpdate(
      req.params.id,
      {
        status,
        ...(adminComment !== undefined ? { adminComment: String(adminComment || '').trim() } : {}),
        handledByName: actor.name,
        handledByRole: actor.role,
        handledAt: new Date(),
        handledByUser: mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null,
      },
      { returnDocument: 'after' },
    );
    if (!item) {
      return res.status(404).json({ msg: 'Subscription not found' });
    }
    await logSystemEvent({ user: req.user.id, type: 'subscription', title: `${status === 'active' ? 'Restored' : 'Archived'} subscriber ${item.email}`, referenceNo: item._id.toString(), metadata: { action: status === 'active' ? 'restore' : 'archive', module: 'subscribers' } });
    await notifySubscriptionUpdate({
      item,
      title: `Subscriber status was updated to ${status}.`,
      textTitle: `Subscriber ${item.email} was updated to ${status}.`,
      actor,
    });
    return res.json(item);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update subscription' });
  }
});

router.put('/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('subscribers', 'edit'), async (req, res) => {
  try {
    const update = {};
    if (req.body.email !== undefined) {
      const email = String(req.body.email || '').toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ msg: 'Valid email is required' });
      }
      update.email = email;
    }
    if (req.body.source !== undefined) update.source = String(req.body.source || 'dashboard').trim() || 'dashboard';
    if (req.body.adminComment !== undefined) update.adminComment = String(req.body.adminComment || '').trim();
    if (req.body.status !== undefined) {
      if (!SUBSCRIPTION_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      update.status = req.body.status;
    }

    const existing = await Subscription.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ msg: 'Subscription not found' });
    }
    const actor = await resolveActorDetails(req.user);
    update.handledByName = actor.name;
    update.handledByRole = actor.role;
    update.handledAt = new Date();
    update.handledByUser = mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : null;
    const item = await Subscription.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    await logSystemEvent({ user: req.user.id, type: 'subscription', title: `Edited subscriber ${item.email}`, referenceNo: item._id.toString(), metadata: { action: 'update', module: 'subscribers' } });
    if ((update.status && update.status !== existing.status) || (update.email && update.email !== existing.email) || (update.adminComment !== undefined && update.adminComment !== existing.adminComment)) {
      await notifySubscriptionUpdate({
        item,
        title: 'Subscriber details were updated.',
        textTitle: `Subscriber ${item.email} was updated.`,
        actor,
      });
    }
    return res.json(item);
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to update subscription' });
  }
});

router.delete('/:id', auth, requireRoles('admin', 'superadmin'), requireAdminPermission('subscribers', 'delete'), async (req, res) => {
  try {
    const item = await Subscription.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ msg: 'Subscription not found' });
    }
    await logSystemEvent({ user: req.user.id, type: 'subscription', title: `Deleted subscriber ${item.email}`, referenceNo: item._id.toString(), metadata: { action: 'delete', module: 'subscribers' } });
    await notifySubscriptionUpdate({
      item,
      title: 'A subscriber record was deleted.',
      textTitle: `Subscriber ${item.email} was deleted.`,
      notifySubscriber: false,
    });
    return res.json({ msg: 'Subscription deleted' });
  } catch (_err) {
    return res.status(400).json({ msg: 'Failed to delete subscription' });
  }
});

export default router;
