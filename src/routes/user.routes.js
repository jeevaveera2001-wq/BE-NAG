import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);
router.use(requireSuperAdmin); // Only Super Admin can access user management

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.post('/:id/reset-password', resetUserPassword);
router.delete('/:id', deleteUser);

export default router;
