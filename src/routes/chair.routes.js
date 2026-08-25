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
import { requireAdminOrAbove, requireStaffOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requireStaffOrAbove, getChairs);
router.get('/:id', requireStaffOrAbove, getChairById);
router.post('/', requireStaffOrAbove, createChair);
router.put('/:id', requireStaffOrAbove, updateChair);
router.patch('/:id/status', requireStaffOrAbove, updateChairStatus);
router.delete('/:id', requireAdminOrAbove, deleteChair);

export default router;
