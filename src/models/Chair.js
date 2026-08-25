import mongoose from 'mongoose';
import { CHAIR_STATUS } from '../config/constants.js';

const chairSchema = new mongoose.Schema(
  {
    chairNumber: {
      type: String,
      required: [true, 'Chair number or identifier is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Chair name is required'],
      trim: true,
    },
    floor: {
      type: String,
      default: 'Main Floor',
      trim: true,
    },
    section: {
      type: String,
      default: 'General Styling',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(CHAIR_STATUS),
      default: CHAIR_STATUS.AVAILABLE,
    },
    assignedAttendant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendant',
    },
    currentCustomer: {
      type: String,
      default: '',
    },
    currentCustomerMobile: {
      type: String,
      default: '',
    },
    currentBill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
    },
    startTime: {
      type: Date,
    },
    notes: {
      type: String,
      default: '',
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

const Chair = mongoose.model('Chair', chairSchema);
export default Chair;
