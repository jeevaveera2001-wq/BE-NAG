import Customer from '../models/Customer.js';
import Bill from '../models/Bill.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS, BILL_STATUS } from '../config/constants.js';

export const getCustomers = async (req, res, next) => {
  try {
    const { search = '', page = 1, limit = 50, sortBy = 'lastVisit', sortOrder = 'desc' } = req.query;
    const query = { isDeleted: false };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { mobile: regex }, { email: regex }, { address: regex }];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [customers, total] = await Promise.all([
      Customer.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      Customer.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      customers,
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

export const searchCustomerByMobile = async (req, res, next) => {
  try {
    const { mobile } = req.params;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required' });
    }

    const customer = await Customer.findOne({
      mobile: new RegExp(`^${mobile.trim()}`),
      isDeleted: false,
    });

    res.status(200).json({ success: true, customer });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, isDeleted: false });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // Fetch customer bills history
    const bills = await Bill.find({
      $or: [{ 'customer.customerId': customer._id }, { 'customer.mobile': customer.mobile }],
    }).sort({ billDate: -1 });

    res.status(200).json({ success: true, customer, bills });
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req, res, next) => {
  try {
    const { name, mobile, email, gender, address, dateOfBirth, anniversary, notes } = req.body;

    const existing = await Customer.findOne({ mobile: mobile.trim(), isDeleted: false });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Customer with this mobile already exists.' });
    }

    const customer = await Customer.create({
      name: name.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim().toLowerCase() : '',
      gender: gender || 'Unspecified',
      address: address || '',
      dateOfBirth: dateOfBirth || null,
      anniversary: anniversary || null,
      notes: notes || '',
    });

    res.status(201).json({ success: true, message: 'Customer created successfully', customer });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, isDeleted: false });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const updates = req.body;
    if (updates.email) updates.email = updates.email.trim().toLowerCase();
    Object.assign(customer, updates);
    await customer.save();

    res.status(200).json({ success: true, message: 'Customer updated successfully', customer });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, isDeleted: false });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    customer.isDeleted = true;
    await customer.save();

    res.status(200).json({ success: true, message: 'Customer removed successfully' });
  } catch (error) {
    next(error);
  }
};
