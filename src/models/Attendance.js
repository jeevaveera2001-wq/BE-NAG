import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    attendant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendant',
      required: true,
    },
    date: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
    checkInTime: {
      type: Date,
    },
    checkOutTime: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Half-day', 'Leave'],
      default: 'Present',
    },
    notes: {
      type: String,
      default: '',
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ attendant: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
