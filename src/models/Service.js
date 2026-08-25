import mongoose from 'mongoose';
import { GENDER_CATEGORIES } from '../config/constants.js';

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    genderCategory: {
      type: String,
      enum: Object.values(GENDER_CATEGORIES),
      default: GENDER_CATEGORIES.UNISEX,
    },
    description: {
      type: String,
      default: '',
    },
    duration: {
      type: Number, // in minutes
      default: 30,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
    },
    discountPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxPercentage: {
      type: Number,
      default: 18, // GST %
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const Service = mongoose.model('Service', serviceSchema);
export default Service;
