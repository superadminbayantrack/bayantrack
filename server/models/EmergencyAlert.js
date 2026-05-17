import mongoose from 'mongoose';

const LocationPointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number, default: null },
    heading: { type: Number, default: null },
    speed: { type: Number, default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ResidentSnapshotSchema = new mongoose.Schema(
  {
    userId: { type: String, default: '' },
    username: { type: String, default: '' },
    fullName: { type: String, default: '' },
    email: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    age: { type: String, default: 'Not recorded' },
    address: { type: String, default: '' },
  },
  { _id: false },
);

const AlertChatMessageSchema = new mongoose.Schema(
  {
    senderUser: { type: String, default: '' },
    senderRole: {
      type: String,
      enum: ['resident', 'admin', 'superadmin', 'staff'],
      default: 'resident',
    },
    senderName: { type: String, default: 'Resident' },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const AlertTypingSchema = new mongoose.Schema(
  {
    isTyping: { type: Boolean, default: false },
    name: { type: String, default: '' },
    role: { type: String, default: '' },
    at: { type: Date, default: null },
  },
  { _id: false },
);

const EmergencyAlertSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    referenceNo: { type: String, required: true, unique: true },
    situation: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved', 'cancelled'],
      default: 'active',
    },
    residentSnapshot: { type: ResidentSnapshotSchema, default: () => ({}) },
    currentLocation: { type: LocationPointSchema, required: true },
    locationHistory: { type: [LocationPointSchema], default: [] },
    chatMessages: { type: [AlertChatMessageSchema], default: [] },
    typing: {
      resident: { type: AlertTypingSchema, default: () => ({}) },
      staff: { type: AlertTypingSchema, default: () => ({}) },
    },
    adminComment: { type: String, default: '' },
    archived: { type: Boolean, default: false },
    handledByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledByName: { type: String, default: '' },
    handledByRole: { type: String, default: '' },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

EmergencyAlertSchema.index({ status: 1, updatedAt: -1 });
EmergencyAlertSchema.index({ archived: 1, status: 1, updatedAt: -1 });
EmergencyAlertSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('EmergencyAlert', EmergencyAlertSchema);
