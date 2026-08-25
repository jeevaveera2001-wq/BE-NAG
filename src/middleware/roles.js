import { ROLES } from '../config/constants.js';

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. User authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' does not have sufficient permissions to perform this action.`,
      });
    }

    next();
  };
};

export const requireSuperAdmin = authorize(ROLES.SUPER_ADMIN);
export const requireAdminOrAbove = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN);
export const requireStaffOrAbove = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF);
