import express from 'express';
import {
  createExpense,
  getExpenses,
  getExpenseDashboard,
  updateExpense,
  deleteExpense,
} from '../controllers/expense.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireStaffOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);

router.get('/dashboard', requireStaffOrAbove, getExpenseDashboard);
router.get('/', requireStaffOrAbove, getExpenses);
router.post('/', requireStaffOrAbove, createExpense);
router.put('/:id', requireStaffOrAbove, updateExpense);
router.delete('/:id', requireStaffOrAbove, deleteExpense);

export default router;
