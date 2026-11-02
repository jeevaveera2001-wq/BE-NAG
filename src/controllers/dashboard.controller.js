import Bill from '../models/Bill.js';
import Customer from '../models/Customer.js';
import Attendant from '../models/Attendant.js';
import Chair from '../models/Chair.js';
import Service from '../models/Service.js';
import Product from '../models/Product.js';
import ActivityLog from '../models/ActivityLog.js';
import { BILL_STATUS, CHAIR_STATUS } from '../config/constants.js';

export const getDashboardMetrics = async (req, res, next) => {
  try {
    const now = new Date();

    // Time boundaries
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek.getTime() - 1);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
    const endOfLastMonth = new Date(startOfMonth.getTime() - 1);

    // Queries for completed bills
    const baseFilter = { status: BILL_STATUS.COMPLETED };

    const [
      todayBills,
      weekBills,
      monthBills,
      allCompletedBills,
      pendingBillsCount,
      totalCustomers,
      totalAttendants,
      activeChairsCount,
      totalChairsCount,
      recentBills,
      recentActivities,
      topAttendants,
      allServices,
      allProducts,
    ] = await Promise.all([
      // Today bills
      Bill.find({ ...baseFilter, billDate: { $gte: startOfToday, $lte: endOfToday } }),
      // Week bills
      Bill.find({ ...baseFilter, billDate: { $gte: startOfWeek } }),
      // Month bills
      Bill.find({ ...baseFilter, billDate: { $gte: startOfMonth } }),
      // All completed bills for breakdowns
      Bill.find(baseFilter),
      // Pending / Unpaid bills
      Bill.countDocuments({ paymentStatus: 'Unpaid', status: { $ne: BILL_STATUS.CANCELLED } }),
      // Total customers
      Customer.countDocuments({ isDeleted: false }),
      // Total attendants
      Attendant.countDocuments({ isDeleted: false, status: 'active' }),
      // Active / Occupied Chairs
      Chair.countDocuments({ isDeleted: false, status: CHAIR_STATUS.OCCUPIED }),
      // Total Chairs
      Chair.countDocuments({ isDeleted: false }),
      // Recent 8 bills
      Bill.find().sort({ billDate: -1 }).limit(8),
      // Recent 8 activities
      ActivityLog.find().sort({ createdAt: -1 }).limit(8),
      // Top 5 attendants
      Attendant.find({ isDeleted: false }).sort({ totalSalesGenerated: -1 }).limit(5),
      // Top services
      Service.find({ isDeleted: false }).limit(20),
      // Top products
      Product.find({ isDeleted: false }).sort({ currentStock: 1 }).limit(20),
    ]);

    // Calculate revenue totals
    const todaySales = todayBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const weekSales = weekBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const monthSales = monthBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);

    // Calculate historical comparison periods for actual trend percentages
    const yesterdayBills = allCompletedBills.filter(
      (b) => new Date(b.billDate) >= startOfYesterday && new Date(b.billDate) <= endOfYesterday
    );
    const yesterdaySales = yesterdayBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);

    const lastWeekBills = allCompletedBills.filter(
      (b) => new Date(b.billDate) >= startOfLastWeek && new Date(b.billDate) <= endOfLastWeek
    );
    const lastWeekSales = lastWeekBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);

    const lastMonthBills = allCompletedBills.filter(
      (b) => new Date(b.billDate) >= startOfLastMonth && new Date(b.billDate) <= endOfLastMonth
    );
    const lastMonthSales = lastMonthBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);

    // Actual trend calculator
    const calcTrend = (current, previous, label) => {
      if (previous > 0) {
        const diff = ((current - previous) / previous) * 100;
        return {
          percentage: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
          isPositive: diff >= 0,
          label,
        };
      }
      if (current > 0) {
        return {
          percentage: '+100%',
          isPositive: true,
          label,
        };
      }
      return {
        percentage: '0.0%',
        isPositive: true,
        label,
      };
    };

    // Payment method breakdown for this month
    const paymentBreakdown = {
      Cash: 0,
      UPI: 0,
      'Debit card': 0,
      'Credit card': 0,
      'Split payment': 0,
      Other: 0,
    };

    monthBills.forEach((b) => {
      if (b.paymentMethod && paymentBreakdown[b.paymentMethod] !== undefined) {
        paymentBreakdown[b.paymentMethod] += b.grandTotal;
      } else {
        paymentBreakdown.Other += b.grandTotal;
      }
    });

    // Daily Sales Chart data (last 7 days)
    const dailySalesChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const dayBills = allCompletedBills.filter(
        (b) => new Date(b.billDate) >= dayStart && new Date(b.billDate) <= dayEnd
      );

      const dayTotal = dayBills.reduce((acc, curr) => acc + (curr.grandTotal || 0), 0);
      const dayCount = dayBills.length;

      dailySalesChart.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: dayTotal,
        bills: dayCount,
      });
    }

    // Service popularity counter
    const serviceMap = {};
    const productMap = {};

    allCompletedBills.forEach((b) => {
      b.items.forEach((item) => {
        if (item.itemType === 'service') {
          serviceMap[item.name] = (serviceMap[item.name] || 0) + item.quantity;
        } else if (item.itemType === 'product') {
          productMap[item.name] = (productMap[item.name] || 0) + item.quantity;
        }
      });
    });

    const popularServices = Object.keys(serviceMap)
      .map((name) => ({ name, count: serviceMap[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const bestSellingProducts = Object.keys(productMap)
      .map((name) => ({ name, count: productMap[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // Low stock warnings
    const lowStockProducts = allProducts.filter((p) => p.currentStock <= p.minStockWarning);

    res.status(200).json({
      success: true,
      data: {
        summary: {
          todayBills: todayBills.length,
          todaySales,
          todayTrend: calcTrend(todaySales, yesterdaySales, 'vs yesterday'),
          weekBills: weekBills.length,
          weekSales,
          weekTrend: calcTrend(weekSales, lastWeekSales, 'vs last week'),
          monthBills: monthBills.length,
          monthSales,
          monthTrend: calcTrend(monthSales, lastMonthSales, 'vs last month'),
          cashPayments: paymentBreakdown.Cash,
          upiPayments: paymentBreakdown.UPI,
          cardPayments: paymentBreakdown['Debit card'] + paymentBreakdown['Credit card'],
          pendingPayments: pendingBillsCount,
          totalCustomers,
          totalAttendants,
          activeChairs: activeChairsCount,
          totalChairs: totalChairsCount,
        },
        paymentBreakdown: Object.keys(paymentBreakdown).map((method) => ({
          method,
          amount: paymentBreakdown[method],
        })),
        dailySalesChart,
        popularServices,
        bestSellingProducts,
        lowStockProducts,
        topAttendants,
        recentBills,
        recentActivities,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPresentDayMetrics = async (req, res, next) => {
  try {
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);

    const baseFilter = { status: BILL_STATUS.COMPLETED };

    const [todayBills, yesterdayBills] = await Promise.all([
      Bill.find({ ...baseFilter, billDate: { $gte: startOfToday, $lte: endOfToday } }).sort({ billDate: -1 }),
      Bill.find({ ...baseFilter, billDate: { $gte: startOfYesterday, $lte: endOfYesterday } }).sort({ billDate: -1 }),
    ]);

    // Totals for today
    const todayTotal = todayBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const todayBillsCount = todayBills.length;

    // Payment breakdown for Today
    let todayCash = 0;
    let todayUPI = 0;
    let todayCard = 0;
    let todaySplit = 0;
    let todayOther = 0;

    todayBills.forEach((b) => {
      const amt = b.grandTotal || 0;
      if (b.paymentMethod === 'Cash') todayCash += amt;
      else if (b.paymentMethod === 'UPI') todayUPI += amt;
      else if (b.paymentMethod === 'Debit card' || b.paymentMethod === 'Credit card') todayCard += amt;
      else if (b.paymentMethod === 'Split payment') {
        todaySplit += amt;
        if (b.splitPaymentDetails) {
          todayCash += (b.splitPaymentDetails.cash || 0);
          todayUPI += (b.splitPaymentDetails.upi || 0);
          todayCard += ((b.splitPaymentDetails.debitCard || 0) + (b.splitPaymentDetails.creditCard || 0));
        }
      } else {
        todayOther += amt;
      }
    });

    // Totals for Yesterday
    const yesterdayTotal = yesterdayBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const yesterdayBillsCount = yesterdayBills.length;

    let yesterdayCash = 0;
    let yesterdayUPI = 0;
    let yesterdayCard = 0;
    let yesterdaySplit = 0;
    let yesterdayOther = 0;

    yesterdayBills.forEach((b) => {
      const amt = b.grandTotal || 0;
      if (b.paymentMethod === 'Cash') yesterdayCash += amt;
      else if (b.paymentMethod === 'UPI') yesterdayUPI += amt;
      else if (b.paymentMethod === 'Debit card' || b.paymentMethod === 'Credit card') yesterdayCard += amt;
      else if (b.paymentMethod === 'Split payment') {
        yesterdaySplit += amt;
        if (b.splitPaymentDetails) {
          yesterdayCash += (b.splitPaymentDetails.cash || 0);
          yesterdayUPI += (b.splitPaymentDetails.upi || 0);
          yesterdayCard += ((b.splitPaymentDetails.debitCard || 0) + (b.splitPaymentDetails.creditCard || 0));
        }
      } else {
        yesterdayOther += amt;
      }
    });

    // Helper for diff & high/low calculation
    const calcTrend = (curr, prev) => {
      if (prev > 0) {
        const diff = ((curr - prev) / prev) * 100;
        return {
          percentage: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`,
          isPositive: diff >= 0,
          diffAmount: curr - prev,
          previous: prev,
        };
      }
      if (curr > 0) {
        return { percentage: '+100%', isPositive: true, diffAmount: curr, previous: 0 };
      }
      return { percentage: '0.0%', isPositive: true, diffAmount: 0, previous: 0 };
    };

    // Hourly comparison data (from 8 AM to 10 PM)
    const hourlyComparison = [];
    for (let hour = 8; hour <= 22; hour++) {
      const hourLabel = hour <= 12 ? `${hour} ${hour === 12 ? 'PM' : 'AM'}` : `${hour - 12} PM`;

      const todayHourSales = todayBills
        .filter((b) => new Date(b.billDate).getHours() === hour)
        .reduce((sum, b) => sum + (b.grandTotal || 0), 0);

      const yesterdayHourSales = yesterdayBills
        .filter((b) => new Date(b.billDate).getHours() === hour)
        .reduce((sum, b) => sum + (b.grandTotal || 0), 0);

      const todayHourBills = todayBills.filter((b) => new Date(b.billDate).getHours() === hour).length;
      const yesterdayHourBills = yesterdayBills.filter((b) => new Date(b.billDate).getHours() === hour).length;

      hourlyComparison.push({
        hour: hourLabel,
        todaySales: todayHourSales,
        yesterdaySales: yesterdayHourSales,
        todayBills: todayHourBills,
        yesterdayBills: yesterdayHourBills,
      });
    }

    // Payment method comparison array
    const paymentComparison = [
      { method: 'Cash', today: todayCash, yesterday: yesterdayCash },
      { method: 'UPI / QR', today: todayUPI, yesterday: yesterdayUPI },
      { method: 'Card (Debit/Credit)', today: todayCard, yesterday: yesterdayCard },
      { method: 'Other / Split', today: todaySplit + todayOther, yesterday: yesterdaySplit + yesterdayOther },
    ];

    res.status(200).json({
      success: true,
      data: {
        today: {
          total: todayTotal,
          bills: todayBillsCount,
          cash: todayCash,
          upi: todayUPI,
          card: todayCard,
          split: todaySplit,
          other: todayOther,
          avgBill: todayBillsCount > 0 ? Math.round(todayTotal / todayBillsCount) : 0,
        },
        yesterday: {
          total: yesterdayTotal,
          bills: yesterdayBillsCount,
          cash: yesterdayCash,
          upi: yesterdayUPI,
          card: yesterdayCard,
          split: yesterdaySplit,
          other: yesterdayOther,
          avgBill: yesterdayBillsCount > 0 ? Math.round(yesterdayTotal / yesterdayBillsCount) : 0,
        },
        trends: {
          total: calcTrend(todayTotal, yesterdayTotal),
          bills: calcTrend(todayBillsCount, yesterdayBillsCount),
          cash: calcTrend(todayCash, yesterdayCash),
          upi: calcTrend(todayUPI, yesterdayUPI),
          card: calcTrend(todayCard, yesterdayCard),
        },
        hourlyComparison,
        paymentComparison,
        hourlyData: hourlyComparison,
        paymentData: paymentComparison,
        todayBills,
      },
    });
  } catch (error) {
    next(error);
  }
};
