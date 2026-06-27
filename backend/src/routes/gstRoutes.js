const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

router.get('/summary', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const year = req.query.year || new Date().getFullYear();

    // GSTR-1: Output GST from invoices
    const gstr1 = await db('invoices')
      .where({ organization_id: orgId })
      .whereRaw("EXTRACT(YEAR FROM invoice_date) = ?", [year])
      .select(
        db.raw("TO_CHAR(invoice_date, 'YYYY-MM') as month"),
        db.raw('COUNT(*) as invoice_count'),
        db.raw('SUM(total_amount) as taxable_value'),
        db.raw('SUM(cgst_amount) as cgst'),
        db.raw('SUM(sgst_amount) as sgst'),
        db.raw('SUM(igst_amount) as igst')
      )
      .groupBy('month')
      .orderBy('month');

    // GSTR-2: Input GST from purchase bills
    const gstr2 = await db('purchase_bills')
      .where({ organization_id: orgId })
      .whereRaw("EXTRACT(YEAR FROM bill_date) = ?", [year])
      .select(
        db.raw("TO_CHAR(bill_date, 'YYYY-MM') as month"),
        db.raw('COUNT(*) as bill_count'),
        db.raw('SUM(total_amount) as taxable_value'),
        db.raw('SUM(cgst_amount) as cgst'),
        db.raw('SUM(sgst_amount) as sgst'),
        db.raw('SUM(igst_amount) as igst')
      )
      .groupBy('month')
      .orderBy('month');

    // GSTR-3B: Net payable
    const outputTotal = await db('invoices')
      .where({ organization_id: orgId })
      .whereRaw("EXTRACT(YEAR FROM invoice_date) = ?", [year])
      .sum('cgst_amount as cgst').sum('sgst_amount as sgst').sum('igst_amount as igst').first();

    const inputTotal = await db('purchase_bills')
      .where({ organization_id: orgId })
      .whereRaw("EXTRACT(YEAR FROM bill_date) = ?", [year])
      .sum('cgst_amount as cgst').sum('sgst_amount as sgst').sum('igst_amount as igst').first();

    res.json({
      success: true,
      gstr1,
      gstr2,
      gstr3b: {
        outputCGST: parseFloat(outputTotal?.cgst || 0),
        outputSGST: parseFloat(outputTotal?.sgst || 0),
        outputIGST: parseFloat(outputTotal?.igst || 0),
        inputCGST: parseFloat(inputTotal?.cgst || 0),
        inputSGST: parseFloat(inputTotal?.sgst || 0),
        inputIGST: parseFloat(inputTotal?.igst || 0),
        netCGST: Math.max(0, parseFloat(outputTotal?.cgst || 0) - parseFloat(inputTotal?.cgst || 0)),
        netSGST: Math.max(0, parseFloat(outputTotal?.sgst || 0) - parseFloat(inputTotal?.sgst || 0)),
        netIGST: Math.max(0, parseFloat(outputTotal?.igst || 0) - parseFloat(inputTotal?.igst || 0))
      }
    });
  } catch (err) {
    console.error('GST summary error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

module.exports = router;
