import express from 'express';
import {
  getAttendants,
  getAttendantById,
  createAttendant,
  updateAttendant,
  deleteAttendant,
  markAttendance,
  getAttendanceHistory,
  getAttendantPerformance,
} from '../controllers/attendant.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin, requireStaffOrAbove, requireAdminOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/performance', requireStaffOrAbove, getAttendantPerformance);
router.get('/attendance', requireStaffOrAbove, getAttendanceHistory);
router.post('/attendance', requireStaffOrAbove, markAttendance);

router.get('/', requireStaffOrAbove, getAttendants);
router.get('/:id', requireStaffOrAbove, getAttendantById);
router.post('/', requireAdminOrAbove, createAttendant);
router.put('/:id', requireAdminOrAbove, updateAttendant);
router.delete('/:id', requireSuperAdmin, deleteAttendant);

export default router;
