import mongoose from 'mongoose';

const CompletionProofSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    type: { type: String, default: '' },
    size: { type: Number, default: 0 },
    dataUrl: { type: String, default: '' },
  },
  { _id: false },
);

const SeminarRequirementSchema = new mongoose.Schema(
  {
    residentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    relatedCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueReport', default: null, index: true },
    relatedBlotterId: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueReport', default: null },
    relatedComplaintId: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueReport', default: null },
    hearingScheduleRef: { type: String, default: '' },
    referenceNumber: { type: String, required: true, unique: true },
    relatedReferenceNo: { type: String, default: '' },
    residentName: { type: String, default: '' },
    type: {
      type: String,
      enum: ['Barangay Seminar', 'Counseling', 'Mediation', 'Community Service', 'Orientation', 'Custom Procedure'],
      default: 'Barangay Seminar',
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    scheduleDate: { type: String, default: '' },
    scheduleTime: { type: String, default: '' },
    venue: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Not Yet Scheduled', 'Scheduled', 'Attended', 'Missed', 'Completed', 'Failed to Comply', 'Cancelled', 'Re-Scheduled'],
      default: 'Not Yet Scheduled',
      index: true,
    },
    completionProof: { type: CompletionProofSchema, default: () => ({}) },
    remarks: { type: String, default: '' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedByName: { type: String, default: '' },
    assignedByRole: { type: String, default: '' },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedByName: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    dismissalEligible: { type: Boolean, default: false },
    overrideReason: { type: String, default: '' },
  },
  { timestamps: true },
);

SeminarRequirementSchema.index({ createdAt: -1 });
SeminarRequirementSchema.index({ residentId: 1, updatedAt: -1 });
SeminarRequirementSchema.index({ relatedComplaintId: 1, status: 1 });

export default mongoose.model('SeminarRequirement', SeminarRequirementSchema);
