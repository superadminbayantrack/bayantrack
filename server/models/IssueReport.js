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

const ReportLocationSchema = new mongoose.Schema(
  {
    address: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const RelatedRecordSchema = new mongoose.Schema(
  {
    referenceNo: { type: String, default: '' },
    details: { type: String, default: '' },
    status: { type: String, default: '' },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const HearingScheduleSchema = new mongoose.Schema(
  {
    date: { type: String, default: '' },
    time: { type: String, default: '' },
    venue: { type: String, default: '' },
    remarks: { type: String, default: '' },
    status: { type: String, default: 'scheduled' },
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const CaseClosureSchema = new mongoose.Schema(
  {
    closedAt: { type: Date, default: null },
    closedByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedByName: { type: String, default: '' },
    closedByRole: { type: String, default: '' },
    reason: { type: String, default: '' },
    seminarComplianceResult: { type: String, default: '' },
    overrideReason: { type: String, default: '' },
    finalRemarks: { type: String, default: '' },
  },
  { _id: false },
);

const IssueReportSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    fullName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    address: { type: String, required: true },
    reportType: {
      type: String,
      enum: ['community-issue', 'complaint', 'incident-report'],
      default: 'community-issue',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'urgent'],
      default: 'normal',
    },
    category: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: ReportLocationSchema, default: () => ({}) },
    attachments: { type: [IssueAttachmentSchema], default: [] },
    assignedDepartment: { type: String, default: '' },
    assignedPersonnel: { type: String, default: '' },
    blotterRecord: { type: RelatedRecordSchema, default: () => ({}) },
    caseRecord: { type: RelatedRecordSchema, default: () => ({}) },
    hearingSchedule: { type: HearingScheduleSchema, default: () => ({}) },
    status: {
      type: String,
      enum: [
        'new',
        'received',
        'in-review',
        'in-progress',
        'hearing-scheduled',
        'seminar-intervention-required',
        'seminar-completed',
        'missed-seminar',
        'failed-to-comply',
        're-scheduled',
        'for-resolution',
        'resolved',
        'dismissed',
        'closed',
        'rejected',
        'archived',
      ],
      default: 'new',
    },
    closure: { type: CaseClosureSchema, default: () => ({}) },
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
IssueReportSchema.index({ reportType: 1, createdAt: -1 });
IssueReportSchema.index({ priority: 1, createdAt: -1 });

export default mongoose.model('IssueReport', IssueReportSchema);
