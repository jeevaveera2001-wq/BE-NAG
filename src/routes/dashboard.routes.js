import express from 'express';
import { getDashboardMetrics } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireStaffOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);
router.get('/metrics', requireStaffOrAbove, getDashboardMetrics);

export default router;
