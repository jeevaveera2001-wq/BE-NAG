import ActivityLog from '../models/ActivityLog.js';

export const getActivityLogs = async (req, res, next) => {
  try {
    const { action, entityType, userId, search = '', page = 1, limit = 50 } = req.query;
    const query = {};

    if (action && action !== 'All') {
      query.action = action;
    }

    if (entityType && entityType !== 'All') {
      query.entityType = entityType;
    }

    if (userId) {
      query.user = userId;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ userName: regex }, { details: regex }, { action: regex }, { entityType: regex }, { ipAddress: regex }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      ActivityLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      logs,
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
