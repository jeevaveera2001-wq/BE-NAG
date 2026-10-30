import express from 'express';
import {
  createBill,
  getBills,
  getBillById,
  cancelBill,
  editBill,
  downloadInvoicePDF,
} from '../controllers/bill.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdminOrAbove, requireStaffOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.post('/', requireStaffOrAbove, createBill);
router.get('/', requireStaffOrAbove, getBills);
router.get('/:id', requireStaffOrAbove, getBillById);
router.get('/:id/pdf', requireStaffOrAbove, downloadInvoicePDF);
router.put('/:id', requireAdminOrAbove, editBill);
router.post('/:id/cancel', requireAdminOrAbove, cancelBill);

export default router;
