export const ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  STAFF: 'staff',
};

export const BILL_STATUS = {
  COMPLETED: 'Completed',
  DRAFT: 'Draft',
  CANCELLED: 'Cancelled',
};

export const PAYMENT_METHODS = {
  CASH: 'Cash',
  UPI: 'UPI',
  DEBIT_CARD: 'Debit card',
  CREDIT_CARD: 'Credit card',
  SPLIT_PAYMENT: 'Split payment',
  OTHER: 'Other',
};

export const PAYMENT_STATUS = {
  PAID: 'Paid',
  PARTIAL: 'Partial',
  UNPAID: 'Unpaid',
};

export const CHAIR_STATUS = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  MAINTENANCE: 'Maintenance',
};

export const GENDER_CATEGORIES = {
  MEN: 'Men',
  WOMEN: 'Women',
  UNISEX: 'Unisex',
  KIDS: 'Kids',
};

export const SERVICE_CATEGORIES = [
  'Hair',
  'Skin',
  'Beauty',
  'Makeup',
  'Facial',
  'Hair Colouring',
  'Hair Treatment',
  'Bridal Packages',
  'Grooming Packages',
];

export const INVENTORY_TRANSACTION_TYPES = {
  STOCK_IN: 'stock-in',
  STOCK_OUT: 'stock-out',
  ADJUSTMENT: 'adjustment',
  BILLING_SALE: 'billing-sale',
};

export const ACTIVITY_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CREATE_BILL: 'CREATE_BILL',
  EDIT_BILL: 'EDIT_BILL',
  CANCEL_BILL: 'CANCEL_BILL',
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  RESET_PASSWORD: 'RESET_PASSWORD',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  CREATE_SERVICE: 'CREATE_SERVICE',
  UPDATE_SERVICE: 'UPDATE_SERVICE',
  DELETE_SERVICE: 'DELETE_SERVICE',
  CREATE_PRODUCT: 'CREATE_PRODUCT',
  UPDATE_PRODUCT: 'UPDATE_PRODUCT',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  CHAIR_STATUS_CHANGE: 'CHAIR_STATUS_CHANGE',
  RECORD_PAYMENT: 'RECORD_PAYMENT',
};
