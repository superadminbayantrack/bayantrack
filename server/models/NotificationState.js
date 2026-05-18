import mongoose from 'mongoose';

const NotificationStateSchema = new mongoose.Schema(
  {
    actorId: { type: String, required: true, unique: true },
    clearedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

NotificationStateSchema.index({ actorId: 1 });

export default mongoose.model('NotificationState', NotificationStateSchema);
