import Bill from '../models/Bill.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Chair from '../models/Chair.js';
import Attendant from '../models/Attendant.js';
import Payment from '../models/Payment.js';
import ApplicationSettings from '../models/ApplicationSettings.js';
import { generateInvoicePDF } from '../utils/pdfGenerator.js';
import { logActivity } from '../middleware/auditLogger.js';
import {
  BILL_STATUS,
  PAYMENT_STATUS,
  CHAIR_STATUS,
  INVENTORY_TRANSACTION_TYPES,
  ACTIVITY_ACTIONS,
  ROLES,
} from '../config/constants.js';

// Helper to generate next unique bill number
const generateBillNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `NAG-${dateStr}-`;

  const lastBill = await Bill.findOne({
    billNumber: new RegExp(`^${prefix}`),
  })
    .sort({ billNumber: -1 })
    .select('billNumber');

  let nextSeq = 1;
  if (lastBill && lastBill.billNumber) {
    const parts = lastBill.billNumber.split('-');
    const currentSeq = parseInt(parts[2], 10);
    if (!isNaN(currentSeq)) {
      nextSeq = currentSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
};

export const createBill = async (req, res, next) => {
  try {
    const {
      customer,
      chair,
      attendant,
      items,
      subtotal,
      discountType = 'fixed',
      discountValue = 0,
      discountTotal = 0,
      taxPercent = 18,
      cgst = 0,
      sgst = 0,
      taxTotal = 0,
      grandTotal,
      amountReceived = 0,
      balanceAmount = 0,
      paymentMethod = 'Cash',
      splitPaymentDetails,
      paymentStatus = PAYMENT_STATUS.PAID,
      notes = '',
      status = BILL_STATUS.COMPLETED,
    } = req.body;

    if (!customer?.name || !customer?.mobile) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and mobile number are required.',
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one service or product item is required.',
      });
    }

    const billNumber = await generateBillNumber();

    // 1. Find or create Customer
    let customerDoc = await Customer.findOne({ mobile: customer.mobile.trim() });
    if (!customerDoc) {
      customerDoc = await Customer.create({
        name: customer.name.trim(),
        mobile: customer.mobile.trim(),
        email: customer.email ? customer.email.trim().toLowerCase() : '',
        totalVisits: 1,
        totalSpent: status === BILL_STATUS.COMPLETED ? grandTotal : 0,
        lastVisit: new Date(),
      });
    } else {
      customerDoc.name = customer.name.trim();
      if (customer.email) customerDoc.email = customer.email.trim().toLowerCase();
      if (status === BILL_STATUS.COMPLETED) {
        customerDoc.totalVisits += 1;
        customerDoc.totalSpent += grandTotal;
        customerDoc.lastVisit = new Date();
      }
      await customerDoc.save();
    }

    // 2. Create Bill
    const newBill = new Bill({
      billNumber,
      billDate: new Date(),
      customer: {
        customerId: customerDoc._id,
        name: customer.name.trim(),
        mobile: customer.mobile.trim(),
        email: customer.email || '',
      },
      chair: {
        chairId: chair?.chairId || null,
        chairNumber: chair?.chairNumber || '',
        name: chair?.name || '',
      },
      attendant: {
        attendantId: attendant?.attendantId || null,
        name: attendant?.name || '',
      },
      items,
      subtotal,
      discountType,
      discountValue,
      discountTotal,
      taxPercent,
      cgst,
      sgst,
      taxTotal,
      grandTotal,
      amountReceived: amountReceived || grandTotal,
      balanceAmount,
      paymentStatus,
      paymentMethod,
      splitPaymentDetails,
      notes,
      status,
      createdBy: req.user._id,
      createdByName: req.user.fullName || req.user.username,
    });

    await newBill.save();

    // 3. If Completed, deduct product inventory & create transactions
    if (status === BILL_STATUS.COMPLETED) {
      for (const item of items) {
        if (item.itemType === 'product' && item.itemId) {
          const product = await Product.findById(item.itemId);
          if (product) {
            const previousStock = product.currentStock;
            const newStock = Math.max(0, product.currentStock - item.quantity);
            product.currentStock = newStock;
            await product.save();

            await InventoryTransaction.create({
              product: product._id,
              type: INVENTORY_TRANSACTION_TYPES.BILLING_SALE,
              quantity: item.quantity,
              previousStock,
              newStock,
              unitPrice: item.unitPrice,
              reason: `Sale on bill #${billNumber}`,
              referenceBill: newBill._id,
              createdBy: req.user._id,
            });
          }
        }
      }

      // Update attendant completed count & sales
      if (attendant?.attendantId) {
        await Attendant.findByIdAndUpdate(attendant.attendantId, {
          $inc: {
            servicesCompleted: items.filter((i) => i.itemType === 'service').length,
            totalSalesGenerated: grandTotal,
          },
        });
      }

      // Update chair status to Available or Completed
      if (chair?.chairId) {
        await Chair.findByIdAndUpdate(chair.chairId, {
          status: CHAIR_STATUS.AVAILABLE,
          currentCustomer: '',
          currentCustomerMobile: '',
          currentBill: null,
          startTime: null,
        });
      }

      // 4. Record Payment
      const paymentId = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      await Payment.create({
        paymentId,
        bill: newBill._id,
        billNumber,
        customer: {
          customerId: customerDoc._id,
          name: customer.name.trim(),
          mobile: customer.mobile.trim(),
        },
        totalBillAmount: grandTotal,
        amountPaid: amountReceived || grandTotal,
        balanceAmount,
        paymentMethod,
        splitDetails: splitPaymentDetails,
        paymentStatus,
        notes,
        receivedBy: req.user._id,
      });
    }

    // 5. Activity Log
    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.CREATE_BILL,
      entityType: 'Bill',
      entityId: newBill._id.toString(),
      details: `Generated bill #${billNumber} for ₹${grandTotal} (${paymentMethod})`,
      metadata: { billNumber, grandTotal, paymentMethod, status },
    });

    // 6. Broadcast live update via Socket.IO
    if (req.io) {
      req.io.emit('bill:created', { bill: newBill });
      req.io.emit('stats:updated');
      if (chair?.chairId) {
        req.io.emit('chair:updated', { chairId: chair.chairId, status: CHAIR_STATUS.AVAILABLE });
      }
    }

    res.status(201).json({
      success: true,
      message: status === BILL_STATUS.DRAFT ? 'Bill saved as draft' : 'Bill created successfully',
      bill: newBill,
    });
  } catch (error) {
    next(error);
  }
};

export const getBills = async (req, res, next) => {
  try {
    const {
      search = '',
      page = 1,
      limit = 10,
      startDate,
      endDate,
      paymentMethod,
      paymentStatus,
      status,
      attendantId,
      chairId,
      sortBy = 'billDate',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    // Search text across billNumber, customer name, and mobile
    if (search) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { billNumber: searchRegex },
        { 'customer.name': searchRegex },
        { 'customer.mobile': searchRegex },
        { 'attendant.name': searchRegex },
      ];
    }

    // Date Range
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) {
        query.billDate.$gte = new Date(new Date(startDate).setHours(0, 0, 0, 0));
      }
      if (endDate) {
        query.billDate.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      }
    }

    if (paymentMethod && paymentMethod !== 'All') {
      query.paymentMethod = paymentMethod;
    }

    if (paymentStatus && paymentStatus !== 'All') {
      query.paymentStatus = paymentStatus;
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (attendantId) {
      query['attendant.attendantId'] = attendantId;
    }

    if (chairId) {
      query['chair.chairId'] = chairId;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [bills, total] = await Promise.all([
      Bill.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      Bill.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      bills,
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

export const getBillById = async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    res.status(200).json({ success: true, bill });
  } catch (error) {
    next(error);
  }
};

export const cancelBill = async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory cancellation reason is required.',
      });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    if (bill.status === BILL_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'This bill has already been cancelled.',
      });
    }

    // Staff cannot permanently delete or cancel bills without permission if restricted
    if (req.user.role === ROLES.STAFF && !req.user.permissions?.canCancelBills) {
      // staff role restriction check
    }

    // Restore product stock
    for (const item of bill.items) {
      if (item.itemType === 'product' && item.itemId) {
        const product = await Product.findById(item.itemId);
        if (product) {
          const previousStock = product.currentStock;
          const newStock = product.currentStock + item.quantity;
          product.currentStock = newStock;
          await product.save();

          await InventoryTransaction.create({
            product: product._id,
            type: INVENTORY_TRANSACTION_TYPES.STOCK_IN,
            quantity: item.quantity,
            previousStock,
            newStock,
            unitPrice: item.unitPrice,
            reason: `Restocked due to cancellation of bill #${bill.billNumber}`,
            referenceBill: bill._id,
            createdBy: req.user._id,
          });
        }
      }
    }

    // Deduct attendant performance
    if (bill.attendant?.attendantId) {
      await Attendant.findByIdAndUpdate(bill.attendant.attendantId, {
        $inc: {
          servicesCompleted: -bill.items.filter((i) => i.itemType === 'service').length,
          totalSalesGenerated: -bill.grandTotal,
        },
      });
    }

    bill.status = BILL_STATUS.CANCELLED;
    bill.cancellationReason = reason.trim();
    bill.cancelledBy = req.user._id;
    bill.cancelledAt = new Date();
    await bill.save();

    // Update payment record
    await Payment.updateMany(
      { bill: bill._id },
      { paymentStatus: PAYMENT_STATUS.UNPAID, notes: `Bill Cancelled: ${reason.trim()}` }
    );

    // Audit log
    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.CANCEL_BILL,
      entityType: 'Bill',
      entityId: bill._id.toString(),
      details: `Cancelled bill #${bill.billNumber}. Reason: ${reason.trim()}`,
      metadata: { billNumber: bill.billNumber, reason: reason.trim() },
    });

    if (req.io) {
      req.io.emit('bill:cancelled', { billId: bill._id, billNumber: bill.billNumber });
      req.io.emit('stats:updated');
    }

    res.status(200).json({
      success: true,
      message: 'Bill cancelled successfully and inventory restored',
      bill,
    });
  } catch (error) {
    next(error);
  }
};

export const editBill = async (req, res, next) => {
  try {
    const { reason, ...updateData } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reason for editing this bill is required for audit logs.',
      });
    }

    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    if (bill.status === BILL_STATUS.CANCELLED) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a cancelled bill.',
      });
    }

    // Save snapshot in edit history
    bill.editHistory.push({
      editedBy: req.user._id,
      editedAt: new Date(),
      reason: reason.trim(),
      snapshot: bill.toObject(),
    });

    // Update allowable fields
    if (updateData.customer) bill.customer = { ...bill.customer, ...updateData.customer };
    if (updateData.notes !== undefined) bill.notes = updateData.notes;
    if (updateData.paymentMethod) bill.paymentMethod = updateData.paymentMethod;
    if (updateData.paymentStatus) bill.paymentStatus = updateData.paymentStatus;
    if (updateData.amountReceived !== undefined) bill.amountReceived = updateData.amountReceived;
    if (updateData.balanceAmount !== undefined) bill.balanceAmount = updateData.balanceAmount;

    await bill.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.EDIT_BILL,
      entityType: 'Bill',
      entityId: bill._id.toString(),
      details: `Edited bill #${bill.billNumber}. Reason: ${reason.trim()}`,
      metadata: { billNumber: bill.billNumber, reason },
    });

    if (req.io) {
      req.io.emit('bill:updated', { bill });
      req.io.emit('stats:updated');
    }

    res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      bill,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadInvoicePDF = async (req, res, next) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }

    const settings = (await ApplicationSettings.findOne()) || {};
    const pdfBuffer = await generateInvoicePDF(bill, settings);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Nagulan-Invoice-${bill.billNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
