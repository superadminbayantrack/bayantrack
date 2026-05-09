import mongoose from 'mongoose';

const OfficialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    level: { type: String, enum: ['city', 'barangay'], default: 'barangay' },
    rankOrder: { type: Number, default: 100 },
    committee: { type: String, default: '' },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

OfficialSchema.index({ active: 1, level: 1, rankOrder: 1, createdAt: 1 });

export default mongoose.model('Official', OfficialSchema);
