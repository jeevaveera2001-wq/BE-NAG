import mongoose from 'mongoose';
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
      baseSalary,
    } = req.body;

    // Purge any old soft-deleted attendant with same attendantId if exists
    await Attendant.deleteMany({ attendantId: attendantId.trim(), isDeleted: true });

    const existing = await Attendant.findOne({ attendantId: attendantId.trim() });
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
      baseSalary: baseSalary !== undefined ? Number(baseSalary) : 0,
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
    const attendant = await Attendant.findById(req.params.id);
    if (!attendant) {
      return res.status(404).json({ success: false, message: 'Attendant not found' });
    }

    await Attendant.findByIdAndDelete(req.params.id);

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
        const baseSalary = att.baseSalary || 0;
        const commissionRate = att.commissionPercentage || 10;
        const commission = (totalSales * commissionRate) / 100;
        const estimatedNetSalary = baseSalary + commission;

        return {
          attendant: att,
          totalBills: bills.length,
          totalServicesCompleted: servicesCount,
          totalSales,
          commissionRate,
          commissionEarned: commission,
          baseSalary,
          estimatedNetSalary,
        };
      })
    );

    res.status(200).json({ success: true, performance });
  } catch (error) {
    next(error);
  }
};


export const getAttendantDashboard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, month } = req.query; // date: YYYY-MM-DD, month: YYYY-MM

    // 1. Find attendant
    const attendant = await Attendant.findById(id).populate('assignedChair');
    if (!attendant) {
      return res.status(404).json({ success: false, message: 'Attendant not found' });
    }

    // 2. Parse selected day (default: today)
    let dayY, dayM, dayD;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split('-');
      dayY = parseInt(parts[0], 10);
      dayM = parseInt(parts[1], 10) - 1;
      dayD = parseInt(parts[2], 10);
    } else {
      const now = new Date();
      dayY = now.getFullYear();
      dayM = now.getMonth();
      dayD = now.getDate();
    }
    const dayStart = new Date(dayY, dayM, dayD, 0, 0, 0, 0);
    const dayEnd = new Date(dayY, dayM, dayD, 23, 59, 59, 999);
    const formattedDay = `${dayY}-${String(dayM + 1).padStart(2, '0')}-${String(dayD).padStart(2, '0')}`;

    // 3. Parse selected month (default: month of selected day, or current month)
    let monthY, monthM;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const parts = month.split('-');
      monthY = parseInt(parts[0], 10);
      monthM = parseInt(parts[1], 10) - 1;
    } else {
      monthY = dayY;
      monthM = dayM;
    }
    const monthStart = new Date(monthY, monthM, 1, 0, 0, 0, 0);
    const monthEnd = new Date(monthY, monthM + 1, 0, 23, 59, 59, 999);
    const formattedMonth = `${monthY}-${String(monthM + 1).padStart(2, '0')}`;

    // 4. Query bills strictly allocated to this attendant
    const attendantObjId = mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
    const attendantFilter = attendantObjId
      ? { $or: [{ 'attendant.attendantId': attendantObjId }, { 'attendant.attendantId': id }, { 'attendant.attendantId': String(attendant._id) }] }
      : { 'attendant.attendantId': id };

    // Month query
    const monthBills = await Bill.find({
      ...attendantFilter,
      status: BILL_STATUS.COMPLETED,
      billDate: { $gte: monthStart, $lte: monthEnd },
    })
      .sort({ billDate: -1 })
      .lean();

    // Day bills (filter from monthBills if day is inside month, else query)
    let dayBills = [];
    if (dayStart >= monthStart && dayEnd <= monthEnd) {
      dayBills = monthBills.filter((b) => {
        const bd = new Date(b.billDate);
        return bd >= dayStart && bd <= dayEnd;
      });
    } else {
      dayBills = await Bill.find({
        ...attendantFilter,
        status: BILL_STATUS.COMPLETED,
        billDate: { $gte: dayStart, $lte: dayEnd },
      })
        .sort({ billDate: -1 })
        .lean();
    }

    // Computation helper
    const computeBreakdown = (billsList) => {
      let total = 0;
      let cash = 0;
      let upi = 0;
      let card = 0;
      let split = 0;
      let directCash = 0;
      let directUpi = 0;
      let directCard = 0;
      let splitCash = 0;
      let splitUpi = 0;
      let splitCard = 0;

      for (const bill of billsList) {
        const amount = Number(bill.grandTotal) || 0;
        total += amount;

        const pm = (bill.paymentMethod || '').toLowerCase();
        if (pm.includes('cash')) {
          directCash += amount;
          cash += amount;
        } else if (pm.includes('upi')) {
          directUpi += amount;
          upi += amount;
        } else if (pm.includes('card') || pm.includes('debit') || pm.includes('credit')) {
          directCard += amount;
          card += amount;
        } else if (pm.includes('split')) {
          split += amount;
          const sp = bill.splitPaymentDetails || {};
          const spCash = Number(sp.cash) || 0;
          const spUpi = Number(sp.upi) || 0;
          const spCard = (Number(sp.debitCard) || 0) + (Number(sp.creditCard) || 0);

          splitCash += spCash;
          splitUpi += spUpi;
          splitCard += spCard;

          cash += spCash;
          upi += spUpi;
          card += spCard;
        } else {
          directCash += amount;
          cash += amount;
        }
      }

      return {
        total: Math.round(total * 100) / 100,
        cash: Math.round(cash * 100) / 100,
        upi: Math.round(upi * 100) / 100,
        card: Math.round(card * 100) / 100,
        split: Math.round(split * 100) / 100,
        directCash: Math.round(directCash * 100) / 100,
        directUpi: Math.round(directUpi * 100) / 100,
        directCard: Math.round(directCard * 100) / 100,
        splitCash: Math.round(splitCash * 100) / 100,
        splitUpi: Math.round(splitUpi * 100) / 100,
        splitCard: Math.round(splitCard * 100) / 100,
        billsCount: billsList.length,
      };
    };

    const dayMetrics = computeBreakdown(dayBills);
    const monthMetrics = computeBreakdown(monthBills);

    // Commission calculations for this attendant
    const commissionRate = attendant.commissionPercentage || 10;
    const baseSalary = attendant.baseSalary || 0;
    const commissionEarned = Math.round(((monthMetrics.total * commissionRate) / 100) * 100) / 100;
    const estimatedNetSalary = Math.round((baseSalary + commissionEarned) * 100) / 100;

    // Day-by-day map for month
    const dailyMap = {};
    for (const bill of monthBills) {
      const bd = new Date(bill.billDate);
      const dateKey = `${bd.getFullYear()}-${String(bd.getMonth() + 1).padStart(2, '0')}-${String(bd.getDate()).padStart(2, '0')}`;
      if (!dailyMap[dateKey]) dailyMap[dateKey] = [];
      dailyMap[dateKey].push(bill);
    }

    const dailyBreakdown = Object.keys(dailyMap)
      .sort((a, b) => b.localeCompare(a))
      .map((dKey) => {
        const metrics = computeBreakdown(dailyMap[dKey]);
        const dayComm = Math.round(((metrics.total * commissionRate) / 100) * 100) / 100;
        return {
          date: dKey,
          commission: dayComm,
          ...metrics,
        };
      });

    res.status(200).json({
      success: true,
      attendant: {
        _id: attendant._id,
        fullName: attendant.fullName,
        attendantId: attendant.attendantId,
        mobile: attendant.mobile,
        specialization: attendant.specialization,
        assignedChair: attendant.assignedChair,
        baseSalary,
        commissionPercentage: commissionRate,
        status: attendant.status,
      },
      selectedDate: formattedDay,
      selectedMonth: formattedMonth,
      day: {
        ...dayMetrics,
        commission: Math.round(((dayMetrics.total * commissionRate) / 100) * 100) / 100,
        bills: dayBills.map((b) => ({
          _id: b._id,
          billNumber: b.billNumber,
          billDate: b.billDate,
          customerName: b.customer?.name || 'Walk-in Customer',
          customerMobile: b.customer?.mobile || '',
          chairName: b.chair?.name || b.chair?.chairNumber || 'Standard',
          itemsCount: b.items?.length || 0,
          grandTotal: b.grandTotal,
          paymentMethod: b.paymentMethod,
          paymentStatus: b.paymentStatus,
          splitPaymentDetails: b.splitPaymentDetails,
        })),
      },
      month: {
        ...monthMetrics,
        commissionRate,
        commissionEarned,
        baseSalary,
        estimatedNetSalary,
        dailyBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};
