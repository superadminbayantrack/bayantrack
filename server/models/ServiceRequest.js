import mongoose from 'mongoose';

const ServiceAttachmentSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Requirement' },
    name: { type: String, default: '' },
    type: { type: String, default: '' },
    size: { type: Number, default: 0 },
    dataUrl: { type: String, default: '' },
  },
  { _id: false },
);

const ServiceBeneficiarySchema = new mongoose.Schema(
  {
    fullName: { type: String, default: '' },
    relationship: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    reason: { type: String, default: '' },
  },
  { _id: false },
);

const IssuedDocumentSchema = new mongoose.Schema(
  {
    referenceNo: { type: String, default: '' },
    verificationCode: { type: String, default: '' },
    releasedAt: { type: Date, default: null },
    releasedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedByName: { type: String, default: '' },
    releasedByRole: { type: String, default: '' },
  },
  { _id: false },
);

const ServiceRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    serviceType: {
      type: String,
      required: true,
    },
    fullName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    address: { type: String, required: true },
    purpose: { type: String, required: true },
    requestFor: {
      type: String,
      enum: ['self', 'on-behalf'],
      default: 'self',
    },
    beneficiary: { type: ServiceBeneficiarySchema, default: () => ({}) },
    requirements: { type: [ServiceAttachmentSchema], default: [] },
    requirementStatus: {
      type: String,
      enum: ['pending', 'complete', 'needs-resubmission'],
      default: 'pending',
    },
    issuedDocument: { type: IssuedDocumentSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['pending', 'in-review', 'approved', 'for-pickup', 'released', 'rejected', 'cancelled', 'completed'],
      default: 'pending',
    },
    referenceNo: { type: String, required: true, unique: true },
    adminComment: { type: String, default: '' },
    handledByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledByName: { type: String, default: '' },
    handledByRole: { type: String, default: '' },
    handledAt: { type: Date, default: null },
    history: [
      {
        status: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

ServiceRequestSchema.index({ user: 1, createdAt: -1 });
ServiceRequestSchema.index({ user: 1, serviceType: 1, createdAt: -1 });
ServiceRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ServiceRequest', ServiceRequestSchema);
