import express from 'express';
import { getDashboardMetrics, getPresentDayMetrics } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireStaffOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);
router.get('/metrics', requireStaffOrAbove, getDashboardMetrics);
router.get('/present-day', requireStaffOrAbove, getPresentDayMetrics);

export default router;
