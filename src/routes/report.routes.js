import express from 'express';
import {
  getSalesReport,
  getServiceReport,
  getProductReport,
  getAttendantReport,
  getTaxGstReport,
  getCancelledBillsReport,
  getInventoryReport,
  exportReportExcel,
} from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdminOrAbove } from '../middleware/roles.js';

const router = express.Router();

router.use(authenticate);
router.use(requireAdminOrAbove);

router.get('/sales', getSalesReport);
router.get('/services', getServiceReport);
router.get('/products', getProductReport);
router.get('/attendants', getAttendantReport);
router.get('/tax-gst', getTaxGstReport);
router.get('/cancelled-bills', getCancelledBillsReport);
router.get('/inventory', getInventoryReport);
router.get('/export/excel', exportReportExcel);

export default router;
