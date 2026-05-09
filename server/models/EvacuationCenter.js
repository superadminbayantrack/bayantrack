import mongoose from 'mongoose';

const EvacuationCenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    active: { type: Boolean, default: true },
    capacity: { type: Number, default: 0 },
    hazardsCovered: [{ type: String }],
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

EvacuationCenterSchema.index({ active: 1, name: 1 });
EvacuationCenterSchema.index({ hazardsCovered: 1, active: 1 });

export default mongoose.model('EvacuationCenter', EvacuationCenterSchema);
