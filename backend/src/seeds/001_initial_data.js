const bcrypt = require('bcryptjs');

const DEFAULT_QUOTATION_DESC = `MODEL NO - TATA SIGNA 4425.T
DESIGN, MANUFACTURE & FABRICATION OF TOP-LOADING SS304CR TANK USING JINDAL-CERTIFIED MATERIAL WITH TC REPORT. TANKER CAPACITY: 37KL DIVIDED INTO 6 COMPARTMENTS
CONSTRUCTED WITH:
• SHELL: 3.5 MM THICK
• DISH END: 3.5 MM THICK
• 76 OD SS304 DELIVERY PIPELINE
• 6 VALVE SS304 TOP FITTINGS
• LADDER, CATWALK, REAR MUDGUARD
• GI SHEET FITTING, SS304 WALL BOX FITTING
• DEEP ROD CARRIER, FIRE EXTINGUISHER HOLDER
• MODIFIED EXHAUST LINE WITH SPARK ARRESTOR
• MANHOLES ALL BOLT WELDED WITH P.V. VALVES, AIR VENTS, AND EMERGENCY VALVES SS304 FITTING
• REAR BOTTOM LEVER ARRANGEMENT WITH FUSIBLE LINK MS FITTING
• SIDE PLATFORM WITH SS304 RAILING & SS304 PIPE RAILING FITTING
• D-BOX DOME COVER BOX IN SS304 FITTING
• MOUNTING OF SS304 TANK ON CHASSIS FULL PAINTING
ADDITIONAL INCLUSIONS:
• EXPLOSIVE LICENSE (9NO) WE PROVIDE PAPER READY ONLY FOR 3 YEARS
• FORM 22 & 17`;

exports.seed = async function(knex) {
  // Check if already seeded
  const orgCount = await knex('organizations').count('id as count').first();
  if (orgCount.count > 0) return;

  // Create organization
  const [org] = await knex('organizations').insert({
    name: 'Glob Fabrication and Enterprises',
    gstin: '27AWAPK1209R1ZC',
    address: 'Plot No. 45, MIDC Industrial Area',
    city: 'Pune',
    state: 'Maharashtra',
    state_code: '27',
    pincode: '411026',
    phone: '9876543210',
    email: 'info@globfabrication.com',
    bank_name: 'State Bank of India',
    account_no: '3456789012345',
    ifsc: 'SBIN0001234',
    upi_id: 'glob@sbi',
    invoice_prefix: 'GST-',
    quotation_prefix: 'Q-',
    print_letterhead_mm: 65,
    print_footer_mm: 50
  }).returning('id');

  const orgId = org.id || org;

  // Create admin user
  const hash = await bcrypt.hash('admin123', 12);
  await knex('users').insert({
    organization_id: orgId,
    name: 'Admin',
    email: 'admin@globfabrication.com',
    password_hash: hash,
    role: 'admin',
    phone: '9876543210'
  });

  // Sample customers
  await knex('customers').insert([
    {
      organization_id: orgId,
      name: 'Shree Ganesh Transport',
      gstin: '27AABCG1234A1Z5',
      phone: '9876543211',
      email: 'ganesh@transport.com',
      address: '123, Transport Nagar',
      city: 'Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400001',
      contact_person: 'Rajesh Kumar',
      trade_name: 'Shree Ganesh',
      business_type: 'Private Limited'
    },
    {
      organization_id: orgId,
      name: 'Patel Logistics Pvt Ltd',
      gstin: '24AABCP5678B1Z3',
      phone: '9876543212',
      email: 'patel@logistics.com',
      address: '456, GIDC Estate',
      city: 'Ahmedabad',
      state: 'Gujarat',
      state_code: '24',
      pincode: '380001',
      contact_person: 'Amit Patel',
      trade_name: 'Patel Logistics',
      business_type: 'Private Limited'
    },
    {
      organization_id: orgId,
      name: 'Mumbai Fuels Corporation',
      gstin: '27AABCM9012C1Z7',
      phone: '9876543213',
      email: 'mumbai@fuels.com',
      address: '789, Petrochemical Zone',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      state_code: '27',
      pincode: '400614',
      contact_person: 'Suresh Mehta',
      trade_name: 'Mumbai Fuels',
      business_type: 'Sole Proprietorship'
    }
  ]);

  // Default settings
  await knex('settings').insert([
    { organization_id: orgId, key: 'quotation_template', value: DEFAULT_QUOTATION_DESC },
    { organization_id: orgId, key: 'print_font_size', value: '9.5' },
    { organization_id: orgId, key: 'print_font_family', value: 'Georgia' },
    { organization_id: orgId, key: 'default_gst_rate', value: '18' }
  ]);
};
