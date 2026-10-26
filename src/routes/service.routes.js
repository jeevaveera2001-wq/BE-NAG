import express from 'express';
import {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  bulkImportServices,
  getCategories,
} from '../controllers/service.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin, requireStaffOrAbove, requireAdminOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/categories', requireStaffOrAbove, getCategories);
router.get('/', requireStaffOrAbove, getServices);
router.get('/:id', requireStaffOrAbove, getServiceById);
router.post('/', requireStaffOrAbove, createService);
router.put('/:id', requireStaffOrAbove, updateService);
router.delete('/:id', requireSuperAdmin, deleteService);
router.post('/bulk-import', requireAdminOrAbove, bulkImportServices);

export default router;
