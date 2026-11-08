import Payment from '../models/Payment.js';
import Bill from '../models/Bill.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS, PAYMENT_STATUS, ROLES } from '../config/constants.js';

export const getPayments = async (req, res, next) => {
  try {
    const {
      search = '',
      paymentMethod,
      paymentStatus,
      date,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { paymentId: regex },
        { billNumber: regex },
        { 'customer.name': regex },
        { 'customer.mobile': regex },
        { transactionRefId: regex },
      ];
    }

    if (paymentMethod && paymentMethod !== 'All') {
      query.paymentMethod = paymentMethod;
    }

    if (paymentStatus && paymentStatus !== 'All') {
      query.paymentStatus = paymentStatus;
    }

    // Determine effective date range
    let effectiveStartDate = startDate || date || '';
    let effectiveEndDate = endDate || date || '';

    // If only one date is provided, default the other to the same date to target that single day
    if (effectiveStartDate && !effectiveEndDate) effectiveEndDate = effectiveStartDate;
    if (!effectiveStartDate && effectiveEndDate) effectiveStartDate = effectiveEndDate;

    // All-time unrestricted access is reserved exclusively for Super Admin
    if (req.user?.role !== ROLES.SUPER_ADMIN && !effectiveStartDate && !effectiveEndDate) {
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      effectiveStartDate = todayStr;
      effectiveEndDate = todayStr;
    }

    if (effectiveStartDate || effectiveEndDate) {
      query.createdAt = {};
      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveStartDate)) {
        query.createdAt.$gte = new Date(`${effectiveStartDate}T00:00:00+05:30`);
      } else {
        query.createdAt.$gte = new Date(new Date(effectiveStartDate).setHours(0, 0, 0, 0));
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(effectiveEndDate)) {
        query.createdAt.$lte = new Date(`${effectiveEndDate}T23:59:59.999+05:30`);
      } else {
        query.createdAt.$lte = new Date(new Date(effectiveEndDate).setHours(23, 59, 59, 999));
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Filter for summary calculations - exclude unpaid/cancelled unless explicitly filtered
    const summaryQuery = { ...query };
    if (!paymentStatus || paymentStatus === 'All') {
      summaryQuery.paymentStatus = { $ne: PAYMENT_STATUS.UNPAID };
    }

    const [payments, total, allMatchingPayments] = await Promise.all([
      Payment.find(query)
        .populate('bill', 'billNumber grandTotal items status')
        .populate('receivedBy', 'fullName username')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(query),
      Payment.find(summaryQuery)
        .select('amountPaid paymentMethod splitDetails createdAt paymentStatus billNumber totalBillAmount')
        .lean(),
    ]);

    // Compute complete summary & per-date breakdown
    const summary = {
      totalAmount: 0,
      cash: 0,
      upi: 0,
      card: 0,
      split: 0,
      directCash: 0,
      directUpi: 0,
      directCard: 0,
      splitCash: 0,
      splitUpi: 0,
      splitCard: 0,
      totalTransactions: allMatchingPayments.length,
    };

    const dateMap = {};

    for (const p of allMatchingPayments) {
      const amount = Number(p.amountPaid) || 0;
      summary.totalAmount += amount;

      // Extract IST date string (YYYY-MM-DD)
      const istDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(p.createdAt));

      if (!dateMap[istDateStr]) {
        dateMap[istDateStr] = {
          date: istDateStr,
          totalAmount: 0,
          cash: 0,
          upi: 0,
          card: 0,
          split: 0,
          directCash: 0,
          directUpi: 0,
          directCard: 0,
          splitCash: 0,
          splitUpi: 0,
          splitCard: 0,
          count: 0,
        };
      }

      const d = dateMap[istDateStr];
      d.totalAmount += amount;
      d.count += 1;

      const pm = (p.paymentMethod || '').toLowerCase();
      if (pm.includes('cash')) {
        summary.directCash += amount;
        summary.cash += amount;
        d.directCash += amount;
        d.cash += amount;
      } else if (pm.includes('upi')) {
        summary.directUpi += amount;
        summary.upi += amount;
        d.directUpi += amount;
        d.upi += amount;
      } else if (pm.includes('card')) {
        summary.directCard += amount;
        summary.card += amount;
        d.directCard += amount;
        d.card += amount;
      } else if (pm.includes('split')) {
        summary.split += amount;
        d.split += amount;

        const sp = p.splitDetails || {};
        const spCash = Number(sp.cash) || 0;
        const spUpi = Number(sp.upi) || 0;
        const spCard = (Number(sp.debitCard) || 0) + (Number(sp.creditCard) || 0);

        summary.splitCash += spCash;
        summary.splitUpi += spUpi;
        summary.splitCard += spCard;

        summary.cash += spCash;
        summary.upi += spUpi;
        summary.card += spCard;

        d.splitCash += spCash;
        d.splitUpi += spUpi;
        d.splitCard += spCard;

        d.cash += spCash;
        d.upi += spUpi;
        d.card += spCard;
      } else {
        summary.directCash += amount;
        summary.cash += amount;
        d.directCash += amount;
        d.cash += amount;
      }
    }

    const round = (val) => Math.round((Number(val) || 0) * 100) / 100;
    summary.totalAmount = round(summary.totalAmount);
    summary.cash = round(summary.cash);
    summary.upi = round(summary.upi);
    summary.card = round(summary.card);
    summary.split = round(summary.split);
    summary.directCash = round(summary.directCash);
    summary.directUpi = round(summary.directUpi);
    summary.directCard = round(summary.directCard);
    summary.splitCash = round(summary.splitCash);
    summary.splitUpi = round(summary.splitUpi);
    summary.splitCard = round(summary.splitCard);

    const dateBreakdown = Object.values(dateMap)
      .map((item) => ({
        ...item,
        totalAmount: round(item.totalAmount),
        cash: round(item.cash),
        upi: round(item.upi),
        card: round(item.card),
        split: round(item.split),
        directCash: round(item.directCash),
        directUpi: round(item.directUpi),
        directCard: round(item.directCard),
        splitCash: round(item.splitCash),
        splitUpi: round(item.splitUpi),
        splitCard: round(item.splitCard),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.status(200).json({
      success: true,
      payments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      summary,
      dateBreakdown,
      selectedDateRange: {
        startDate: effectiveStartDate || null,
        endDate: effectiveEndDate || null,
        isSingleDate: !!(effectiveStartDate && effectiveStartDate === effectiveEndDate),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('bill')
      .populate('receivedBy', 'fullName username');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }
    res.status(200).json({ success: true, payment });
  } catch (error) {
    next(error);
  }
};

export const recordPayment = async (req, res, next) => {
  try {
    const { billId, amountPaid, paymentMethod, transactionRefId, splitDetails, notes } = req.body;

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const newAmountReceived = (bill.amountReceived || 0) + Number(amountPaid);
    const newBalance = Math.max(0, bill.grandTotal - newAmountReceived);
    const newPaymentStatus = newBalance === 0 ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.PARTIAL;

    bill.amountReceived = newAmountReceived;
    bill.balanceAmount = newBalance;
    bill.paymentStatus = newPaymentStatus;
    if (paymentMethod) bill.paymentMethod = paymentMethod;
    if (splitDetails) bill.splitPaymentDetails = splitDetails;
    await bill.save();

    const paymentId = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payment = await Payment.create({
      paymentId,
      bill: bill._id,
      billNumber: bill.billNumber,
      customer: {
        customerId: bill.customer?.customerId,
        name: bill.customer?.name,
        mobile: bill.customer?.mobile,
      },
      totalBillAmount: bill.grandTotal,
      amountPaid: Number(amountPaid),
      balanceAmount: newBalance,
      paymentMethod: paymentMethod || bill.paymentMethod,
      splitDetails: splitDetails || bill.splitPaymentDetails,
      transactionRefId: transactionRefId || '',
      paymentStatus: newPaymentStatus,
      notes: notes || 'Settlement payment',
      receivedBy: req.user._id,
    });

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.RECORD_PAYMENT,
      entityType: 'Payment',
      entityId: payment._id.toString(),
      details: `Recorded ₹${amountPaid} payment for Bill #${bill.billNumber} via ${payment.paymentMethod}`,
    });

    if (req.io) {
      req.io.emit('payment:recorded', { payment, bill });
      req.io.emit('stats:updated');
    }

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment,
      bill,
    });
  } catch (error) {
    next(error);
  }
};
