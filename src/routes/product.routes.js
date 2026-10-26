import express from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
  deleteProduct,
  getInventoryHistory,
} from '../controllers/product.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin, requireStaffOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/history', requireStaffOrAbove, getInventoryHistory);
router.get('/', requireStaffOrAbove, getProducts);
router.get('/:id', requireStaffOrAbove, getProductById);
router.post('/', requireStaffOrAbove, createProduct);
router.put('/:id', requireStaffOrAbove, updateProduct);
router.post('/:id/adjust-stock', requireStaffOrAbove, adjustStock);
router.delete('/:id', requireSuperAdmin, deleteProduct);

export default router;
