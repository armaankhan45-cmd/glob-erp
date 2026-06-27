const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');

// GSTIN Lookup
router.get('/lookup/:gstin', auth, async (req, res) => {
  try {
    const db = getDb();
    const gstin = (req.params.gstin || '').trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      return res.status(400).json({ success: false, msg: 'Invalid GSTIN format' });
    }
    const local = await db('customers').where({ organization_id: req.user.organization_id, gstin }).first();
    if (local) {
      return res.json({ success: true, source: 'local', name: local.name, trade_name: local.trade_name || local.name, gstin: local.gstin, address: local.address, city: local.city, state: local.state, state_code: local.state_code, pincode: local.pincode, phone: local.phone, email: local.email });
    }
    try {
      const fetch = require('node-fetch');
      const response = await fetch(`https://commonapi.mastersindia.co/commonapis/searchgstin?gstin=${gstin}`, { timeout: 8000 });
      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          const d = data.data;
          return res.json({ success: true, source: 'external', name: d.lgnm || d.tradeNam || '', trade_name: d.tradeNam || d.lgnm || '', gstin, address: d.pradr?.adr?.addr?.bnm || d.pradr?.adr?.addr?.st || '', city: d.pradr?.adr?.addr?.city || d.pradr?.adr?.addr?.loc || '', state: d.pradr?.adr?.addr?.stcd || '', state_code: gstin.substring(0, 2), pincode: d.pradr?.adr?.addr?.pncd || '' });
        }
      }
    } catch (extErr) { console.log('External GST lookup failed:', extErr.message); }
    const STATE_CODES = {'01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar','36':'Telangana','37':'Ladakh','38':'Other Territory'};
    return res.json({ success: true, source: 'parsed', name: '', gstin, state: STATE_CODES[gstin.substring(0, 2)] || '', state_code: gstin.substring(0, 2), pan: gstin.substring(2, 12) });
  } catch (err) { res.status(500).json({ success: false, msg: 'Lookup failed' }); }
});

// GST Summary — monthly breakdown with carry-forward balance
router.get('/summary', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const year = req.query.year || new Date().getFullYear();

    // Financial year: April of year to March of year+1
    const fyStart = `${year}-04-01`;
    const fyEnd = `${year + 1}-03-31`;

    // Monthly Output GST from invoices
    const outputMonthly = await db('invoices')
      .where({ organization_id: orgId })
      .whereBetween('invoice_date', [fyStart, fyEnd])
      .select(
        db.raw("TO_CHAR(invoice_date, 'YYYY-MM') as month"),
        db.raw('COUNT(*) as invoice_count'),
        db.raw('COALESCE(SUM(subtotal), 0) as taxable_value'),
        db.raw('COALESCE(SUM(cgst_amount), 0) as cgst'),
        db.raw('COALESCE(SUM(sgst_amount), 0) as sgst'),
        db.raw('COALESCE(SUM(igst_amount), 0) as igst'),
        db.raw('COALESCE(SUM(total_amount), 0) as total_amount')
      )
      .groupBy('month')
      .orderBy('month');

    // Monthly Input GST from purchase bills
    const inputMonthly = await db('purchase_bills')
      .where({ organization_id: orgId })
      .whereBetween('bill_date', [fyStart, fyEnd])
      .select(
        db.raw("TO_CHAR(bill_date, 'YYYY-MM') as month"),
        db.raw('COUNT(*) as bill_count'),
        db.raw('COALESCE(SUM(subtotal), 0) as taxable_value'),
        db.raw('COALESCE(SUM(cgst_amount), 0) as cgst'),
        db.raw('COALESCE(SUM(sgst_amount), 0) as sgst'),
        db.raw('COALESCE(SUM(igst_amount), 0) as igst'),
        db.raw('COALESCE(SUM(total_amount), 0) as total_amount')
      )
      .groupBy('month')
      .orderBy('month');

    // Yearly totals
    const outputTotal = await db('invoices')
      .where({ organization_id: orgId })
      .whereBetween('invoice_date', [fyStart, fyEnd])
      .sum('subtotal as taxable').sum('cgst_amount as cgst').sum('sgst_amount as sgst').sum('igst_amount as igst').sum('total_amount as total').first();

    const inputTotal = await db('purchase_bills')
      .where({ organization_id: orgId })
      .whereBetween('bill_date', [fyStart, fyEnd])
      .sum('subtotal as taxable').sum('cgst_amount as cgst').sum('sgst_amount as sgst').sum('igst_amount as igst').sum('total_amount as total').first();

    const outCGST = parseFloat(outputTotal?.cgst || 0);
    const outSGST = parseFloat(outputTotal?.sgst || 0);
    const outIGST = parseFloat(outputTotal?.igst || 0);
    const inCGST = parseFloat(inputTotal?.cgst || 0);
    const inSGST = parseFloat(inputTotal?.sgst || 0);
    const inIGST = parseFloat(inputTotal?.igst || 0);

    // Monthly payable with CARRY FORWARD balance
    // Running balance: if input > output in a month, excess credit carries to next month
    const monthNames = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
    let carryForward = 0; // running carry-forward balance from previous months

    const monthlyPayable = monthNames.map((m, i) => {
      const monthKey = i < 9 ? `${year}-${String(i + 4).padStart(2, '0')}` : `${year + 1}-${String(i - 8).padStart(2, '0')}`;
      const o = outputMonthly.find(g => g.month === monthKey) || {};
      const inp = inputMonthly.find(g => g.month === monthKey) || {};
      const oTotal = parseFloat(o.cgst || 0) + parseFloat(o.sgst || 0) + parseFloat(o.igst || 0);
      const iTotal = parseFloat(inp.cgst || 0) + parseFloat(inp.sgst || 0) + parseFloat(inp.igst || 0);
      const invoiceCount = parseInt(o.invoice_count || 0);
      const billCount = parseInt(inp.bill_count || 0);

      // Net = Output - Input - Carry Forward from previous month
      const net = oTotal - iTotal - carryForward;

      let payable = 0;
      let newCarryForward = 0;
      if (net > 0) {
        payable = net;       // You need to pay this
        newCarryForward = 0; // No credit left
      } else {
        payable = 0;              // Nothing to pay
        newCarryForward = Math.abs(net); // Credit carries forward
      }

      const entry = {
        month: m,
        monthKey,
        sales: parseFloat(o.total_amount || 0),
        purchases: parseFloat(inp.total_amount || 0),
        outputGST: oTotal,
        inputGST: iTotal,
        invoiceCount,
        billCount,
        carryForward,           // Credit brought forward FROM previous month
        payable,                // How much you actually pay this month
        balance: newCarryForward, // Credit carried forward TO next month
      };

      carryForward = newCarryForward; // Update for next iteration
      return entry;
    });

    // Final carry-forward is the balance from the last month
    const finalCarryForward = carryForward;

    res.json({
      success: true,
      gstr1: outputMonthly,
      gstr2: inputMonthly,
      gstr3b: {
        outputCGST: outCGST, outputSGST: outSGST, outputIGST: outIGST,
        outputTotal: outCGST + outSGST + outIGST,
        inputCGST: inCGST, inputSGST: inSGST, inputIGST: inIGST,
        inputTotal: inCGST + inSGST + inIGST,
        netCGST: Math.max(0, outCGST - inCGST),
        netSGST: Math.max(0, outSGST - inSGST),
        netIGST: Math.max(0, outIGST - inIGST),
        netPayable: Math.max(0, (outCGST - inCGST) + (outSGST - inSGST) + (outIGST - inIGST)),
        creditBalance: Math.max(0, (inCGST - outCGST) + (inSGST - outSGST) + (inIGST - outIGST)),
        finalCarryForward,
      },
      monthlyPayable,
      salesTotal: parseFloat(outputTotal?.total || 0),
      purchaseTotal: parseFloat(inputTotal?.total || 0)
    });
  } catch (err) {
    console.error('GST summary error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Get bills for a specific month — returns invoices + purchases for that month
router.get('/monthly-bills', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const { month } = req.query; // format: YYYY-MM e.g. 2025-06

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, msg: 'Provide month as YYYY-MM' });
    }

    const [start, end] = [`${month}-01`, `${month}-31`];

    const invoices = await db('invoices')
      .leftJoin('customers', 'invoices.customer_id', 'customers.id')
      .where('invoices.organization_id', orgId)
      .whereBetween('invoice_date', [start, end])
      .select(
        'invoices.id', 'invoices.invoice_number', 'invoices.invoice_date',
        db.raw("COALESCE(customers.name, '(No Customer)') as customer_name"),
        'invoices.subtotal', 'invoices.cgst_amount', 'invoices.sgst_amount', 'invoices.igst_amount', 'invoices.total_amount', 'invoices.payment_status'
      )
      .orderBy('invoice_date', 'desc');

    const purchases = await db('purchase_bills')
      .where({ organization_id: orgId })
      .whereBetween('bill_date', [start, end])
      .select('id', 'bill_number', 'bill_date', 'supplier_name', 'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount', 'payment_status')
      .orderBy('bill_date', 'desc');

    res.json({ success: true, month, invoices, purchases });
  } catch (err) {
    console.error('Monthly bills error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

module.exports = router;
