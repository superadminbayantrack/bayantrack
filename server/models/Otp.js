import mongoose from 'mongoose';

const OtpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Document automatically deletes after 5 minutes (300 seconds)
  }
});

OtpSchema.index({ email: 1 }, { unique: true });

export default mongoose.model('Otp', OtpSchema);
