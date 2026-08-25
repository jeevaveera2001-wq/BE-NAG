import express from 'express';
import { getPayments, getPaymentById, recordPayment } from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireStaffOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/', requireStaffOrAbove, getPayments);
router.get('/:id', requireStaffOrAbove, getPaymentById);
router.post('/', requireStaffOrAbove, recordPayment);

export default router;
