import express from 'express';
import { getDashboardMetrics } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdminOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);
router.get('/metrics', requireAdminOrAbove, getDashboardMetrics);

export default router;
