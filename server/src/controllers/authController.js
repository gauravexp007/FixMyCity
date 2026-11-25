import { validationResult } from 'express-validator';
import { users } from '../data/index.js';
import { signToken } from '../utils/token.js';
import { ROLES } from '../utils/constants.js';
import { asyncHandler } from '../middleware/errorHandler.js';

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    return true;
  }
  return false;
}

export const register = asyncHandler(async (req, res) => {
  if (handleValidation(req, res)) return;
  const { name, email, password, phone } = req.body;
  const existing = await users.findByEmail(email);
  if (existing) return res.status(409).json({ message: 'An account with this email already exists' });

  // Public registration is citizen-only. Authority accounts are provisioned by superiors.
  const user = await users.create({
    name,
    email,
    password,
    phone,
    role: ROLES.CITIZEN,
    isApproved: true,
  });

  const token = signToken(user);
  res.status(201).json({ token, user: users.toSafeObject(user) });
});

export const login = asyncHandler(async (req, res) => {
  if (handleValidation(req, res)) return;
  const { email, password } = req.body;
  const user = await users.findByEmail(email, { withPassword: true });
  if (!user) return res.status(401).json({ message: 'Invalid email or password' });

  const ok = await users.comparePassword(user, password);
  if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
  if (!user.isActive) return res.status(403).json({ message: 'Account is disabled' });
  if (!user.isApproved) return res.status(403).json({ message: 'Account pending administrator approval' });

  user.lastLoginAt = new Date();
  await users.save(user);
  const token = signToken(user);
  res.json({ token, user: users.toSafeObject(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: users.toSafeObject(req.user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'phone', 'avatar', 'notificationPreferences'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) req.user[key] = req.body[key];
  }
  await users.save(req.user);
  res.json({ user: users.toSafeObject(req.user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  if (handleValidation(req, res)) return;
  const { currentPassword, newPassword } = req.body;
  const user = await users.findById(req.user._id, { withPassword: true });
  if (!user) return res.status(404).json({ message: 'User not found' });
  const ok = await users.comparePassword(user, currentPassword);
  if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
  await users.setPassword(user, newPassword);
  res.json({ message: 'Password updated successfully' });
});
