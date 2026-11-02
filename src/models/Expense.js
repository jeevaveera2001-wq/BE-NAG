import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Expense description is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Debit card', 'Credit card', 'Bank Transfer', 'Other'],
      default: 'Cash',
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    recordedByName: {
      type: String,
      default: 'Staff',
    },
    receiptNumber: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying
expenseSchema.index({ date: -1, isDeleted: 1 });
expenseSchema.index({ category: 1, isDeleted: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
