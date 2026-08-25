import mongoose from 'mongoose';
import { BILL_STATUS, PAYMENT_METHODS, PAYMENT_STATUS } from '../config/constants.js';

const billItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ['service', 'product'],
    required: true,
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    default: 'General',
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  taxPercent: {
    type: Number,
    default: 18,
    min: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
});

const billSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    billDate: {
      type: Date,
      default: Date.now,
    },
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
      },
      name: {
        type: String,
        required: [true, 'Customer name is required'],
      },
      mobile: {
        type: String,
        required: [true, 'Customer mobile is required'],
      },
      email: {
        type: String,
        default: '',
      },
    },
    chair: {
      chairId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chair',
      },
      chairNumber: String,
      name: String,
    },
    attendant: {
      attendantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendant',
      },
      name: String,
    },
    items: [billItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxPercent: {
      type: Number,
      default: 18,
    },
    cgst: {
      type: Number,
      default: 0,
    },
    sgst: {
      type: Number,
      default: 0,
    },
    taxTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    amountReceived: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PAID,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      default: PAYMENT_METHODS.CASH,
    },
    splitPaymentDetails: {
      cash: { type: Number, default: 0 },
      upi: { type: Number, default: 0 },
      debitCard: { type: Number, default: 0 },
      creditCard: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(BILL_STATUS),
      default: BILL_STATUS.COMPLETED,
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: {
      type: Date,
    },
    editHistory: [
      {
        editedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        editedAt: {
          type: Date,
          default: Date.now,
        },
        reason: String,
        snapshot: mongoose.Schema.Types.Mixed,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Indexes for fast search and reporting
billSchema.index({ billDate: -1 });
billSchema.index({ 'customer.mobile': 1 });
billSchema.index({ 'customer.name': 1 });
billSchema.index({ status: 1 });
billSchema.index({ paymentStatus: 1 });

const Bill = mongoose.model('Bill', billSchema);
export default Bill;
