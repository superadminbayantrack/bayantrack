import mongoose from 'mongoose';

const IssueAttachmentSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    type: { type: String, default: '' },
    size: { type: Number, default: 0 },
    dataUrl: { type: String, default: '' },
  },
  { _id: false },
);

const IssueReportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    fullName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    address: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    attachments: { type: [IssueAttachmentSchema], default: [] },
    status: {
      type: String,
      enum: ['new', 'in-review', 'resolved', 'rejected'],
      default: 'new',
    },
    adminChecked: { type: Boolean, default: false },
    adminComment: { type: String, default: '' },
    handledByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledByName: { type: String, default: '' },
    handledByRole: { type: String, default: '' },
    handledAt: { type: Date, default: null },
    referenceNo: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

IssueReportSchema.index({ user: 1, createdAt: -1 });
IssueReportSchema.index({ status: 1, createdAt: -1 });
IssueReportSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model('IssueReport', IssueReportSchema);
