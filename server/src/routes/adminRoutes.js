import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';
import { getUsers, createAuthority, updateUser, getOfficers } from '../controllers/adminController.js';

const router = Router();
router.use(authenticate);

router.get('/officers', authorize(ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR), getOfficers);
router.get('/users', authorize(ROLES.SUPERIOR), getUsers);
router.post('/users',
  authorize(ROLES.SUPERIOR),
  [
    body('name').trim().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('role').isIn([ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR]),
  ],
  createAuthority
);
router.patch('/users/:id', authorize(ROLES.SUPERIOR), updateUser);

export default router;
