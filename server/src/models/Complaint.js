import mongoose from 'mongoose';
import { COMPLAINT_STATUS, COMPLAINT_CATEGORIES, SEVERITY_LEVELS, DEPARTMENTS } from '../utils/constants.js';

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    type: { type: String, enum: ['image', 'video'], required: true },
    filename: { type: String, default: '' },
    size: { type: Number, default: 0 },
    // Capture geo-tag: where and when the photo/video was taken.
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
    address: { type: String, default: '' },
    capturedAt: { type: Date },
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName: { type: String, default: '' },
    byRole: { type: String, default: '' },
    department: { type: String, default: '' },
    media: [mediaSchema],
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const complaintSchema = new mongoose.Schema(
  {
    complaintId: { type: String, required: true, unique: true, index: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: COMPLAINT_CATEGORIES, required: true, index: true },
    severity: { type: String, enum: SEVERITY_LEVELS, default: 'Medium' },
    status: {
      type: String,
      enum: Object.values(COMPLAINT_STATUS),
      default: COMPLAINT_STATUS.SUBMITTED,
      index: true,
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
      address: { type: String, default: '' },
      landmark: { type: String, default: '' },
      municipality: { type: String, default: '', index: true },
      ward: { type: String, default: '', index: true },
      // How the point was obtained: gps | map | address (empty = unknown).
      source: { type: String, default: '' },
    },
    media: [mediaSchema],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedDepartment: { type: String, enum: ['', ...DEPARTMENTS], default: '' },
    priority: { type: String, enum: ['Normal', 'High', 'Urgent'], default: 'Normal' },
    deadline: { type: Date },
    timeline: [timelineSchema],
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, default: '' },
      submittedAt: { type: Date },
    },
    reopen: {
      isReopened: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      reopenedAt: { type: Date },
      verified: { type: Boolean, default: false },
    },
    isDuplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' },
    duplicateCandidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Complaint' }],
    escalationLevel: { type: Number, default: 0 }, // 0 municipal, 1 ward, 2 superior
    escalatedAt: { type: Date },
    resolvedAt: { type: Date },
    rejectedReason: { type: String, default: '' },
    isSeed: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ createdAt: -1 });

export default mongoose.model('Complaint', complaintSchema);
