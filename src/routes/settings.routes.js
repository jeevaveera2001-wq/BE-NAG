import express from 'express';
import { getSettings, updateSettings, uploadBanner } from '../controllers/settings.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roles.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Anyone logged in can view current settings
router.get('/', authenticate, getSettings);

// Only Super Admin can modify system settings & upload banner
router.put('/', authenticate, requireSuperAdmin, updateSettings);
router.post('/upload-banner', authenticate, requireSuperAdmin, upload.single('banner'), uploadBanner);

export default router;
