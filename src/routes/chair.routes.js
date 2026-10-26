import express from 'express';
import {
  getChairs,
  getChairById,
  createChair,
  updateChair,
  updateChairStatus,
  deleteChair,
} from '../controllers/chair.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin, requireStaffOrAbove, requireAdminOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requireStaffOrAbove, getChairs);
router.get('/:id', requireStaffOrAbove, getChairById);
router.post('/', requireAdminOrAbove, createChair);
router.put('/', requireAdminOrAbove, updateChair);
router.patch('/:id/status', requireAdminOrAbove, updateChairStatus);
router.delete('/:id', requireSuperAdmin, deleteChair);

export default router;
