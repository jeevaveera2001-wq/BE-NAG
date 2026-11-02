import Expense from '../models/Expense.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS } from '../config/constants.js';

export const createExpense = async (req, res, next) => {
  try {
    const { description, amount, category, paymentMethod, date, receiptNumber, notes } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ success: false, message: 'Expense description is required' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid expense amount is required' });
    }

    const expense = await Expense.create({
      description: description.trim(),
      amount: numAmount,
      category: category ? category.trim() : 'General',
      paymentMethod: paymentMethod || 'Cash',
      date: date ? new Date(date) : new Date(),
      recordedBy: req.user._id,
      recordedByName: req.user.fullName || req.user.username || 'Staff',
      receiptNumber: receiptNumber ? receiptNumber.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.CREATE_EXPENSE,
      entityType: 'Expense',
      entityId: expense._id.toString(),
      details: `Recorded expense of ₹${numAmount} for "${expense.description}" (${expense.category}) via ${expense.paymentMethod}`,
      metadata: { description: expense.description, amount: numAmount, category: expense.category },
    });

    if (req.io) {
      req.io.emit('expense:created', { expense });
      req.io.emit('stats:updated');
    }

    res.status(201).json({
      success: true,
      message: 'Expense recorded successfully',
      expense,
    });
  } catch (error) {
    next(error);
  }
};

export const getExpenses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search = '', category, paymentMethod, startDate, endDate } = req.query;

    const query = { isDeleted: false };

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ description: regex }, { category: regex }, { receiptNumber: regex }, { notes: regex }];
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (paymentMethod && paymentMethod !== 'All') {
      query.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const [y, m, d] = startDate.split('-').map(Number);
        query.date.$gte = new Date(y, m - 1, d, 0, 0, 0, 0);
      }
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        query.date.$lte = new Date(y, m - 1, d, 23, 59, 59, 999);
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [expenses, total, sumAggregate] = await Promise.all([
      Expense.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Expense.countDocuments(query),
      Expense.aggregate([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
      ]),
    ]);

    const filteredTotalAmount = sumAggregate[0]?.totalAmount || 0;

    res.status(200).json({
      success: true,
      expenses,
      filteredTotalAmount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getExpenseDashboard = async (req, res, next) => {
  try {
    const { date, month } = req.query; // date: YYYY-MM-DD, month: YYYY-MM

    // 1. Parse Day range (default: today)
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

    // 2. Parse Month range (default: current month)
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

    // 3. Fetch Month expenses & Day expenses
    const [monthExpenses, allTimeAggregate] = await Promise.all([
      Expense.find({
        isDeleted: false,
        date: { $gte: monthStart, $lte: monthEnd },
      })
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      Expense.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    // Filter day expenses from month if within same month, else query
    let dayExpenses = [];
    if (dayStart >= monthStart && dayEnd <= monthEnd) {
      dayExpenses = monthExpenses.filter((e) => {
        const ed = new Date(e.date);
        return ed >= dayStart && ed <= dayEnd;
      });
    } else {
      dayExpenses = await Expense.find({
        isDeleted: false,
        date: { $gte: dayStart, $lte: dayEnd },
      })
        .sort({ date: -1, createdAt: -1 })
        .lean();
    }

    // Helper to calculate payment metrics
    const computeMetrics = (items) => {
      let total = 0;
      let cash = 0;
      let upi = 0;
      let card = 0;
      const catMap = {};

      for (const item of items) {
        const amt = Number(item.amount) || 0;
        total += amt;

        const pm = (item.paymentMethod || '').toLowerCase();
        if (pm.includes('cash')) {
          cash += amt;
        } else if (pm.includes('upi')) {
          upi += amt;
        } else {
          card += amt;
        }

        const cat = item.category || 'General';
        catMap[cat] = (catMap[cat] || 0) + amt;
      }

      const categories = Object.keys(catMap)
        .map((k) => ({
          category: k,
          amount: Math.round(catMap[k] * 100) / 100,
          percentage: total > 0 ? Math.round((catMap[k] / total) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        total: Math.round(total * 100) / 100,
        cash: Math.round(cash * 100) / 100,
        upi: Math.round(upi * 100) / 100,
        card: Math.round(card * 100) / 100,
        count: items.length,
        categories,
      };
    };

    const dayMetrics = computeMetrics(dayExpenses);
    const monthMetrics = computeMetrics(monthExpenses);

    // Day-by-day trend for month
    const dailyMap = {};
    for (const exp of monthExpenses) {
      const ed = new Date(exp.date);
      const dKey = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
      if (!dailyMap[dKey]) dailyMap[dKey] = [];
      dailyMap[dKey].push(exp);
    }

    const dailyTrend = Object.keys(dailyMap)
      .sort((a, b) => b.localeCompare(a))
      .map((dKey) => {
        const m = computeMetrics(dailyMap[dKey]);
        return {
          date: dKey,
          ...m,
        };
      });

    const allTimeTotal = allTimeAggregate[0]?.total || 0;
    const allTimeCount = allTimeAggregate[0]?.count || 0;

    res.status(200).json({
      success: true,
      selectedDate: formattedDay,
      selectedMonth: formattedMonth,
      day: {
        ...dayMetrics,
        expenses: dayExpenses,
      },
      month: {
        ...monthMetrics,
        dailyTrend,
      },
      allTime: {
        total: Math.round(allTimeTotal * 100) / 100,
        count: allTimeCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, amount, category, paymentMethod, date, receiptNumber, notes } = req.body;

    const expense = await Expense.findOne({ _id: id, isDeleted: false });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    if (description) expense.description = description.trim();
    if (amount !== undefined) {
      const numAmt = Number(amount);
      if (isNaN(numAmt) || numAmt <= 0) {
        return res.status(400).json({ success: false, message: 'Valid expense amount required' });
      }
      expense.amount = numAmt;
    }
    if (category) expense.category = category.trim();
    if (paymentMethod) expense.paymentMethod = paymentMethod;
    if (date) expense.date = new Date(date);
    if (receiptNumber !== undefined) expense.receiptNumber = receiptNumber.trim();
    if (notes !== undefined) expense.notes = notes.trim();

    await expense.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.UPDATE_EXPENSE,
      entityType: 'Expense',
      entityId: expense._id.toString(),
      details: `Updated expense #${expense._id}: "${expense.description}" (₹${expense.amount})`,
      metadata: { expenseId: expense._id, description: expense.description, amount: expense.amount },
    });

    if (req.io) {
      req.io.emit('expense:updated', { expense });
      req.io.emit('stats:updated');
    }

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      expense,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findOne({ _id: id, isDeleted: false });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    expense.isDeleted = true;
    await expense.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.DELETE_EXPENSE,
      entityType: 'Expense',
      entityId: expense._id.toString(),
      details: `Deleted expense #${expense._id}: "${expense.description}" (₹${expense.amount})`,
      metadata: { expenseId: expense._id, description: expense.description, amount: expense.amount },
    });

    if (req.io) {
      req.io.emit('expense:deleted', { expenseId: expense._id });
      req.io.emit('stats:updated');
    }

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
