import mongoose from 'mongoose';

const ServiceCatalogSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    desc: { type: String, default: '' },
    usage: { type: String, default: '' },
    requirements: { type: [String], default: [] },
    time: { type: String, default: '' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 100 },
  },
  { timestamps: true },
);

ServiceCatalogSchema.index({ active: 1, sortOrder: 1, createdAt: 1 });

export default mongoose.model('ServiceCatalog', ServiceCatalogSchema);
