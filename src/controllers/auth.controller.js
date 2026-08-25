import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS } from '../config/constants.js';

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, username: user.username },
    process.env.JWT_SECRET || 'nagulan_salon_super_secret_jwt_key_2026_x99',
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || 'nagulan_salon_refresh_jwt_key_2026_y88',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  return { accessToken, refreshToken };
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username/email and password.',
      });
    }

    const trimmedIdentifier = identifier.trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ email: trimmedIdentifier }, { username: trimmedIdentifier }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User not found.',
      });
    }

    // Check account lock
    if (user.isLocked()) {
      const waitMins = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(423).json({
        success: false,
        message: `Account is temporarily locked. Please try again in ${waitMins} minute(s).`,
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact Super Admin.',
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
        await user.save();
        return res.status(423).json({
          success: false,
          message: 'Too many failed login attempts. Account locked for 15 minutes.',
        });
      }
      await user.save();
      return res.status(401).json({
        success: false,
        message: `Invalid password. ${5 - user.failedLoginAttempts} attempts remaining.`,
      });
    }

    // Reset failed attempts & update last login
    user.failedLoginAttempts = 0;
    user.lockUntil = undefined;
    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user);

    await logActivity({
      req,
      user,
      action: ACTIVITY_ACTIONS.LOGIN,
      entityType: 'User',
      entityId: user._id.toString(),
      details: `${user.fullName} (${user.role}) logged in successfully.`,
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        shift: user.shift,
        profilePhoto: user.profilePhoto,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'nagulan_salon_refresh_jwt_key_2026_y88');
    const user = await User.findById(decoded.id);

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or inactive user.',
      });
    }

    const tokens = generateTokens(user);

    res.status(200).json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token.',
    });
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { fullName, mobile, address, shift } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (fullName) user.fullName = fullName.trim();
    if (mobile) user.mobile = mobile.trim();
    if (address) user.address = address.trim();
    if (shift) user.shift = shift;

    if (req.file) {
      user.profilePhoto = `/uploads/${req.file.filename}`;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    user.password = newPassword;
    await user.save();

    await logActivity({
      req,
      user,
      action: ACTIVITY_ACTIONS.UPDATE_USER,
      entityType: 'User',
      entityId: user._id.toString(),
      details: `${user.fullName} changed their password.`,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res) => {
  if (req.user) {
    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.LOGOUT,
      entityType: 'User',
      entityId: req.user._id.toString(),
      details: `${req.user.fullName} logged out.`,
    });
  }
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};
