import Service from '../models/Service.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS, SERVICE_CATEGORIES } from '../config/constants.js';

export const getServices = async (req, res, next) => {
  try {
    const {
      search = '',
      category,
      genderCategory,
      isActive,
      page = 1,
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    const query = { isDeleted: false };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { description: regex }, { category: regex }];
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (genderCategory && genderCategory !== 'All') {
      query.genderCategory = genderCategory;
    }

    if (isActive !== undefined && isActive !== 'All') {
      query.isActive = isActive === 'true';
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [services, total] = await Promise.all([
      Service.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      Service.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      services,
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

export const getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, isDeleted: false });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }
    res.status(200).json({ success: true, service });
  } catch (error) {
    next(error);
  }
};

export const createService = async (req, res, next) => {
  try {
    const { name, category, genderCategory, description, duration, price, discountPrice, taxPercentage, isActive } =
      req.body;

    const service = await Service.create({
      name: name.trim(),
      category: category.trim(),
      genderCategory: genderCategory || 'Unisex',
      description: description || '',
      duration: duration || 30,
      price,
      discountPrice: discountPrice || 0,
      taxPercentage: taxPercentage !== undefined ? taxPercentage : 18,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.CREATE_SERVICE,
      entityType: 'Service',
      entityId: service._id.toString(),
      details: `Created service "${service.name}" (₹${service.price})`,
    });

    if (req.io) {
      req.io.emit('service:created', { service });
    }

    res.status(201).json({ success: true, message: 'Service created successfully', service });
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, isDeleted: false });
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    const updates = req.body;
    Object.assign(service, updates);
    await service.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.UPDATE_SERVICE,
      entityType: 'Service',
      entityId: service._id.toString(),
      details: `Updated service "${service.name}"`,
    });

    if (req.io) {
      req.io.emit('service:updated', { service });
    }

    res.status(200).json({ success: true, message: 'Service updated successfully', service });
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await Service.findByIdAndDelete(req.params.id);

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.DELETE_SERVICE,
      entityType: 'Service',
      entityId: service._id.toString(),
      details: `Deleted service "${service.name}"`,
    });

    if (req.io) {
      req.io.emit('service:deleted', { serviceId: service._id });
    }

    res.status(200).json({ success: true, message: 'Service removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const bulkImportServices = async (req, res, next) => {
  try {
    const { services } = req.body;
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of services is required.' });
    }

    const docs = services.map((s) => ({
      name: s.name,
      category: s.category || 'Hair',
      genderCategory: s.genderCategory || 'Unisex',
      description: s.description || '',
      duration: s.duration || 30,
      price: s.price || 0,
      discountPrice: s.discountPrice || 0,
      taxPercentage: s.taxPercentage || 18,
      isActive: s.isActive !== undefined ? s.isActive : true,
      createdBy: req.user._id,
    }));

    const result = await Service.insertMany(docs);

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.CREATE_SERVICE,
      entityType: 'Service',
      details: `Bulk imported ${result.length} services`,
    });

    res.status(201).json({
      success: true,
      message: `Successfully imported ${result.length} services`,
      count: result.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategories = (req, res) => {
  res.status(200).json({
    success: true,
    categories: SERVICE_CATEGORIES,
  });
};
