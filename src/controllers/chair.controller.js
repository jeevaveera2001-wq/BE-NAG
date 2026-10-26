import Chair from '../models/Chair.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS, CHAIR_STATUS } from '../config/constants.js';

export const getChairs = async (req, res, next) => {
  try {
    const { search = '', status, floor, section } = req.query;
    const query = { isDeleted: false };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ chairNumber: regex }, { name: regex }, { currentCustomer: regex }, { notes: regex }];
    }

    if (status && status !== 'All') {
      query.status = status;
    }

    if (floor && floor !== 'All') {
      query.floor = floor;
    }

    if (section && section !== 'All') {
      query.section = section;
    }

    const chairs = await Chair.find(query)
      .populate('assignedAttendant', 'fullName mobile specialization')
      .sort({ chairNumber: 1 });

    res.status(200).json({ success: true, chairs });
  } catch (error) {
    next(error);
  }
};

export const getChairById = async (req, res, next) => {
  try {
    const chair = await Chair.findOne({ _id: req.params.id, isDeleted: false }).populate('assignedAttendant');
    if (!chair) {
      return res.status(404).json({ success: false, message: 'Chair not found' });
    }
    res.status(200).json({ success: true, chair });
  } catch (error) {
    next(error);
  }
};

export const createChair = async (req, res, next) => {
  try {
    const { chairNumber, name, floor, section, assignedAttendant, notes, status } = req.body;

    // Purge any old soft-deleted chair with same number if exists
    await Chair.deleteMany({ chairNumber: chairNumber.trim(), isDeleted: true });

    const existingChair = await Chair.findOne({ chairNumber: chairNumber.trim() });
    if (existingChair) {
      return res.status(400).json({ success: false, message: `Chair #${chairNumber} already exists.` });
    }

    const chair = await Chair.create({
      chairNumber: chairNumber.trim(),
      name: name.trim(),
      floor: floor?.trim() || 'Main Floor',
      section: section?.trim() || 'General Styling',
      assignedAttendant: assignedAttendant || null,
      notes: notes || '',
      status: status || CHAIR_STATUS.AVAILABLE,
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.UPDATE_SETTINGS,
      entityType: 'Chair',
      entityId: chair._id.toString(),
      details: `Added chair "${chair.name}" (${chair.chairNumber})`,
    });

    if (req.io) {
      req.io.emit('chair:created', { chair });
    }

    res.status(201).json({ success: true, message: 'Chair created successfully', chair });
  } catch (error) {
    next(error);
  }
};

export const updateChair = async (req, res, next) => {
  try {
    const chair = await Chair.findOne({ _id: req.params.id, isDeleted: false });
    if (!chair) {
      return res.status(404).json({ success: false, message: 'Chair not found' });
    }

    const updates = req.body;
    Object.assign(chair, updates);
    await chair.save();

    if (req.io) {
      req.io.emit('chair:updated', { chair });
    }

    res.status(200).json({ success: true, message: 'Chair updated successfully', chair });
  } catch (error) {
    next(error);
  }
};

export const updateChairStatus = async (req, res, next) => {
  try {
    const { status, currentCustomer, currentCustomerMobile, assignedAttendant, notes } = req.body;

    const chair = await Chair.findOne({ _id: req.params.id, isDeleted: false });
    if (!chair) {
      return res.status(404).json({ success: false, message: 'Chair not found' });
    }

    chair.status = status || chair.status;
    if (currentCustomer !== undefined) chair.currentCustomer = currentCustomer;
    if (currentCustomerMobile !== undefined) chair.currentCustomerMobile = currentCustomerMobile;
    if (assignedAttendant !== undefined) chair.assignedAttendant = assignedAttendant || null;
    if (notes !== undefined) chair.notes = notes;

    if (status === CHAIR_STATUS.OCCUPIED) {
      chair.startTime = new Date();
    } else if (status === CHAIR_STATUS.AVAILABLE) {
      chair.startTime = null;
      chair.currentCustomer = '';
      chair.currentCustomerMobile = '';
      chair.currentBill = null;
    }

    await chair.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.CHAIR_STATUS_CHANGE,
      entityType: 'Chair',
      entityId: chair._id.toString(),
      details: `Changed chair #${chair.chairNumber} status to "${chair.status}"`,
    });

    if (req.io) {
      req.io.emit('chair:status-changed', { chair });
      req.io.emit('stats:updated');
    }

    res.status(200).json({ success: true, message: 'Chair status updated', chair });
  } catch (error) {
    next(error);
  }
};

export const deleteChair = async (req, res, next) => {
  try {
    const chair = await Chair.findById(req.params.id);
    if (!chair) {
      return res.status(404).json({ success: false, message: 'Chair not found' });
    }

    await Chair.findByIdAndDelete(req.params.id);

    if (req.io) {
      req.io.emit('chair:deleted', { chairId: chair._id });
    }

    res.status(200).json({ success: true, message: 'Chair removed successfully' });
  } catch (error) {
    next(error);
  }
};
