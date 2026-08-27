import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

export const generateInvoicePDF = (bill, settings = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const salonName = settings.salonName || 'NAGULAN Unisex Salon';
      const tagline = settings.tagline || 'Hair | Skin | Beauty | Makeup';
      const franchisePhone = settings.franchiseEnquiry || '97899 61617';
      const address = settings.address || 'Nagulan salon , Indur , Dharmapuri , PIN 636803';

      let y = 135;
      const bannerPathPng = path.join(process.cwd(), 'uploads', 'nagulan-banner.png');
      const bannerPathJpg = path.join(process.cwd(), 'uploads', 'nagulan-banner.jpg');
      const bannerPath = fs.existsSync(bannerPathPng) ? bannerPathPng : fs.existsSync(bannerPathJpg) ? bannerPathJpg : null;

      if (bannerPath) {
        // Draw official banner image at top
        doc.image(bannerPath, 40, 40, { width: 515 });
        y = 150;
      } else {
        // Header Banner Fallback
        doc.rect(40, 40, 515, 75).fill('#121212');

        doc.fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(20)
          .text(salonName.toUpperCase(), 50, 52, { align: 'center', width: 495 });

        doc.fillColor('#C5A059')
          .font('Helvetica')
          .fontSize(11)
          .text(tagline, 50, 76, { align: 'center', width: 495 });

        doc.fillColor('#E0E0E0')
          .fontSize(9)
          .text(`Franchise Enquiry: ${franchisePhone}`, 50, 93, { align: 'center', width: 495 });
        y = 130;
      }

      // Invoice Details & Customer Info
      doc.fillColor('#222222').fontSize(10);

      // Left Column: Customer
      doc.font('Helvetica-Bold').text('BILLED TO:', 45, y);
      doc.font('Helvetica').text(`Customer Name: ${bill.customer?.name || 'Walk-in Customer'}`, 45, y + 15);
      doc.text(`Mobile: ${bill.customer?.mobile || '-'}`, 45, y + 28);
      if (bill.customer?.email) {
        doc.text(`Email: ${bill.customer.email}`, 45, y + 41);
      }

      // Right Column: Invoice Info
      doc.font('Helvetica-Bold').text(`TAX INVOICE: ${bill.billNumber}`, 340, y, { align: 'right' });
      doc.font('Helvetica').text(`Date: ${new Date(bill.billDate).toLocaleString('en-IN')}`, 340, y + 15, { align: 'right' });
      doc.text(`Attendant: ${bill.attendant?.name || 'Salon Staff'}`, 340, y + 28, { align: 'right' });
      doc.text(`Chair: ${bill.chair?.name || bill.chair?.chairNumber || 'Styling Station'}`, 340, y + 41, { align: 'right' });

      // Table Header
      y = 200;
      doc.rect(40, y, 515, 22).fill('#222222');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('ITEM / SERVICE DESCRIPTION', 48, y + 6);
      doc.text('QTY', 280, y + 6, { width: 40, align: 'center' });
      doc.text('RATE (₹)', 330, y + 6, { width: 60, align: 'right' });
      doc.text('DISC (₹)', 400, y + 6, { width: 60, align: 'right' });
      doc.text('AMOUNT (₹)', 470, y + 6, { width: 75, align: 'right' });

      // Table Rows
      y += 24;
      doc.fillColor('#333333').font('Helvetica').fontSize(9);

      bill.items.forEach((item, index) => {
        const rowBg = index % 2 === 0 ? '#F9F9F9' : '#FFFFFF';
        doc.rect(40, y - 2, 515, 20).fill(rowBg);

        doc.fillColor('#222222');
        doc.text(`${item.name} (${item.category || item.itemType})`, 48, y + 3, { width: 230, lineBreak: false });
        doc.text(item.quantity.toString(), 280, y + 3, { width: 40, align: 'center' });
        doc.text(item.unitPrice.toFixed(2), 330, y + 3, { width: 60, align: 'right' });
        doc.text((item.discountAmount || 0).toFixed(2), 400, y + 3, { width: 60, align: 'right' });
        doc.text(item.totalAmount.toFixed(2), 470, y + 3, { width: 75, align: 'right' });

        y += 20;
      });

      // Divider
      doc.rect(40, y + 5, 515, 1).fill('#CCCCCC');
      y += 15;

      // Summary Section
      const summaryX = 330;
      const valX = 470;

      doc.fillColor('#444444').font('Helvetica').fontSize(9);
      doc.text('Subtotal:', summaryX, y);
      doc.text(`₹ ${bill.subtotal.toFixed(2)}`, valX, y, { width: 75, align: 'right' });
      y += 15;

      if (bill.discountTotal > 0) {
        doc.text(`Discount (${bill.discountType === 'percentage' ? `${bill.discountValue}%` : 'Flat'}):`, summaryX, y);
        doc.text(`- ₹ ${bill.discountTotal.toFixed(2)}`, valX, y, { width: 75, align: 'right' });
        y += 15;
      }

      if (bill.cgst > 0 || bill.sgst > 0) {
        doc.text('CGST (9%):', summaryX, y);
        doc.text(`₹ ${bill.cgst.toFixed(2)}`, valX, y, { width: 75, align: 'right' });
        y += 15;

        doc.text('SGST (9%):', summaryX, y);
        doc.text(`₹ ${bill.sgst.toFixed(2)}`, valX, y, { width: 75, align: 'right' });
        y += 15;
      }

      // Grand Total Highlight
      doc.rect(summaryX - 10, y - 2, 235, 24).fill('#121212');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11);
      doc.text('GRAND TOTAL:', summaryX, y + 5);
      doc.fillColor('#C5A059');
      doc.text(`₹ ${bill.grandTotal.toFixed(2)}`, valX - 10, y + 5, { width: 85, align: 'right' });

      y += 32;
      doc.fillColor('#333333').font('Helvetica').fontSize(9);
      doc.text(`Payment Method: ${bill.paymentMethod}`, summaryX, y);
      y += 14;
      doc.text(`Amount Paid: ₹ ${(bill.amountReceived || bill.grandTotal).toFixed(2)}`, summaryX, y);
      y += 14;
      doc.text(`Balance: ₹ ${(bill.balanceAmount || 0).toFixed(2)}`, summaryX, y);

      // Footer
      const footerY = 730;
      doc.rect(40, footerY, 515, 1).fill('#DDDDDD');

      doc.fillColor('#111111')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(settings.receiptFooterMessage || 'Thank you for visiting NAGULAN Unisex Salon', 40, footerY + 10, {
          align: 'center',
          width: 515,
        });

      doc.fillColor('#C5A059')
        .font('Helvetica')
        .fontSize(9)
        .text(settings.receiptSubFooter || 'Visit Again', 40, footerY + 26, {
          align: 'center',
          width: 515,
        });

      doc.fillColor('#777777')
        .fontSize(8)
        .text(address, 40, footerY + 40, {
          align: 'center',
          width: 515,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
