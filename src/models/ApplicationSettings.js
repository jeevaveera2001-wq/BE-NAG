import mongoose from 'mongoose';

const applicationSettingsSchema = new mongoose.Schema(
  {
    salonName: {
      type: String,
      default: 'NAGULAN Unisex Salon',
      trim: true,
    },
    tagline: {
      type: String,
      default: 'Hair | Skin | Beauty | Makeup',
      trim: true,
    },
    franchiseEnquiry: {
      type: String,
      default: '97899 61617',
      trim: true,
    },
    phone: {
      type: String,
      default: '97899 61617',
      trim: true,
    },
    email: {
      type: String,
      default: 'nagulanunisexsalon@gmail.com',
      trim: true,
    },
    address: {
      type: String,
      default: 'Nagulan salon , Indur , Dharmapuri , PIN 636803',
      trim: true,
    },
    bannerUrl: {
      type: String,
      default: '',
    },
    logoUrl: {
      type: String,
      default: '',
    },
    gstNumber: {
      type: String,
      default: '',
      trim: true,
    },
    isGstEnabled: {
      type: Boolean,
      default: false,
    },
    defaultGstPercent: {
      type: Number,
      default: 18,
    },
    cgstPercent: {
      type: Number,
      default: 9,
    },
    sgstPercent: {
      type: Number,
      default: 9,
    },
    currencySymbol: {
      type: String,
      default: '₹',
    },
    receiptFooterMessage: {
      type: String,
      default: 'Thank you for visiting NAGULAN Unisex Salon',
    },
    receiptSubFooter: {
      type: String,
      default: 'Visit Again',
    },
    allowSplitPayments: {
      type: Boolean,
      default: true,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
    termsAndConditions: {
      type: String,
      default: 'Goods once sold cannot be returned. Services booked cannot be exchanged.',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const ApplicationSettings = mongoose.model('ApplicationSettings', applicationSettingsSchema);
export default ApplicationSettings;
