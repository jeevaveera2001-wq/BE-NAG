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
router.post('/', requireStaffOrAbove, createChair);
router.put('/', requireStaffOrAbove, updateChair);
router.patch('/:id/status', requireStaffOrAbove, updateChairStatus);
router.delete('/:id', requireSuperAdmin, deleteChair);

export default router;
