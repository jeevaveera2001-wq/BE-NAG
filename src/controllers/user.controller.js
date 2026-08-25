import User from '../models/User.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ROLES, ACTIVITY_ACTIONS } from '../config/constants.js';

export const getUsers = async (req, res, next) => {
  try {
    const { role, search = '', status, page = 1, limit = 50 } = req.query;
    const query = {};

    // If request user is Admin, they can only view Staff
    if (req.user.role === ROLES.ADMIN) {
      query.role = ROLES.STAFF;
    } else if (role && role !== 'All') {
      query.role = role;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ fullName: regex }, { username: regex }, { email: regex }, { mobile: regex }, { employeeId: regex }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query).populate('createdBy', 'fullName username').sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Admin cannot view Super Admin or other Admins
    if (req.user.role === ROLES.ADMIN && user.role !== ROLES.STAFF) {
      return res.status(403).json({ success: false, message: 'Access denied to view this account.' });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { employeeId, fullName, username, email, mobile, password, role, address, shift } = req.body;

    // Role creation validation
    if (req.user.role === ROLES.ADMIN && role !== ROLES.STAFF) {
      return res.status(403).json({
        success: false,
        message: 'Admins are only permitted to create Staff accounts.',
      });
    }

    if (role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Only existing Super Admins can create another Super Admin.',
      });
    }

    // Check duplicate username or email
    const existingUser = await User.findOne({
      $or: [{ username: username.trim().toLowerCase() }, { email: email.trim().toLowerCase() }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this username or email already exists.',
      });
    }

    const empId = employeeId || `EMP-${Date.now().toString().slice(-4)}`;

    const user = await User.create({
      employeeId: empId,
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
      password,
      role: role || ROLES.STAFF,
      address: address || '',
      shift: shift || 'Full Day',
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.CREATE_USER,
      entityType: 'User',
      entityId: user._id.toString(),
      details: `Created new ${user.role} account: ${user.fullName} (${user.username})`,
    });

    res.status(201).json({
      success: true,
      message: `${user.role.toUpperCase()} account created successfully`,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role check: Admin cannot edit Super Admin or other Admin
    if (req.user.role === ROLES.ADMIN && targetUser.role !== ROLES.STAFF) {
      return res.status(403).json({
        success: false,
        message: 'Admins cannot modify Admin or Super Admin accounts.',
      });
    }

    const { fullName, email, mobile, address, shift, status, role } = req.body;

    if (fullName) targetUser.fullName = fullName.trim();
    if (email) targetUser.email = email.trim().toLowerCase();
    if (mobile) targetUser.mobile = mobile.trim();
    if (address !== undefined) targetUser.address = address;
    if (shift) targetUser.shift = shift;
    if (status) targetUser.status = status;

    // Only Super Admin can change a user's role
    if (role && req.user.role === ROLES.SUPER_ADMIN) {
      targetUser.role = role;
    }

    await targetUser.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.UPDATE_USER,
      entityType: 'User',
      entityId: targetUser._id.toString(),
      details: `Updated account for ${targetUser.fullName} (${targetUser.role})`,
    });

    res.status(200).json({
      success: true,
      message: 'User account updated successfully',
      user: targetUser,
    });
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Role check
    if (req.user.role === ROLES.ADMIN && targetUser.role !== ROLES.STAFF) {
      return res.status(403).json({
        success: false,
        message: 'Admins cannot reset passwords for Admin or Super Admin accounts.',
      });
    }

    targetUser.password = newPassword;
    targetUser.failedLoginAttempts = 0;
    targetUser.lockUntil = undefined;
    await targetUser.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.RESET_PASSWORD,
      entityType: 'User',
      entityId: targetUser._id.toString(),
      details: `Reset password for ${targetUser.fullName} (${targetUser.username})`,
    });

    res.status(200).json({
      success: true,
      message: `Password reset successfully for ${targetUser.fullName}`,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Only Super Admin can delete users, Admin cannot delete Admins or Super Admins
    if (targetUser.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Super Admin accounts cannot be deleted.',
      });
    }

    if (req.user.role === ROLES.ADMIN && targetUser.role !== ROLES.STAFF) {
      return res.status(403).json({
        success: false,
        message: 'Admins can only delete Staff accounts.',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.DELETE_USER,
      entityType: 'User',
      entityId: req.params.id,
      details: `Deleted ${targetUser.role} account: ${targetUser.fullName} (${targetUser.username})`,
    });

    res.status(200).json({ success: true, message: 'User account removed successfully' });
  } catch (error) {
    next(error);
  }
};
