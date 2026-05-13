import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'unsubscribed'],
      default: 'active',
    },
    source: {
      type: String,
      default: 'homepage',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    adminComment: { type: String, default: '' },
    handledByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledByName: { type: String, default: '' },
    handledByRole: { type: String, default: '' },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ status: 1, createdAt: -1 });
SubscriptionSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model('Subscription', SubscriptionSchema);
