const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth } = require('../middleware/auth');
const auditLog = require('../middleware/auditLog');

// List customers
router.get('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { search } = req.query;
    let query = db('customers').where({ organization_id: req.user.organization_id });
    
    if (search) {
      query = query.where(function() {
        this.where('name', 'ilike', `%${search}%`)
          .orWhere('gstin', 'ilike', `%${search}%`)
          .orWhere('phone', 'ilike', `%${search}%`);
      });
    }
    
    const customers = await query.orderBy('created_at', 'desc');
    res.json({ success: true, customers });
  } catch (err) {
    console.error('List customers error:', err);
    res.status(500).json({ success: false, msg: 'Failed to fetch customers', customers: [] });
  }
});

// Get single customer
router.get('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const customer = await db('customers')
      .where({ id: req.params.id, organization_id: req.user.organization_id })
      .first();
    
    if (!customer) return res.status(404).json({ success: false, msg: 'Customer not found' });
    
    // Get invoice history
    const invoices = await db('invoices')
      .where({ customer_id: customer.id, organization_id: req.user.organization_id })
      .orderBy('invoice_date', 'desc');
    
    const totalBusiness = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0);
    const totalPaid = invoices.filter(i => i.payment_status === 'Paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    
    res.json({ success: true, customer, invoices, totalBusiness, totalPaid, outstanding: totalBusiness - totalPaid });
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ success: false, msg: 'Failed' });
  }
});

// Create customer
router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const data = { ...req.body, organization_id: req.user.organization_id };
    
    const [customer] = await db('customers').insert(data).returning('id');
    await auditLog(req.user.id, req.user.organization_id, 'CREATE', 'customers', customer.id || customer, null, data, req.ip);
    
    res.status(201).json({ success: true, customer: { id: customer.id || customer, ...data } });
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ success: false, msg: 'Failed to create customer' });
  }
});

// Update customer
router.put('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const old = await db('customers').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!old) return res.status(404).json({ success: false, msg: 'Customer not found' });
    
    await db('customers').where({ id: req.params.id }).update(req.body);
    await auditLog(req.user.id, req.user.organization_id, 'UPDATE', 'customers', req.params.id, old, req.body, req.ip);
    
    res.json({ success: true, msg: 'Customer updated' });
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ success: false, msg: 'Failed to update' });
  }
});

// Delete customer
router.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const customer = await db('customers').where({ id: req.params.id, organization_id: req.user.organization_id }).first();
    if (!customer) return res.status(404).json({ success: false, msg: 'Customer not found' });
    
    // Check for invoices
    const invoiceCount = await db('invoices').where({ customer_id: req.params.id }).count('id as count').first();
    if (parseInt(invoiceCount.count) > 0) {
      return res.status(400).json({ success: false, msg: 'Cannot delete customer with invoices' });
    }
    
    await db('customers').where({ id: req.params.id }).del();
    await auditLog(req.user.id, req.user.organization_id, 'DELETE', 'customers', req.params.id, customer, null, req.ip);
    
    res.json({ success: true, msg: 'Customer deleted' });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ success: false, msg: 'Failed to delete' });
  }
});

// GSTIN lookup (offline parser)
router.post('/gst-lookup', auth, async (req, res) => {
  try {
    const { gstin } = req.body;
    const STATE_CODES = {
      '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
      '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
      '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
      '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
      '20':'Jharkhand','21':'Odisha','22':'Chattisgarh','23':'Madhya Pradesh',
      '24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
      '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
      '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
      '36':'Telangana','37':'Ladakh','38':'Other Territory'
    };
    const BUSINESS_TYPES = {
      '1':'Sole Proprietorship','2':'HUF','3':'Private Limited','4':'Public Limited',
      '5':'LLP','6':'Government','7':'Trust','8':'AOP','9':'Local Authority'
    };

    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      return res.status(400).json({ success: false, msg: 'Invalid GSTIN format' });
    }

    const result = {
      state_code: gstin.substring(0, 2),
      state: STATE_CODES[gstin.substring(0, 2)] || 'Unknown',
      pan: gstin.substring(2, 12),
      entity_type: BUSINESS_TYPES[gstin.charAt(12)] || 'Unknown'
    };

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('GST lookup error:', err);
    res.status(500).json({ success: false, msg: 'GST lookup failed' });
  }
});

module.exports = router;
