import Attendant from '../models/Attendant.js';
import Attendance from '../models/Attendance.js';
import Bill from '../models/Bill.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS, BILL_STATUS } from '../config/constants.js';

export const getAttendants = async (req, res, next) => {
  try {
    const { search = '', status, page = 1, limit = 50 } = req.query;
    const query = { isDeleted: false };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ fullName: regex }, { attendantId: regex }, { mobile: regex }, { specialization: regex }];
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [attendants, total] = await Promise.all([
      Attendant.find(query).populate('assignedChair').sort({ fullName: 1 }).skip(skip).limit(limitNum),
      Attendant.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      attendants,
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

export const getAttendantById = async (req, res, next) => {
  try {
    const attendant = await Attendant.findOne({ _id: req.params.id, isDeleted: false }).populate('assignedChair');
    if (!attendant) {
      return res.status(404).json({ success: false, message: 'Attendant not found' });
    }
    res.status(200).json({ success: true, attendant });
  } catch (error) {
    next(error);
  }
};

export const createAttendant = async (req, res, next) => {
  try {
    const {
      attendantId,
      fullName,
      mobile,
      email,
      address,
      specialization,
      assignedChair,
      shiftTiming,
      commissionPercentage,
    } = req.body;

    const existing = await Attendant.findOne({ attendantId: attendantId.trim(), isDeleted: false });
    if (existing) {
      return res.status(400).json({ success: false, message: `Attendant ID "${attendantId}" is already taken.` });
    }

    const attendant = await Attendant.create({
      attendantId: attendantId.trim(),
      fullName: fullName.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim().toLowerCase() : '',
      address: address || '',
      specialization: Array.isArray(specialization) ? specialization : [specialization || 'Hair Styling'],
      assignedChair: assignedChair || null,
      shiftTiming: shiftTiming || '9:00 AM - 6:00 PM',
      commissionPercentage: commissionPercentage !== undefined ? commissionPercentage : 10,
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.UPDATE_SETTINGS,
      entityType: 'Attendant',
      entityId: attendant._id.toString(),
      details: `Added attendant "${attendant.fullName}" (${attendant.attendantId})`,
    });

    res.status(201).json({ success: true, message: 'Attendant added successfully', attendant });
  } catch (error) {
    next(error);
  }
};

export const updateAttendant = async (req, res, next) => {
  try {
    const attendant = await Attendant.findOne({ _id: req.params.id, isDeleted: false });
    if (!attendant) {
      return res.status(404).json({ success: false, message: 'Attendant not found' });
    }

    const updates = req.body;
    if (updates.email) updates.email = updates.email.trim().toLowerCase();
    Object.assign(attendant, updates);
    await attendant.save();

    res.status(200).json({ success: true, message: 'Attendant updated successfully', attendant });
  } catch (error) {
    next(error);
  }
};

export const deleteAttendant = async (req, res, next) => {
  try {
    const attendant = await Attendant.findOne({ _id: req.params.id, isDeleted: false });
    if (!attendant) {
      return res.status(404).json({ success: false, message: 'Attendant not found' });
    }

    attendant.isDeleted = true;
    await attendant.save();

    res.status(200).json({ success: true, message: 'Attendant removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const markAttendance = async (req, res, next) => {
  try {
    const { attendantId, date, status = 'Present', checkInTime, checkOutTime, notes } = req.body;

    const targetDate = date || new Date().toISOString().slice(0, 10);

    const record = await Attendance.findOneAndUpdate(
      { attendant: attendantId, date: targetDate },
      {
        attendant: attendantId,
        date: targetDate,
        status,
        checkInTime: checkInTime || (status === 'Present' ? new Date() : null),
        checkOutTime: checkOutTime || null,
        notes: notes || '',
        recordedBy: req.user._id,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: 'Attendance recorded successfully', record });
  } catch (error) {
    next(error);
  }
};

export const getAttendanceHistory = async (req, res, next) => {
  try {
    const { attendantId, date, startDate, endDate } = req.query;
    const query = {};

    if (attendantId) query.attendant = attendantId;
    if (date) query.date = date;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }

    const records = await Attendance.find(query)
      .populate('attendant', 'fullName attendantId mobile specialization')
      .sort({ date: -1 });

    res.status(200).json({ success: true, records });
  } catch (error) {
    next(error);
  }
};

export const getAttendantPerformance = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const dateQuery = {};

    if (startDate) dateQuery.$gte = new Date(new Date(startDate).setHours(0, 0, 0, 0));
    if (endDate) dateQuery.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));

    const attendants = await Attendant.find({ isDeleted: false, status: 'active' });

    const performance = await Promise.all(
      attendants.map(async (att) => {
        const filter = {
          'attendant.attendantId': att._id,
          status: BILL_STATUS.COMPLETED,
        };
        if (startDate || endDate) filter.billDate = dateQuery;

        const bills = await Bill.find(filter);
        const totalSales = bills.reduce((acc, b) => acc + (b.grandTotal || 0), 0);
        let servicesCount = 0;
        bills.forEach((b) => {
          servicesCount += b.items.filter((i) => i.itemType === 'service').length;
        });

        const commission = (totalSales * (att.commissionPercentage || 10)) / 100;

        return {
          attendant: att,
          totalBills: bills.length,
          totalServicesCompleted: servicesCount,
          totalSales,
          commissionEarned: commission,
        };
      })
    );

    res.status(200).json({ success: true, performance });
  } catch (error) {
    next(error);
  }
};
