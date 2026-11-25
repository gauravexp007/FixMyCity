import { validationResult } from 'express-validator';
import { users } from '../data/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ROLES, DEPARTMENTS } from '../utils/constants.js';

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() }); return false; }
  return true;
}

export const getUsers = asyncHandler(async (req, res) => {
  const { role, municipality, ward, approved, search } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (municipality) filter['jurisdiction.municipality'] = municipality;
  if (ward) filter['jurisdiction.ward'] = ward;
  if (approved === 'true') filter.isApproved = true;
  if (approved === 'false') filter.isApproved = false;
  if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
  const found = await users.list({ filter, sort: '-createdAt', limit: 200 });
  res.json({ users: found });
});

export const createAuthority = asyncHandler(async (req, res) => {
  if (!validate(req, res)) return;
  const { name, email, password, role, department, municipality, ward, phone } = req.body;
  if (![ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR].includes(role)) {
    return res.status(400).json({ message: 'Invalid authority role' });
  }
  const exists = await users.findByEmail(email);
  if (exists) return res.status(409).json({ message: 'Email already registered' });
  const user = await users.create({
    name, email, password, role, phone: phone || '',
    department: department || '',
    municipality: municipality || '',
    ward: ward || '',
    jurisdiction: { municipality: municipality || '', ward: ward || '' },
    isApproved: true,
    isActive: true,
    createdBy: req.user._id,
  });
  res.status(201).json({ user: users.toSafeObject(user), message: 'Authority account provisioned' });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await users.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { name, role, department, municipality, ward, phone, isActive, isApproved } = req.body;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (department !== undefined && (department === '' || DEPARTMENTS.includes(department))) user.department = department;
  if (municipality !== undefined) { user.municipality = municipality; user.jurisdiction = { ...(user.jurisdiction || {}), municipality }; }
  if (ward !== undefined) { user.ward = ward; user.jurisdiction = { ...(user.jurisdiction || {}), ward }; }
  if (typeof isActive === 'boolean') user.isActive = isActive;
  if (typeof isApproved === 'boolean') user.isApproved = isApproved;
  if (role && [ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR, ROLES.CITIZEN].includes(role)) user.role = role;
  await users.save(user);
  res.json({ user: users.toSafeObject(user), message: 'User updated' });
});

export const getOfficers = asyncHandler(async (req, res) => {
  const { municipality, ward, role } = req.query;
  const filter = { isActive: true, isApproved: true, role: { $in: [ROLES.MUNICIPAL, ROLES.WARD_OFFICER] } };
  if (role) filter.role = role;
  if (municipality) filter['jurisdiction.municipality'] = municipality;
  if (ward) filter['jurisdiction.ward'] = ward;
  // allow municipal/ward/superior to fetch; scoped for non-superior
  if (req.user.role === ROLES.MUNICIPAL) {
    const m = req.user.jurisdiction?.municipality || req.user.municipality;
    if (m) filter['jurisdiction.municipality'] = m;
  }
  if (req.user.role === ROLES.WARD_OFFICER) {
    const m = req.user.jurisdiction?.municipality || req.user.municipality;
    const w = req.user.jurisdiction?.ward || req.user.ward;
    if (m) filter['jurisdiction.municipality'] = m;
    if (w) filter['jurisdiction.ward'] = w;
  }
  const found = await users.list({ filter, limit: 200 });
  res.json({ users: found });
});
