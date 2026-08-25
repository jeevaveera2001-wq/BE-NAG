import Payment from '../models/Payment.js';
import Bill from '../models/Bill.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS, PAYMENT_STATUS } from '../config/constants.js';

export const getPayments = async (req, res, next) => {
  try {
    const {
      search = '',
      paymentMethod,
      paymentStatus,
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
      query.$or = [{ paymentId: regex }, { billNumber: regex }, { 'customer.name': regex }, { 'customer.mobile': regex }, { transactionRefId: regex }];
    }

    if (paymentMethod && paymentMethod !== 'All') {
      query.paymentMethod = paymentMethod;
    }

    if (paymentStatus && paymentStatus !== 'All') {
      query.paymentStatus = paymentStatus;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      if (endDate) query.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate('bill', 'billNumber grandTotal items status')
        .populate('receivedBy', 'fullName username')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      payments,
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
