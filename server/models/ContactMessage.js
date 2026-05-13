import mongoose from 'mongoose';

const ContactMessageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true },
    contact: { type: String, required: true },
    department: { type: String, required: true },
    message: { type: String, required: true },
    referenceNo: { type: String, required: true, unique: true },
    status: { type: String, enum: ['new', 'read', 'closed'], default: 'new' },
    adminComment: { type: String, default: '' },
    handledByUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledByName: { type: String, default: '' },
    handledByRole: { type: String, default: '' },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

ContactMessageSchema.index({ user: 1, createdAt: -1 });
ContactMessageSchema.index({ status: 1, createdAt: -1 });
ContactMessageSchema.index({ department: 1, createdAt: -1 });

export default mongoose.model('ContactMessage', ContactMessageSchema);
