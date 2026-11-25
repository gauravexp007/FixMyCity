import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'complaint_submitted',
        'status_update',
        'assignment',
        'deadline_reminder',
        'escalation',
        'resolved',
        'feedback',
        'system',
      ],
      default: 'system',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
    read: { type: Boolean, default: false, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
