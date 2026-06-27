exports.up = async function(knex) {
  // Organizations
  await knex.schema.createTable('organizations', table => {
    table.increments('id').primary();
    table.text('name');
    table.text('gstin');
    table.text('address');
    table.text('city');
    table.text('state');
    table.text('state_code');
    table.text('pincode');
    table.text('phone');
    table.text('email');
    table.text('logo_url');
    table.text('bank_name');
    table.text('account_no');
    table.text('ifsc');
    table.text('upi_id');
    table.text('invoice_prefix').defaultTo('GST-');
    table.text('quotation_prefix').defaultTo('Q-');
    table.integer('print_letterhead_mm').defaultTo(65);
    table.integer('print_footer_mm').defaultTo(50);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Users
  await knex.schema.createTable('users', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('name');
    table.text('email').unique();
    table.text('password_hash');
    table.text('role').defaultTo('admin');
    table.text('phone');
    table.text('reset_otp');
    table.bigInteger('reset_expires');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Customers
  await knex.schema.createTable('customers', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('name');
    table.text('gstin');
    table.text('phone');
    table.text('email');
    table.text('address');
    table.text('city');
    table.text('state');
    table.text('state_code');
    table.text('pincode');
    table.decimal('credit_limit', 15, 2).defaultTo(0);
    table.text('contact_person');
    table.text('trade_name');
    table.text('business_type');
    table.text('bank_name');
    table.text('account_no');
    table.text('ifsc');
    table.text('upi_id');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Invoices
  await knex.schema.createTable('invoices', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('invoice_number');
    table.integer('customer_id').references('id').inTable('customers');
    table.date('invoice_date');
    table.date('due_date');
    table.decimal('subtotal', 15, 2).defaultTo(0);
    table.decimal('cgst_amount', 15, 2).defaultTo(0);
    table.decimal('sgst_amount', 15, 2).defaultTo(0);
    table.decimal('igst_amount', 15, 2).defaultTo(0);
    table.decimal('discount', 15, 2).defaultTo(0);
    table.decimal('round_off', 15, 2).defaultTo(0);
    table.decimal('total_amount', 15, 2).defaultTo(0);
    table.text('status').defaultTo('Pending');
    table.text('payment_status').defaultTo('Unpaid');
    table.text('notes');
    table.text('irn_number');
    table.text('ack_no');
    table.date('ack_date');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['organization_id', 'invoice_number']);
  });

  // Invoice Items
  await knex.schema.createTable('invoice_items', table => {
    table.increments('id').primary();
    table.integer('invoice_id').references('id').inTable('invoices').onDelete('CASCADE');
    table.text('description');
    table.text('hsn_code');
    table.decimal('quantity', 15, 2).defaultTo(0);
    table.text('unit').defaultTo('NOS');
    table.decimal('rate', 15, 2).defaultTo(0);
    table.decimal('cgst_rate', 5, 2).defaultTo(0);
    table.decimal('sgst_rate', 5, 2).defaultTo(0);
    table.decimal('igst_rate', 5, 2).defaultTo(0);
    table.decimal('amount', 15, 2).defaultTo(0);
  });

  // Quotations
  await knex.schema.createTable('quotations', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('quotation_number');
    table.integer('customer_id').references('id').inTable('customers');
    table.date('quotation_date');
    table.date('validity_date');
    table.decimal('subtotal', 15, 2).defaultTo(0);
    table.decimal('cgst_amount', 15, 2).defaultTo(0);
    table.decimal('sgst_amount', 15, 2).defaultTo(0);
    table.decimal('igst_amount', 15, 2).defaultTo(0);
    table.decimal('total_amount', 15, 2).defaultTo(0);
    table.text('status').defaultTo('Sent');
    table.integer('converted_invoice_id');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Quotation Items
  await knex.schema.createTable('quotation_items', table => {
    table.increments('id').primary();
    table.integer('quotation_id').references('id').inTable('quotations').onDelete('CASCADE');
    table.text('description');
    table.text('hsn_code');
    table.decimal('quantity', 15, 2).defaultTo(0);
    table.text('unit').defaultTo('Unit');
    table.decimal('rate', 15, 2).defaultTo(0);
    table.decimal('igst_rate', 5, 2).defaultTo(18);
    table.decimal('amount', 15, 2).defaultTo(0);
  });

  // Purchase Bills
  await knex.schema.createTable('purchase_bills', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('bill_number');
    table.text('supplier_name');
    table.text('supplier_gstin');
    table.text('supplier_state');
    table.text('supplier_state_code');
    table.text('supplier_address');
    table.text('supplier_phone');
    table.date('bill_date');
    table.decimal('subtotal', 15, 2).defaultTo(0);
    table.decimal('cgst_amount', 15, 2).defaultTo(0);
    table.decimal('sgst_amount', 15, 2).defaultTo(0);
    table.decimal('igst_amount', 15, 2).defaultTo(0);
    table.decimal('discount', 15, 2).defaultTo(0);
    table.decimal('round_off', 15, 2).defaultTo(0);
    table.decimal('total_amount', 15, 2).defaultTo(0);
    table.text('payment_status').defaultTo('Unpaid');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['organization_id', 'bill_number']);
  });

  // Purchase Bill Items
  await knex.schema.createTable('purchase_bill_items', table => {
    table.increments('id').primary();
    table.integer('purchase_id').references('id').inTable('purchase_bills').onDelete('CASCADE');
    table.text('description');
    table.text('hsn_code');
    table.decimal('quantity', 15, 2);
    table.text('unit');
    table.decimal('rate', 15, 2);
    table.decimal('cgst_rate', 5, 2);
    table.decimal('sgst_rate', 5, 2);
    table.decimal('igst_rate', 5, 2);
    table.decimal('amount', 15, 2);
  });

  // Payments
  await knex.schema.createTable('payments', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('payment_number');
    table.date('payment_date');
    table.text('type').defaultTo('Received');
    table.integer('customer_id').references('id').inTable('customers');
    table.integer('invoice_id').references('id').inTable('invoices');
    table.decimal('amount', 15, 2).defaultTo(0);
    table.text('payment_mode').defaultTo('Cash');
    table.text('reference');
    table.text('bank_name');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Expenses
  await knex.schema.createTable('expenses', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.date('expense_date');
    table.text('category');
    table.text('description');
    table.decimal('amount', 15, 2).defaultTo(0);
    table.text('payment_mode');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Credit Notes
  await knex.schema.createTable('credit_notes', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('credit_note_number').unique();
    table.integer('invoice_id').references('id').inTable('invoices');
    table.integer('customer_id').references('id').inTable('customers');
    table.date('credit_date');
    table.text('reason');
    table.decimal('subtotal', 15, 2).defaultTo(0);
    table.decimal('cgst_amount', 15, 2).defaultTo(0);
    table.decimal('sgst_amount', 15, 2).defaultTo(0);
    table.decimal('igst_amount', 15, 2).defaultTo(0);
    table.decimal('total_amount', 15, 2).defaultTo(0);
    table.text('status');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Inventory
  await knex.schema.createTable('inventory', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('item_name');
    table.text('item_code');
    table.text('category');
    table.text('unit');
    table.decimal('quantity', 15, 2).defaultTo(0);
    table.decimal('min_quantity', 15, 2).defaultTo(0);
    table.decimal('rate', 15, 2).defaultTo(0);
    table.text('location');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Suppliers
  await knex.schema.createTable('suppliers', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('name');
    table.text('gstin');
    table.text('phone');
    table.text('email');
    table.text('address');
    table.text('city');
    table.text('state');
    table.text('state_code');
    table.text('pincode');
    table.text('contact_person');
    table.text('bank_name');
    table.text('account_no');
    table.text('ifsc');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Workers
  await knex.schema.createTable('workers', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('name');
    table.text('role');
    table.text('phone');
    table.decimal('daily_wage', 15, 2).defaultTo(0);
    table.date('join_date');
    table.text('status').defaultTo('Active');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Machines
  await knex.schema.createTable('machines', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('name');
    table.text('model');
    table.text('serial_number');
    table.date('purchase_date');
    table.decimal('purchase_cost', 15, 2).defaultTo(0);
    table.text('status').defaultTo('Active');
    table.date('last_maintenance');
    table.date('next_maintenance');
    table.text('notes');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Production
  await knex.schema.createTable('production', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.date('production_date');
    table.text('product_name');
    table.decimal('quantity', 15, 2).defaultTo(0);
    table.text('unit');
    table.text('workers_used');
    table.integer('machine_id').references('id').inTable('machines');
    table.decimal('raw_material_cost', 15, 2).defaultTo(0);
    table.decimal('labor_cost', 15, 2).defaultTo(0);
    table.text('notes');
    table.text('status').defaultTo('In Progress');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Settings
  await knex.schema.createTable('settings', table => {
    table.increments('id').primary();
    table.integer('organization_id').references('id').inTable('organizations');
    table.text('key');
    table.text('value');
    table.unique(['organization_id', 'key']);
  });

  // Audit Log
  await knex.schema.createTable('audit_log', table => {
    table.increments('id').primary();
    table.integer('user_id');
    table.integer('organization_id');
    table.text('action');
    table.text('table_name');
    table.integer('record_id');
    table.jsonb('old_value');
    table.jsonb('new_value');
    table.text('ip_address');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Indexes
  await knex.raw('CREATE INDEX idx_invoices_org ON invoices(organization_id)');
  await knex.raw('CREATE INDEX idx_invoices_customer ON invoices(customer_id)');
  await knex.raw('CREATE INDEX idx_invoices_date ON invoices(invoice_date)');
  await knex.raw('CREATE INDEX idx_quotations_org ON quotations(organization_id)');
  await knex.raw('CREATE INDEX idx_quotations_date ON quotations(quotation_date)');
  await knex.raw('CREATE INDEX idx_payments_invoice ON payments(invoice_id)');
  await knex.raw('CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id)');
  await knex.raw('CREATE INDEX idx_quotation_items_quote ON quotation_items(quotation_id)');
  await knex.raw('CREATE INDEX idx_customers_org ON customers(organization_id)');
  await knex.raw('CREATE INDEX idx_audit_log_org ON audit_log(organization_id)');
  await knex.raw('CREATE INDEX idx_purchase_bills_org ON purchase_bills(organization_id)');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('audit_log');
  await knex.schema.dropTableIfExists('settings');
  await knex.schema.dropTableIfExists('production');
  await knex.schema.dropTableIfExists('machines');
  await knex.schema.dropTableIfExists('workers');
  await knex.schema.dropTableIfExists('suppliers');
  await knex.schema.dropTableIfExists('inventory');
  await knex.schema.dropTableIfExists('credit_notes');
  await knex.schema.dropTableIfExists('expenses');
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.dropTableIfExists('purchase_bill_items');
  await knex.schema.dropTableIfExists('purchase_bills');
  await knex.schema.dropTableIfExists('quotation_items');
  await knex.schema.dropTableIfExists('quotations');
  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('customers');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('organizations');
};
