import ActivityLog from '../models/ActivityLog.js';

export const logActivity = async ({
  req,
  user,
  action,
  entityType,
  entityId = '',
  details = '',
  metadata = null,
}) => {
  try {
    const actor = user || (req && req.user);
    if (!actor) return;

    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    const userAgent = req ? (req.headers['user-agent'] || '') : '';

    await ActivityLog.create({
      user: actor._id,
      userName: actor.fullName || actor.username,
      userRole: actor.role,
      action,
      entityType,
      entityId,
      details,
      metadata,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('Audit logging failed:', error.message);
  }
};
