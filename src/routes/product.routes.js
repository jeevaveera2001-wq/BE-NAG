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
import { requireSuperAdmin, requireStaffOrAbove, requireAdminOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/history', requireStaffOrAbove, getInventoryHistory);
router.get('/', requireStaffOrAbove, getProducts);
router.get('/:id', requireStaffOrAbove, getProductById);
router.post('/', requireAdminOrAbove, createProduct);
router.put('/:id', requireAdminOrAbove, updateProduct);
router.post('/:id/adjust-stock', requireAdminOrAbove, adjustStock);
router.delete('/:id', requireSuperAdmin, deleteProduct);

export default router;
