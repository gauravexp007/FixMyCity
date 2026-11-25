import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import Complaint from '../models/Complaint.js';
import Notification from '../models/Notification.js';
import Counter from '../models/Counter.js';
import { COMPLAINT_STATUS } from '../utils/constants.js';

/**
 * MongoDB implementation of the data layer. Queries are pushed down to
 * Mongoose exactly as before, so behaviour is unchanged when the app runs
 * without Firebase credentials (the default in development).
 */

export async function init() {
  await connectDB();
}

export async function close() {
  await disconnectDB();
}

function stripPassword(user) {
  if (!user) return user;
  if (typeof user.toSafeObject === 'function') return user.toSafeObject();
  const { password, ...rest } = user;
  return rest;
}

export const users = {
  async findByEmail(email, { withPassword = false } = {}) {
    const query = User.findOne({ email: String(email || '').toLowerCase() });
    if (withPassword) query.select('+password');
    return query;
  },

  async findById(id, { withPassword = false } = {}) {
    if (!id) return null;
    const query = User.findById(id);
    if (withPassword) query.select('+password');
    return query;
  },

  async create(data) {
    return User.create(data);
  },

  async save(user) {
    return user.save();
  },

  async setPassword(user, plainPassword) {
    user.password = plainPassword;
    return user.save();
  },

  async comparePassword(user, candidate) {
    if (!user) return false;
    if (typeof user.comparePassword === 'function') return user.comparePassword(candidate);
    return bcrypt.compare(String(candidate || ''), String(user.password || ''));
  },

  async list({ filter = {}, sort = '-createdAt', limit = 200 } = {}) {
    return User.find(filter).select('-password').sort(sort).limit(limit);
  },

  async count() {
    return User.estimatedDocumentCount();
  },

  async countByFilter(filter = {}) {
    return User.countDocuments(filter);
  },

  toSafeObject(user) {
    return stripPassword(user);
  },
};

function applyPopulate(query, populate = []) {
  let result = query;
  for (const entry of populate) result = result.populate(entry);
  return result;
}

export const complaints = {
  async create(data) {
    return Complaint.create(data);
  },

  async findById(id, { populate = [] } = {}) {
    if (!id) return null;
    return applyPopulate(Complaint.findById(id), populate);
  },

  async save(complaint) {
    return complaint.save();
  },

  async list({ filter = {}, sort = '-createdAt', page = 1, limit = 20, populate = [] } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    return applyPopulate(Complaint.find(filter), populate)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
  },

  async count(filter = {}) {
    return Complaint.countDocuments(filter);
  },

  async mapList({ filter = {}, limit = 1000 } = {}) {
    return Complaint.find(filter)
      .select('complaintId title category severity status location createdAt priority assignedDepartment')
      .limit(limit)
      .sort('-createdAt');
  },

  async findDuplicateCandidates({ lng, lat, category, reporterId }) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return Complaint.find({
      reporter: { $ne: reporterId },
      category,
      status: { $nin: [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED] },
      createdAt: { $gte: since },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 100,
        },
      },
    })
      .limit(5)
      .select('_id complaintId title status createdAt');
  },

  async stats(filter = {}) {
    const [
      total, pending, inProgress, resolved, escalated, rejected,
      byStatus, byCategory, bySeverity, recent, overdue,
      deptAgg, wardAgg, avgRes,
    ] = await Promise.all([
      Complaint.countDocuments(filter),
      Complaint.countDocuments({ ...filter, status: { $in: [COMPLAINT_STATUS.SUBMITTED, COMPLAINT_STATUS.UNDER_REVIEW, COMPLAINT_STATUS.VERIFIED] } }),
      Complaint.countDocuments({ ...filter, status: { $in: [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS] } }),
      Complaint.countDocuments({ ...filter, status: COMPLAINT_STATUS.RESOLVED }),
      Complaint.countDocuments({ ...filter, status: COMPLAINT_STATUS.ESCALATED }),
      Complaint.countDocuments({ ...filter, status: COMPLAINT_STATUS.REJECTED }),
      Complaint.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Complaint.aggregate([{ $match: filter }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Complaint.aggregate([{ $match: filter }, { $group: { _id: '$severity', count: { $sum: 1 } } }]),
      Complaint.find(filter)
        .sort('-createdAt')
        .limit(8)
        .populate('reporter', 'name')
        .select('complaintId title status category severity createdAt location.municipality location.ward priority'),
      Complaint.countDocuments({ ...filter, deadline: { $lt: new Date() }, status: { $nin: [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED] } }),
      Complaint.aggregate([
        { $match: { ...filter, assignedDepartment: { $ne: '' } } },
        { $group: { _id: '$assignedDepartment', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', COMPLAINT_STATUS.RESOLVED] }, 1, 0] } } } },
        { $sort: { total: -1 } },
      ]),
      Complaint.aggregate([
        { $match: { ...filter, 'location.ward': { $ne: '' } } },
        {
          $group: {
            _id: '$location.ward',
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ['$status', COMPLAINT_STATUS.RESOLVED] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $in: ['$status', [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED]] }, 0, 1] } },
          },
        },
        { $sort: { total: -1 } },
      ]),
      Complaint.aggregate([
        { $match: { ...filter, status: COMPLAINT_STATUS.RESOLVED, resolvedAt: { $exists: true } } },
        { $project: { diff: { $subtract: ['$resolvedAt', '$createdAt'] } } },
        { $group: { _id: null, avg: { $avg: '$diff' } } },
      ]),
    ]);

    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const trendAgg = await Complaint.aggregate([
      { $match: { ...filter, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          total: { $sum: 1 },
          resolved: { $sum: { $cond: [{ $eq: ['$status', COMPLAINT_STATUS.RESOLVED] }, 1, 0] } },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return {
      trend: trendAgg.map((row) => ({ month: monthNames[row._id.m - 1], total: row.total, resolved: row.resolved })),
      stats: {
        total, pending, inProgress, resolved, escalated, rejected, overdue,
        avgResolutionHours: Math.round((avgRes[0]?.avg || 0) / 36e5),
      },
      byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
      byCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
      bySeverity: bySeverity.map((s) => ({ severity: s._id, count: s.count })),
      byDepartment: deptAgg.map((d) => ({ department: d._id, total: d.total, resolved: d.resolved })),
      byWard: wardAgg.map((w) => ({ ward: w._id, total: w.total, resolved: w.resolved, pending: w.pending })),
      recent,
    };
  },

  async clearSeed() {
    await Complaint.deleteMany({ isSeed: true });
  },
};

export const notifications = {
  async create(data) {
    return Notification.create(data);
  },

  async listForUser(userId, { page = 1, limit = 30, unread = false } = {}) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 30));
    const filter = { user: userId };
    if (unread) filter.read = false;
    return Notification.find(filter)
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('complaint', 'complaintId title status');
  },

  async countForUser(userId, { unreadOnly = false } = {}) {
    const filter = { user: userId };
    if (unreadOnly) filter.read = false;
    return Notification.countDocuments(filter);
  },

  async markRead(id, userId) {
    return Notification.findOneAndUpdate({ _id: id, user: userId }, { read: true }, { new: true });
  },

  async markAllRead(userId) {
    await Notification.updateMany({ user: userId, read: false }, { read: true });
  },

  async clearSeed() {
    await Notification.deleteMany({ 'metadata.seed': true });
  },
};

export const counters = {
  async next(key) {
    const counter = await Counter.findOneAndUpdate(
      { key },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    return counter.seq;
  },
};

export async function clearSeedData(seedEmails = []) {
  await notifications.clearSeed();
  await complaints.clearSeed();
  await User.deleteMany({ email: { $in: seedEmails } });
}
