import mongoose from 'mongoose';

const attendantSchema = new mongoose.Schema(
  {
    attendantId: {
      type: String,
      required: [true, 'Attendant ID is required'],
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    specialization: {
      type: [String],
      default: ['Hair Styling'],
    },
    assignedChair: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chair',
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    shiftTiming: {
      type: String,
      default: '9:00 AM - 6:00 PM',
    },
    commissionPercentage: {
      type: Number,
      default: 10, // 10%
      min: 0,
      max: 100,
    },
    baseSalary: {
      type: Number,
      default: 0, // Monthly base salary in ₹
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    servicesCompleted: {
      type: Number,
      default: 0,
    },
    totalSalesGenerated: {
      type: Number,
      default: 0,
    },
    avatar: {
      type: String,
      default: '',
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

const Attendant = mongoose.model('Attendant', attendantSchema);
export default Attendant;
