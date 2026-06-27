const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

// GSTIN Lookup — search local DB first, then external API
router.get('/lookup/:gstin', auth, async (req, res) => {
  try {
    const db = getDb();
    const gstin = (req.params.gstin || '').trim().toUpperCase();
    
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      return res.status(400).json({ success: false, msg: 'Invalid GSTIN format' });
    }

    // 1. Check our own customer database
    const local = await db('customers')
      .where({ organization_id: req.user.organization_id, gstin })
      .first();
    
    if (local) {
      return res.json({
        success: true,
        source: 'local',
        name: local.name,
        trade_name: local.trade_name || local.name,
        gstin: local.gstin,
        address: local.address,
        city: local.city,
        state: local.state,
        state_code: local.state_code,
        pincode: local.pincode,
        phone: local.phone,
        email: local.email
      });
    }

    // 2. Try external API (mastersindia)
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`https://commonapi.mastersindia.co/commonapis/searchgstin?gstin=${gstin}`, {
        timeout: 8000
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          const d = data.data;
          return res.json({
            success: true,
            source: 'external',
            name: d.lgnm || d.tradeNam || '',
            trade_name: d.tradeNam || d.lgnm || '',
            gstin: gstin,
            address: d.pradr?.adr?.addr?.bnm || d.pradr?.adr?.addr?.st || '',
            city: d.pradr?.adr?.addr?.city || d.pradr?.adr?.addr?.loc || '',
            state: d.pradr?.adr?.addr?.stcd || '',
            state_code: gstin.substring(0, 2),
            pincode: d.pradr?.adr?.addr?.pncd || '',
          });
        }
      }
    } catch (extErr) {
      console.log('External GST lookup failed:', extErr.message);
    }

    // 3. Fallback: parse GSTIN structure
    const STATE_CODES = {
      '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
      '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
      '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
      '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
      '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
      '24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
      '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
      '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
      '36':'Telangana','37':'Ladakh','38':'Other Territory'
    };

    return res.json({
      success: true,
      source: 'parsed',
      name: '',
      gstin: gstin,
      state: STATE_CODES[gstin.substring(0, 2)] || '',
      state_code: gstin.substring(0, 2),
      pan: gstin.substring(2, 12),
    });
  } catch (err) {
    console.error('GSTIN lookup error:', err);
    res.status(500).json({ success: false, msg: 'Lookup failed' });
  }
});

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
