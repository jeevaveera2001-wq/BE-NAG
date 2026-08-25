import express from 'express';
import { getActivityLogs } from '../controllers/activity.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);
router.use(requireSuperAdmin); // Super Admin only

router.get('/', getActivityLogs);

export default router;
