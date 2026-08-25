import Bill from '../models/Bill.js';
import Service from '../models/Service.js';
import Product from '../models/Product.js';
import Attendant from '../models/Attendant.js';
import Chair from '../models/Chair.js';
import ExcelJS from 'exceljs';
import { BILL_STATUS, PAYMENT_STATUS } from '../config/constants.js';

// Helper to get date filters
const parseDateRange = (startDate, endDate, period) => {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (period === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (period === 'this_week') {
    start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
  } else if (period === 'this_month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  } else if (period === 'last_month') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (startDate || endDate) {
    if (startDate) start = new Date(new Date(startDate).setHours(0, 0, 0, 0));
    if (endDate) end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
  }

  return { $gte: start, $lte: end };
};

export const getSalesReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;
    const dateFilter = parseDateRange(startDate, endDate, period);

    const bills = await Bill.find({
      billDate: dateFilter,
      status: BILL_STATUS.COMPLETED,
    }).sort({ billDate: 1 });

    const totalSales = bills.reduce((acc, b) => acc + (b.grandTotal || 0), 0);
    const totalTax = bills.reduce((acc, b) => acc + (b.taxTotal || 0), 0);
    const totalDiscount = bills.reduce((acc, b) => acc + (b.discountTotal || 0), 0);
    const totalBills = bills.length;

    // Daily breakdown for chart
    const dailyMap = {};
    bills.forEach((b) => {
      const dayKey = new Date(b.billDate).toISOString().slice(0, 10);
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, sales: 0, bills: 0, tax: 0, discount: 0 };
      }
      dailyMap[dayKey].sales += b.grandTotal;
      dailyMap[dayKey].bills += 1;
      dailyMap[dayKey].tax += b.taxTotal;
      dailyMap[dayKey].discount += b.discountTotal;
    });

    res.status(200).json({
      success: true,
      data: {
        totalSales,
        totalTax,
        totalDiscount,
        totalBills,
        breakdown: Object.values(dailyMap),
        bills,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getServiceReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;
    const dateFilter = parseDateRange(startDate, endDate, period);

    const bills = await Bill.find({
      billDate: dateFilter,
      status: BILL_STATUS.COMPLETED,
    });

    const serviceStats = {};

    bills.forEach((b) => {
      b.items.forEach((item) => {
        if (item.itemType === 'service') {
          if (!serviceStats[item.name]) {
            serviceStats[item.name] = {
              name: item.name,
              category: item.category,
              quantity: 0,
              revenue: 0,
            };
          }
          serviceStats[item.name].quantity += item.quantity;
          serviceStats[item.name].revenue += item.totalAmount;
        }
      });
    });

    const results = Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue);

    res.status(200).json({ success: true, services: results });
  } catch (error) {
    next(error);
  }
};

export const getProductReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;
    const dateFilter = parseDateRange(startDate, endDate, period);

    const bills = await Bill.find({
      billDate: dateFilter,
      status: BILL_STATUS.COMPLETED,
    });

    const productStats = {};

    bills.forEach((b) => {
      b.items.forEach((item) => {
        if (item.itemType === 'product') {
          if (!productStats[item.name]) {
            productStats[item.name] = {
              name: item.name,
              category: item.category,
              quantity: 0,
              revenue: 0,
            };
          }
          productStats[item.name].quantity += item.quantity;
          productStats[item.name].revenue += item.totalAmount;
        }
      });
    });

    const results = Object.values(productStats).sort((a, b) => b.revenue - a.revenue);

    res.status(200).json({ success: true, products: results });
  } catch (error) {
    next(error);
  }
};

export const getAttendantReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;
    const dateFilter = parseDateRange(startDate, endDate, period);

    const attendants = await Attendant.find({ isDeleted: false });

    const results = await Promise.all(
      attendants.map(async (att) => {
        const bills = await Bill.find({
          'attendant.attendantId': att._id,
          billDate: dateFilter,
          status: BILL_STATUS.COMPLETED,
        });

        const totalSales = bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
        let servicesCount = 0;
        bills.forEach((b) => {
          servicesCount += b.items.filter((i) => i.itemType === 'service').length;
        });

        const commission = (totalSales * (att.commissionPercentage || 10)) / 100;

        return {
          attendantId: att.attendantId,
          name: att.fullName,
          specialization: att.specialization.join(', '),
          commissionPercentage: att.commissionPercentage,
          totalBills: bills.length,
          servicesCompleted: servicesCount,
          totalSales,
          commissionEarned: commission,
        };
      })
    );

    res.status(200).json({ success: true, attendants: results });
  } catch (error) {
    next(error);
  }
};

export const getTaxGstReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;
    const dateFilter = parseDateRange(startDate, endDate, period);

    const bills = await Bill.find({
      billDate: dateFilter,
      status: BILL_STATUS.COMPLETED,
    }).sort({ billDate: -1 });

    const totalTaxable = bills.reduce((sum, b) => sum + (b.subtotal - (b.discountTotal || 0)), 0);
    const totalCGST = bills.reduce((sum, b) => sum + (b.cgst || 0), 0);
    const totalSGST = bills.reduce((sum, b) => sum + (b.sgst || 0), 0);
    const totalTax = totalCGST + totalSGST;
    const grandTotal = bills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalTaxable,
        totalCGST,
        totalSGST,
        totalTax,
        grandTotal,
        billCount: bills.length,
      },
      bills,
    });
  } catch (error) {
    next(error);
  }
};

export const getCancelledBillsReport = async (req, res, next) => {
  try {
    const { startDate, endDate, period } = req.query;
    const dateFilter = parseDateRange(startDate, endDate, period);

    const bills = await Bill.find({
      status: BILL_STATUS.CANCELLED,
      billDate: dateFilter,
    })
      .populate('cancelledBy', 'fullName username role')
      .sort({ cancelledAt: -1 });

    res.status(200).json({ success: true, count: bills.length, bills });
  } catch (error) {
    next(error);
  }
};

export const getInventoryReport = async (req, res, next) => {
  try {
    const products = await Product.find({ isDeleted: false }).sort({ currentStock: 1 });

    let totalValuation = 0;
    let totalStockUnits = 0;
    let lowStockCount = 0;

    products.forEach((p) => {
      totalValuation += p.currentStock * p.purchasePrice;
      totalStockUnits += p.currentStock;
      if (p.currentStock <= p.minStockWarning) {
        lowStockCount += 1;
      }
    });

    res.status(200).json({
      success: true,
      summary: {
        totalProducts: products.length,
        totalStockUnits,
        totalValuation,
        lowStockCount,
      },
      products,
    });
  } catch (error) {
    next(error);
  }
};

export const exportReportExcel = async (req, res, next) => {
  try {
    const { type = 'sales', startDate, endDate, period } = req.query;
    const dateFilter = parseDateRange(startDate, endDate, period);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NAGULAN Unisex Salon';
    const worksheet = workbook.addWorksheet('Report');

    if (type === 'sales') {
      const bills = await Bill.find({
        billDate: dateFilter,
        status: BILL_STATUS.COMPLETED,
      }).sort({ billDate: -1 });

      worksheet.columns = [
        { header: 'Bill Number', key: 'billNumber', width: 20 },
        { header: 'Date', key: 'date', width: 22 },
        { header: 'Customer', key: 'customer', width: 20 },
        { header: 'Mobile', key: 'mobile', width: 15 },
        { header: 'Attendant', key: 'attendant', width: 18 },
        { header: 'Subtotal (₹)', key: 'subtotal', width: 15 },
        { header: 'Discount (₹)', key: 'discount', width: 15 },
        { header: 'Tax (₹)', key: 'tax', width: 15 },
        { header: 'Grand Total (₹)', key: 'grandTotal', width: 18 },
        { header: 'Payment Method', key: 'paymentMethod', width: 18 },
        { header: 'Status', key: 'paymentStatus', width: 12 },
      ];

      bills.forEach((b) => {
        worksheet.addRow({
          billNumber: b.billNumber,
          date: new Date(b.billDate).toLocaleString('en-IN'),
          customer: b.customer?.name || '',
          mobile: b.customer?.mobile || '',
          attendant: b.attendant?.name || '',
          subtotal: b.subtotal,
          discount: b.discountTotal,
          tax: b.taxTotal,
          grandTotal: b.grandTotal,
          paymentMethod: b.paymentMethod,
          paymentStatus: b.paymentStatus,
        });
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Nagulan_${type}_report.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};
