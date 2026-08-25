# BE-NS — NAGULAN Unisex Salon Backend REST API & WebSocket Server

Production-ready Node.js, Express, MongoDB and Socket.IO backend service for **NAGULAN Unisex Salon** (*Hair | Skin | Beauty | Makeup* • Franchise Enquiry: **97899 61617** • Address: **Nagulan salon , Indur , Dharmapuri , PIN 636803**).

---

## 🛠️ Technology Stack
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB & Mongoose ODM (MongoDB Atlas Cloud compatible)
- **Real-Time Sync**: Socket.IO
- **Authentication**: JWT (Access Tokens + Refresh Tokens) with bcrypt password hashing
- **Security**: Helmet, CORS, Express-Rate-Limit, Input Validation
- **PDF Engine**: PDFKit Invoice Generator
- **Export Engines**: ExcelJS & csv-writer
- **File Uploads**: Multer storage for banners and assets

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your MongoDB URI and JWT secrets:
```bash
cp .env.example .env
```

### 3. Seed the Database
Populate initial Super Admin, Admin, and Staff accounts, services menu, styling stations, and attendants:
```bash
npm run seed
```

### 4. Start the Server
```bash
# Production start
npm start

# Development mode (with file watcher)
npm run dev
```

---

## 👑 Default Pre-Seeded Accounts

| Role | Email / Identifier | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@nagulan.com` / `superadmin` | `SuperAdmin@123` | Full system access & audit logs |
| **Admin** | `admin@nagulan.com` / `admin` | `Admin@123` | Store manager, menu, billing & reports |
| **Staff** | `staff@nagulan.com` / `staff` | `Staff@123` | POS billing terminal & chair updates |

---

## 📡 Core API Modules
- `/api/auth` — Login, Token Refresh, Current Profile, Logout
- `/api/bills` — POS Invoice Creation, Dual Print (80mm & A4), PDF Generation, Cancellation with Audit Reasons
- `/api/dashboard` — Live Sales Metrics, Payment Method Breakdown & Chair Occupancy
- `/api/services` — Services Catalog & Menu Management
- `/api/products` — Retail Inventory, Stock-In / Stock-Out Ledger
- `/api/chairs` — Real-Time Styling Station Floor Plan & Status Sync
- `/api/attendants` — Stylists, Commission Tracking & Daily Attendance
- `/api/customers` — Client CRM Database & Visit Histories
- `/api/users` — User Account Management (Super Admin & Admin only)
- `/api/reports` — Multi-Dimensional Excel & CSV Export Engine
- `/api/activity-logs` — Immutable Audit Trail (Super Admin only)
- `/api/settings` — Salon Identity, Brand Banner Upload & GST Parameters
