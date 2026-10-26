import express from 'express';
import {
  getCustomers,
  searchCustomerByMobile,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin, requireStaffOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/search/:mobile', requireStaffOrAbove, searchCustomerByMobile);
router.get('/', requireStaffOrAbove, getCustomers);
router.get('/:id', requireStaffOrAbove, getCustomerById);
router.post('/', requireStaffOrAbove, createCustomer);
router.put('/:id', requireStaffOrAbove, updateCustomer);
router.delete('/:id', requireSuperAdmin, deleteCustomer);

export default router;
