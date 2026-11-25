import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { ROLES } from '../utils/constants.js';
import {
  createComplaint, getComplaints, getComplaintById, updateComplaintStatus,
  assignComplaint, escalateComplaint, submitFeedback, reopenComplaint,
  getDashboardStats, getComplaintMap, getEvidence,
} from '../controllers/complaintController.js';

const router = Router();
router.use(authenticate);

router.get('/stats', getDashboardStats);
router.get('/map', getComplaintMap);
router.get('/evidence', getEvidence);
router.get('/', getComplaints);
router.post('/',
  authorize(ROLES.CITIZEN),
  upload.array('media', 6),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('latitude').notEmpty().withMessage('Latitude is required'),
    body('longitude').notEmpty().withMessage('Longitude is required'),
  ],
  createComplaint
);
router.get('/:id', getComplaintById);
router.patch('/:id/status', authorize(ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR), upload.array('media', 6), updateComplaintStatus);
router.patch('/:id/assign', authorize(ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR), assignComplaint);
router.patch('/:id/escalate', authorize(ROLES.MUNICIPAL, ROLES.WARD_OFFICER, ROLES.SUPERIOR), escalateComplaint);
router.post('/:id/feedback', authorize(ROLES.CITIZEN), [body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating 1-5 required')], submitFeedback);
router.post('/:id/reopen', authorize(ROLES.CITIZEN), [body('reason').trim().notEmpty().withMessage('Reason is required')], reopenComplaint);

export default router;
