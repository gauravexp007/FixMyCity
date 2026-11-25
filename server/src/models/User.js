import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, DEPARTMENTS } from '../utils/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.CITIZEN,
      index: true,
    },
    phone: { type: String, trim: true },
    avatar: { type: String, default: '' },
    municipality: { type: String, trim: true, default: '' },
    ward: { type: String, trim: true, default: '' },
    department: { type: String, enum: ['', ...DEPARTMENTS], default: '' },
    jurisdiction: {
      municipality: { type: String, default: '' },
      ward: { type: String, default: '' },
    },
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: true }, // citizens true; authorities need admin approval/provision
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastLoginAt: { type: Date },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);
