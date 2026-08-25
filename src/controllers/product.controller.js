import Product from '../models/Product.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import { logActivity } from '../middleware/auditLogger.js';
import { ACTIVITY_ACTIONS, INVENTORY_TRANSACTION_TYPES } from '../config/constants.js';

export const getProducts = async (req, res, next) => {
  try {
    const {
      search = '',
      category,
      brand,
      lowStockOnly,
      isActive,
      page = 1,
      limit = 50,
      sortBy = 'name',
      sortOrder = 'asc',
    } = req.query;

    const query = { isDeleted: false };

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { sku: regex }, { brand: regex }, { category: regex }];
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (brand && brand !== 'All') {
      query.brand = brand;
    }

    if (isActive !== undefined && isActive !== 'All') {
      query.isActive = isActive === 'true';
    }

    if (lowStockOnly === 'true') {
      query.$expr = { $lte: ['$currentStock', '$minStockWarning'] };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [products, total] = await Promise.all([
      Product.find(query).sort(sortOptions).skip(skip).limit(limitNum),
      Product.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      products,
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

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json({ success: true, product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const { name, sku, brand, category, purchasePrice, sellingPrice, currentStock, minStockWarning, taxPercentage } =
      req.body;

    const existingSku = await Product.findOne({ sku: sku.trim().toUpperCase(), isDeleted: false });
    if (existingSku) {
      return res.status(400).json({ success: false, message: `Product with SKU "${sku}" already exists.` });
    }

    const product = await Product.create({
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      brand: brand?.trim() || 'General',
      category: category.trim(),
      purchasePrice,
      sellingPrice,
      currentStock: currentStock || 0,
      minStockWarning: minStockWarning || 5,
      taxPercentage: taxPercentage !== undefined ? taxPercentage : 18,
      createdBy: req.user._id,
    });

    if (currentStock > 0) {
      await InventoryTransaction.create({
        product: product._id,
        type: INVENTORY_TRANSACTION_TYPES.STOCK_IN,
        quantity: currentStock,
        previousStock: 0,
        newStock: currentStock,
        unitPrice: purchasePrice,
        reason: 'Initial stock intake',
        createdBy: req.user._id,
      });
    }

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.CREATE_PRODUCT,
      entityType: 'Product',
      entityId: product._id.toString(),
      details: `Created product "${product.name}" (${product.sku}) with ${product.currentStock} units`,
    });

    if (req.io) {
      req.io.emit('product:created', { product });
    }

    res.status(201).json({ success: true, message: 'Product created successfully', product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const updates = req.body;
    if (updates.sku) updates.sku = updates.sku.trim().toUpperCase();

    // Prevent direct currentStock mutation without inventory transaction log
    delete updates.currentStock;

    Object.assign(product, updates);
    await product.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.UPDATE_PRODUCT,
      entityType: 'Product',
      entityId: product._id.toString(),
      details: `Updated product "${product.name}"`,
    });

    if (req.io) {
      req.io.emit('product:updated', { product });
    }

    res.status(200).json({ success: true, message: 'Product updated successfully', product });
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req, res, next) => {
  try {
    const { type, quantity, reason, unitPrice } = req.body;
    const qty = parseInt(quantity, 10);

    if (!qty || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive quantity is required.' });
    }

    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const previousStock = product.currentStock;
    let newStock = previousStock;

    if (type === INVENTORY_TRANSACTION_TYPES.STOCK_IN) {
      newStock += qty;
    } else if (type === INVENTORY_TRANSACTION_TYPES.STOCK_OUT) {
      if (previousStock < qty) {
        return res.status(400).json({
          success: false,
          message: `Cannot remove ${qty} units. Current stock is only ${previousStock}.`,
        });
      }
      newStock -= qty;
    } else if (type === INVENTORY_TRANSACTION_TYPES.ADJUSTMENT) {
      newStock = qty;
    } else {
      return res.status(400).json({ success: false, message: 'Invalid stock adjustment type.' });
    }

    product.currentStock = newStock;
    await product.save();

    const transaction = await InventoryTransaction.create({
      product: product._id,
      type,
      quantity: qty,
      previousStock,
      newStock,
      unitPrice: unitPrice || product.purchasePrice,
      reason: reason || `Manual stock adjustment (${type})`,
      createdBy: req.user._id,
    });

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.STOCK_ADJUSTMENT,
      entityType: 'Product',
      entityId: product._id.toString(),
      details: `${type.toUpperCase()} for "${product.name}": ${previousStock} -> ${newStock} units. Reason: ${reason || 'N/A'}`,
    });

    if (req.io) {
      req.io.emit('product:stock-updated', { product, transaction });
    }

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      product,
      transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, isDeleted: false });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isDeleted = true;
    await product.save();

    await logActivity({
      req,
      user: req.user,
      action: ACTIVITY_ACTIONS.DELETE_PRODUCT,
      entityType: 'Product',
      entityId: product._id.toString(),
      details: `Deleted product "${product.name}"`,
    });

    if (req.io) {
      req.io.emit('product:deleted', { productId: product._id });
    }

    res.status(200).json({ success: true, message: 'Product removed successfully' });
  } catch (error) {
    next(error);
  }
};

export const getInventoryHistory = async (req, res, next) => {
  try {
    const { productId, page = 1, limit = 50 } = req.query;
    const query = {};

    if (productId) {
      query.product = productId;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [transactions, total] = await Promise.all([
      InventoryTransaction.find(query)
        .populate('product', 'name sku brand')
        .populate('createdBy', 'fullName username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      InventoryTransaction.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      transactions,
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
