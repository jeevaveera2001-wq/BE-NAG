import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Product from '../models/Product.js';
import Chair from '../models/Chair.js';
import Attendant from '../models/Attendant.js';
import Customer from '../models/Customer.js';
import Bill from '../models/Bill.js';
import Payment from '../models/Payment.js';
import ApplicationSettings from '../models/ApplicationSettings.js';
import { ROLES, CHAIR_STATUS, BILL_STATUS, PAYMENT_METHODS, PAYMENT_STATUS } from '../config/constants.js';

dotenv.config();

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nagulan_salon');
    console.log('[Seeding]: Connected to MongoDB');

    // Clear existing collections
    await Promise.all([
      User.deleteMany({}),
      Service.deleteMany({}),
      Product.deleteMany({}),
      Chair.deleteMany({}),
      Attendant.deleteMany({}),
      Customer.deleteMany({}),
      Bill.deleteMany({}),
      Payment.deleteMany({}),
      ApplicationSettings.deleteMany({}),
    ]);
    console.log('[Seeding]: Cleared old test database records.');

    // 1. Seed Application Settings
    const settings = await ApplicationSettings.create({
      salonName: 'NAGULAN Unisex Salon',
      tagline: 'Hair | Skin | Beauty | Makeup',
      franchiseEnquiry: '97899 61617',
      phone: '97899 61617',
      email: 'nagulanunisexsalon@gmail.com',
      address: 'Nagulan salon , Indur , Dharmapuri , PIN 636803',
      gstNumber: '',
      isGstEnabled: false,
      defaultGstPercent: 18,
      cgstPercent: 9,
      sgstPercent: 9,
      currencySymbol: '₹',
      receiptFooterMessage: 'Thank you for visiting NAGULAN Unisex Salon',
      receiptSubFooter: 'Visit Again',
      termsAndConditions: 'Services booked cannot be exchanged. Goods once sold cannot be returned.',
    });
    console.log('[Seeding]: Created Application Settings.');

    // 2. Seed Users (Super Admin, Admin, Staff)
    const superAdmin = await User.create({
      employeeId: 'EMP-001',
      fullName: 'Super Administrator',
      username: 'superadmin',
      email: 'superadmin@nagulan.com',
      mobile: '9789961617',
      password: 'SuperAdmin@123',
      role: ROLES.SUPER_ADMIN,
      shift: 'Full Day',
      address: 'Salem / Chennai, TN',
      status: 'active',
    });

    const admin = await User.create({
      employeeId: 'EMP-002',
      fullName: 'Salon Store Manager',
      username: 'admin',
      email: 'admin@nagulan.com',
      mobile: '9840123456',
      password: 'Admin@123',
      role: ROLES.ADMIN,
      shift: 'Full Day',
      address: 'Main Branch Studio',
      status: 'active',
      createdBy: superAdmin._id,
    });

    const staff = await User.create({
      employeeId: 'EMP-003',
      fullName: 'Senior Stylist Rajesh',
      username: 'staff',
      email: 'staff@nagulan.com',
      mobile: '9876543210',
      password: 'Staff@123',
      role: ROLES.STAFF,
      shift: 'Morning',
      address: 'Styling Dept',
      status: 'active',
      createdBy: admin._id,
    });
    console.log('[Seeding]: Seeded Users (Super Admin, Admin, Staff).');

    // 3. Seed Chairs (All Available by default)
    const chairs = await Chair.insertMany([
      { chairNumber: 'C-01', name: 'Styling Station 1 (Men/Unisex)', floor: 'Ground Floor', section: 'Main Styling Area', status: CHAIR_STATUS.AVAILABLE, createdBy: superAdmin._id },
      { chairNumber: 'C-02', name: 'Styling Station 2 (Men/Unisex)', floor: 'Ground Floor', section: 'Main Styling Area', status: CHAIR_STATUS.AVAILABLE, createdBy: superAdmin._id },
      { chairNumber: 'C-03', name: 'Premium Hair Spa & Wash Station', floor: 'Ground Floor', section: 'Hair Treatment Bay', status: CHAIR_STATUS.AVAILABLE, createdBy: superAdmin._id },
      { chairNumber: 'C-04', name: 'Women Styling Chair 1', floor: '1st Floor', section: 'Women Luxury Lounge', status: CHAIR_STATUS.AVAILABLE, createdBy: superAdmin._id },
      { chairNumber: 'C-05', name: 'Facial & Skin Care Recliner', floor: '1st Floor', section: 'Skin & Aesthetics Suite', status: CHAIR_STATUS.AVAILABLE, createdBy: superAdmin._id },
      { chairNumber: 'C-06', name: 'Bridal & Makeup Suite', floor: '1st Floor', section: 'VIP Makeup Room', status: CHAIR_STATUS.AVAILABLE, createdBy: superAdmin._id },
    ]);
    console.log('[Seeding]: Seeded Chairs.');

    // 4. Seed Attendants (Clean stats)
    const attendants = await Attendant.insertMany([
      {
        attendantId: 'ATT-101',
        fullName: 'Rajesh Kumar',
        mobile: '9876543211',
        email: 'rajesh.stylist@nagulan.com',
        specialization: ['Hair Cut', 'Beard Styling', 'Hair Colouring'],
        assignedChair: chairs[0]._id,
        shiftTiming: '9:00 AM - 6:00 PM',
        commissionPercentage: 12,
        servicesCompleted: 0,
        totalSalesGenerated: 0,
        createdBy: superAdmin._id,
      },
      {
        attendantId: 'ATT-102',
        fullName: 'Priya Sundaram',
        mobile: '9876543212',
        email: 'priya.beauty@nagulan.com',
        specialization: ['Bridal Makeup', 'Facial & Clean Up', 'Hair Treatment'],
        assignedChair: chairs[3]._id,
        shiftTiming: '10:00 AM - 7:00 PM',
        commissionPercentage: 15,
        servicesCompleted: 0,
        totalSalesGenerated: 0,
        createdBy: superAdmin._id,
      },
      {
        attendantId: 'ATT-103',
        fullName: 'Vigneshwaran M',
        mobile: '9876543213',
        email: 'vicky@nagulan.com',
        specialization: ['Hair Spa', 'Creative Hair Cut', 'Grooming Packages'],
        assignedChair: chairs[1]._id,
        shiftTiming: '11:00 AM - 8:00 PM',
        commissionPercentage: 10,
        servicesCompleted: 0,
        totalSalesGenerated: 0,
        createdBy: superAdmin._id,
      },
      {
        attendantId: 'ATT-104',
        fullName: 'Ananya Ramesh',
        mobile: '9876543214',
        email: 'ananya.skin@nagulan.com',
        specialization: ['Gold Facial', 'Skin Brightening', 'Pedicure & Manicure'],
        assignedChair: chairs[4]._id,
        shiftTiming: '9:30 AM - 6:30 PM',
        commissionPercentage: 12,
        servicesCompleted: 0,
        totalSalesGenerated: 0,
        createdBy: superAdmin._id,
      },
    ]);
    console.log('[Seeding]: Seeded Attendants.');

    // 5. Seed Services Menu
    const services = await Service.insertMany([
      // Hair Services
      { name: 'Men Classic Haircut & Wash', category: 'Hair', genderCategory: 'Men', duration: 30, price: 250, discountPrice: 0, taxPercentage: 18, description: 'Precision styling with refreshing hair wash', createdBy: superAdmin._id },
      { name: 'Men Fade & Beard Sculpting Combo', category: 'Hair', genderCategory: 'Men', duration: 45, price: 450, discountPrice: 50, taxPercentage: 18, description: 'Skin fade with premium razor sharp beard sculpt and hot towel', createdBy: superAdmin._id },
      { name: 'Women Layer Cut & Blowdry', category: 'Hair', genderCategory: 'Women', duration: 45, price: 650, discountPrice: 0, taxPercentage: 18, description: 'Customised layers with professional blowdry setting', createdBy: superAdmin._id },
      { name: 'Kids Trendy Haircut', category: 'Hair', genderCategory: 'Kids', duration: 25, price: 180, discountPrice: 0, taxPercentage: 18, description: 'Fun and gentle haircut for children under 12', createdBy: superAdmin._id },
      // Hair Treatments & Colouring
      { name: 'Keratin Hair Smoothening Treatment', category: 'Hair Treatment', genderCategory: 'Unisex', duration: 120, price: 3500, discountPrice: 500, taxPercentage: 18, description: 'Intense frizz control and ultra silky mirror finish', createdBy: superAdmin._id },
      { name: 'L’Oreal Deep Conditioning Spa', category: 'Hair Treatment', genderCategory: 'Unisex', duration: 45, price: 850, discountPrice: 0, taxPercentage: 18, description: 'Restorative scalp massage and steam conditioning', createdBy: superAdmin._id },
      { name: 'Global Hair Colouring (Ammonia-Free)', category: 'Hair Colouring', genderCategory: 'Unisex', duration: 90, price: 2200, discountPrice: 200, taxPercentage: 18, description: 'Rich premium shade with deep shine and grey coverage', createdBy: superAdmin._id },
      { name: 'Highlights / Balayage Streaks', category: 'Hair Colouring', genderCategory: 'Women', duration: 100, price: 2800, discountPrice: 300, taxPercentage: 18, description: 'Modern dimensional sun-kissed hair highlights', createdBy: superAdmin._id },
      // Facial & Skin
      { name: 'Nagulan Signature Gold Radiance Facial', category: 'Facial', genderCategory: 'Unisex', duration: 60, price: 1600, discountPrice: 200, taxPercentage: 18, description: '24K gold foil infused facial for instant bridal glow and hydration', createdBy: superAdmin._id },
      { name: 'O3+ Brightening Clean Up', category: 'Skin', genderCategory: 'Unisex', duration: 40, price: 950, discountPrice: 0, taxPercentage: 18, description: 'Deep pore cleansing, blackhead extraction and antioxidant serum', createdBy: superAdmin._id },
      { name: 'De-Tan Therapy (Face & Neck)', category: 'Skin', genderCategory: 'Unisex', duration: 30, price: 500, discountPrice: 50, taxPercentage: 18, description: 'Instant tan removal and melanin soothing treatment', createdBy: superAdmin._id },
      // Beauty & Makeup
      { name: 'Bridal HD Makeup & Saree Draping', category: 'Bridal Packages', genderCategory: 'Women', duration: 150, price: 8500, discountPrice: 1000, taxPercentage: 18, description: 'Flawless high-definition bridal look with eyelashes, lenses and draping', createdBy: superAdmin._id },
      { name: 'Groom Royal Transformation Package', category: 'Grooming Packages', genderCategory: 'Men', duration: 90, price: 2999, discountPrice: 400, taxPercentage: 18, description: 'Executive haircut, beard spa, diamond facial and de-tan manicure', createdBy: superAdmin._id },
      { name: 'Luxury Rose Petal Pedicure', category: 'Beauty', genderCategory: 'Unisex', duration: 45, price: 750, discountPrice: 0, taxPercentage: 18, description: 'Exfoliating salt scrub, callus buffing and soothing leg massage', createdBy: superAdmin._id },
      { name: 'Eyebrow Threading & Upper Lip', category: 'Beauty', genderCategory: 'Women', duration: 15, price: 100, discountPrice: 0, taxPercentage: 18, description: 'Precise organic cotton thread shaping', createdBy: superAdmin._id },
    ]);
    console.log('[Seeding]: Seeded Services.');

    // 6. Seed Products (Retail)
    const products = await Product.insertMany([
      { name: "L'Oreal Serie Expert Vitamino Shampoo 300ml", sku: 'LOR-VIT-300', brand: "L'Oreal Professionnel", category: 'Hair Care', purchasePrice: 550, sellingPrice: 790, currentStock: 18, minStockWarning: 5, taxPercentage: 18, createdBy: superAdmin._id },
      { name: "L'Oreal Absolute Repair Mask 250ml", sku: 'LOR-REP-250', brand: "L'Oreal Professionnel", category: 'Hair Care', purchasePrice: 620, sellingPrice: 890, currentStock: 12, minStockWarning: 4, taxPercentage: 18, createdBy: superAdmin._id },
      { name: 'Moroccanoil Treatment Oil 50ml', sku: 'MOR-OIL-050', brand: 'Moroccanoil', category: 'Hair Serum', purchasePrice: 1600, sellingPrice: 2200, currentStock: 8, minStockWarning: 3, taxPercentage: 18, createdBy: superAdmin._id },
      { name: 'Beardo Godfather Beard Oil 30ml', sku: 'BRD-OIL-030', brand: 'Beardo', category: 'Men Grooming', purchasePrice: 210, sellingPrice: 350, currentStock: 24, minStockWarning: 6, taxPercentage: 18, createdBy: superAdmin._id },
      { name: 'Urban Gabru Clay Hair Wax 100g', sku: 'URB-WAX-100', brand: 'Urban Gabru', category: 'Styling', purchasePrice: 190, sellingPrice: 320, currentStock: 3, minStockWarning: 5, taxPercentage: 18, createdBy: superAdmin._id }, // Low stock sample
      { name: 'O3+ Professional Whitening Cream 50g', sku: 'O3P-WHT-050', brand: 'O3+', category: 'Skin Care', purchasePrice: 850, sellingPrice: 1250, currentStock: 2, minStockWarning: 4, taxPercentage: 18, createdBy: superAdmin._id }, // Low stock sample
    ]);
    console.log('[Seeding]: Seeded Retail Products.');

    // 7. Seed Customers (Clean baseline)
    const customers = await Customer.insertMany([
      { name: 'Suresh Babu', mobile: '9840112233', email: 'suresh.babu@gmail.com', gender: 'Male', totalVisits: 0, totalSpent: 0, lastVisit: null, notes: 'Prefers Rajesh for classic fade' },
      { name: 'Kavitha Ramachandran', mobile: '9840223344', email: 'kavitha.r@gmail.com', gender: 'Female', totalVisits: 0, totalSpent: 0, lastVisit: null, notes: 'Uses ammonia-free hair color only' },
      { name: 'Manoj Kumar', mobile: '9840334455', email: 'manoj.k@gmail.com', gender: 'Male', totalVisits: 0, totalSpent: 0, lastVisit: null, notes: 'VIP regular customer' },
      { name: 'Deepika S', mobile: '9840445566', email: 'deepika.s@gmail.com', gender: 'Female', totalVisits: 0, totalSpent: 0, lastVisit: null, notes: 'Interested in Bridal packages' },
      { name: 'Arun Prasath', mobile: '9840556677', email: 'arun.prasath@gmail.com', gender: 'Male', totalVisits: 0, totalSpent: 0, lastVisit: null, notes: 'Weekend bookings only' },
    ]);
    console.log('[Seeding]: Seeded Customers.');

    console.log('\n=============================================================');
    console.log('  NAGULAN Unisex Salon Database Seeded (Clean Ledger)!');
    console.log('=============================================================');
    console.log('  Accounts Created:');
    console.log('  - Super Admin : superadmin@nagulan.com / SuperAdmin@123');
    console.log('  - Admin       : admin@nagulan.com / Admin@123');
    console.log('  - Staff       : staff@nagulan.com / Staff@123');
    console.log('=============================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
