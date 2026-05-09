import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
    },
    title: { type: String, required: true },
    referenceNo: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ user: 1, createdAt: -1 });
ActivityLogSchema.index({ type: 1, createdAt: -1 });
ActivityLogSchema.index({ 'metadata.module': 1, createdAt: -1 });

export default mongoose.model('ActivityLog', ActivityLogSchema);
