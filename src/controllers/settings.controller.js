import ApplicationSettings from '../models/ApplicationSettings.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS } from '../config/constants.js';

export const getSettings = async (req, res, next) => {
  try {
    let settings = await ApplicationSettings.findOne();
    if (!settings) {
      settings = await ApplicationSettings.create({
        salonName: 'NAGULAN Unisex Salon',
        tagline: 'Hair | Skin | Beauty | Makeup',
        franchiseEnquiry: '97899 61617',
        phone: '97899 61617',
        email: 'nagulanunisexsalon@gmail.com',
        address: 'NAGULAN Unisex Salon, Premium Styling Studio, Tamil Nadu, India',
        gstNumber: '33AABCN1234F1Z9',
        isGstEnabled: true,
        defaultGstPercent: 18,
        cgstPercent: 9,
        sgstPercent: 9,
        currencySymbol: '₹',
        receiptFooterMessage: 'Thank you for visiting NAGULAN Unisex Salon',
        receiptSubFooter: 'Visit Again',
      });
    }
    res.status(200).json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    let settings = await ApplicationSettings.findOne();
    if (!settings) {
      settings = new ApplicationSettings();
    }

    const updates = req.body;
    Object.assign(settings, updates);
    settings.updatedBy = req.user._id;
    await settings.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.UPDATE_SETTINGS,
      entityType: 'Settings',
      entityId: settings._id.toString(),
      details: 'Updated salon settings and business parameters',
    });

    if (req.io) {
      req.io.emit('settings:updated', { settings });
    }

    res.status(200).json({ success: true, message: 'Settings updated successfully', settings });
  } catch (error) {
    next(error);
  }
};

export const uploadBanner = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file.' });
    }

    let settings = await ApplicationSettings.findOne();
    if (!settings) {
      settings = new ApplicationSettings();
    }

    settings.bannerUrl = `/uploads/${req.file.filename}`;
    settings.updatedBy = req.user._id;
    await settings.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.UPDATE_SETTINGS,
      entityType: 'Settings',
      entityId: settings._id.toString(),
      details: 'Uploaded new brand banner image',
    });

    if (req.io) {
      req.io.emit('settings:updated', { settings });
    }

    res.status(200).json({
      success: true,
      message: 'Banner uploaded successfully',
      bannerUrl: settings.bannerUrl,
      settings,
    });
  } catch (error) {
    next(error);
  }
};
