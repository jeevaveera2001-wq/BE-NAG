import express from 'express';
import {
  login,
  refreshToken,
  getMe,
  updateProfile,
  changePassword,
  logout,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, upload.single('profilePhoto'), updateProfile);
router.put('/change-password', authenticate, changePassword);
router.post('/logout', authenticate, logout);

export default router;
