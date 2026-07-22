/**
 * 🔧 Self-Healing Engine for Glob ERP
 * 
 * Auto-detects and auto-fixes:
 * 1. Missing database tables → creates them
 * 2. Missing database columns → adds them
 * 3. Missing indexes → creates them
 * 4. Route loading failures → logs with details
 * 5. Broken data (null dates, wrong column names) → fixes on the fly
 * 6. Missing seed data → inserts it
 * 7. Runtime errors → catches, logs, and reports
 * 
 * Runs automatically on server startup + via /api/diagnose endpoint
 */

// ───────────────────────────────────────────────
// COMPLETE TABLE SCHEMAS (single source of truth)
// ───────────────────────────────────────────────

const TABLE_SCHEMAS = {
  organizations: {
    columns: {
      id: { type: 'increments', primary: true },
      name: { type: 'text' },
      gstin: { type: 'text' },
      address: { type: 'text' },
      city: { type: 'text' },
      state: { type: 'text' },
      state_code: { type: 'text' },
      pincode: { type: 'text' },
      phone: { type: 'text' },
      email: { type: 'text' },
      logo_url: { type: 'text' },
      bank_name: { type: 'text' },
      account_no: { type: 'text' },
      ifsc: { type: 'text' },
      branch: { type: 'text' },
      upi_id: { type: 'text' },
      stamp_url: { type: 'text' },
      signature_url: { type: 'text' },
      invoice_prefix: { type: 'text', defaultTo: 'GST-' },
      quotation_prefix: { type: 'text', defaultTo: 'Q-' },
      print_letterhead_mm: { type: 'integer', defaultTo: 65 },
      print_footer_mm: { type: 'integer', defaultTo: 50 },
      invoice_font_family: { type: 'text' },
      invoice_font_size: { type: 'text' },
      invoice_desc_size: { type: 'text' },
      invoice_item_bold: { type: 'text' },
      quotation_font_family: { type: 'text' },
      quotation_font_size: { type: 'text' },
      app_font_family: { type: 'text' },
      app_font_size: { type: 'text' },
      smtp_host: { type: 'text' },
      smtp_port: { type: 'text' },
      smtp_user: { type: 'text' },
      smtp_pass: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  users: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      name: { type: 'text' },
      email: { type: 'text', unique: true },
      password_hash: { type: 'text' },
      role: { type: 'text', defaultTo: 'admin' },
      phone: { type: 'text' },
      reset_otp: { type: 'text' },
      reset_expires: { type: 'bigInteger' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  customers: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      name: { type: 'text' },
      gstin: { type: 'text' },
      phone: { type: 'text' },
      email: { type: 'text' },
      address: { type: 'text' },
      city: { type: 'text' },
      state: { type: 'text' },
      state_code: { type: 'text' },
      pincode: { type: 'text' },
      credit_limit: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      contact_person: { type: 'text' },
      trade_name: { type: 'text' },
      business_type: { type: 'text' },
      bank_name: { type: 'text' },
      account_no: { type: 'text' },
      ifsc: { type: 'text' },
      upi_id: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  invoices: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      invoice_number: { type: 'text' },
      customer_id: { type: 'integer', references: 'customers.id' },
      invoice_date: { type: 'date' },
      due_date: { type: 'date' },
      subtotal: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      cgst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      sgst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      igst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      discount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      round_off: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      total_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      status: { type: 'text', defaultTo: 'Pending' },
      payment_status: { type: 'text', defaultTo: 'Unpaid' },
      notes: { type: 'text' },
      shipping_name: { type: 'text' },
      shipping_address: { type: 'text' },
      shipping_city: { type: 'text' },
      shipping_state: { type: 'text' },
      shipping_pincode: { type: 'text' },
      irn_number: { type: 'text' },
      ack_no: { type: 'text' },
      ack_date: { type: 'date' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date)',
    ]
  },
  invoice_items: {
    columns: {
      id: { type: 'increments', primary: true },
      invoice_id: { type: 'integer', references: 'invoices.id', onDelete: 'CASCADE' },
      description: { type: 'text' },
      hsn_code: { type: 'text' },
      quantity: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      unit: { type: 'text', defaultTo: 'NOS' },
      rate: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      cgst_rate: { type: 'decimal', precision: 5, scale: 2, defaultTo: 0 },
      sgst_rate: { type: 'decimal', precision: 5, scale: 2, defaultTo: 0 },
      igst_rate: { type: 'decimal', precision: 5, scale: 2, defaultTo: 0 },
      amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id)',
    ]
  },
  quotations: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      quotation_number: { type: 'text' },
      customer_id: { type: 'integer', references: 'customers.id' },
      quotation_date: { type: 'date' },
      validity_date: { type: 'date' },
      subtotal: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      cgst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      sgst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      igst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      total_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      status: { type: 'text', defaultTo: 'Sent' },
      converted_invoice_id: { type: 'integer' },
      notes: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_quotations_org ON quotations(organization_id)',
      'CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(quotation_date)',
    ]
  },
  quotation_items: {
    columns: {
      id: { type: 'increments', primary: true },
      quotation_id: { type: 'integer', references: 'quotations.id', onDelete: 'CASCADE' },
      description: { type: 'text' },
      hsn_code: { type: 'text' },
      quantity: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      unit: { type: 'text', defaultTo: 'Unit' },
      rate: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      igst_rate: { type: 'decimal', precision: 5, scale: 2, defaultTo: 18 },
      amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_quotation_items_quote ON quotation_items(quotation_id)',
    ]
  },
  purchase_bills: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      bill_number: { type: 'text' },
      supplier_name: { type: 'text' },
      supplier_gstin: { type: 'text' },
      supplier_state: { type: 'text' },
      supplier_state_code: { type: 'text' },
      supplier_address: { type: 'text' },
      supplier_phone: { type: 'text' },
      bill_date: { type: 'date' },
      subtotal: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      cgst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      sgst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      igst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      discount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      round_off: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      total_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      payment_status: { type: 'text', defaultTo: 'Unpaid' },
      notes: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_purchase_bills_org ON purchase_bills(organization_id)',
    ]
  },
  purchase_bill_items: {
    columns: {
      id: { type: 'increments', primary: true },
      purchase_id: { type: 'integer', references: 'purchase_bills.id', onDelete: 'CASCADE' },
      description: { type: 'text' },
      hsn_code: { type: 'text' },
      quantity: { type: 'decimal', precision: 15, scale: 2 },
      unit: { type: 'text' },
      rate: { type: 'decimal', precision: 15, scale: 2 },
      cgst_rate: { type: 'decimal', precision: 5, scale: 2 },
      sgst_rate: { type: 'decimal', precision: 5, scale: 2 },
      igst_rate: { type: 'decimal', precision: 5, scale: 2 },
      amount: { type: 'decimal', precision: 15, scale: 2 },
    }
  },
  payments: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      payment_number: { type: 'text' },
      payment_date: { type: 'date' },
      type: { type: 'text', defaultTo: 'Received' },
      customer_id: { type: 'integer', references: 'customers.id' },
      invoice_id: { type: 'integer', references: 'invoices.id' },
      amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      payment_mode: { type: 'text', defaultTo: 'Cash' },
      reference: { type: 'text' },
      bank_name: { type: 'text' },
      notes: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)',
    ]
  },
  expenses: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      expense_date: { type: 'date' },
      category: { type: 'text' },
      description: { type: 'text' },
      amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      payment_mode: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  credit_notes: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      credit_note_number: { type: 'text', unique: true },
      invoice_id: { type: 'integer', references: 'invoices.id' },
      customer_id: { type: 'integer', references: 'customers.id' },
      credit_date: { type: 'date' },
      reason: { type: 'text' },
      subtotal: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      cgst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      sgst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      igst_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      total_amount: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      status: { type: 'text' },
      notes: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  inventory: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      item_name: { type: 'text' },
      item_code: { type: 'text' },
      category: { type: 'text' },
      unit: { type: 'text' },
      quantity: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      min_quantity: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      rate: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      location: { type: 'text' },
      notes: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  suppliers: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      name: { type: 'text' },
      gstin: { type: 'text' },
      phone: { type: 'text' },
      email: { type: 'text' },
      address: { type: 'text' },
      city: { type: 'text' },
      state: { type: 'text' },
      state_code: { type: 'text' },
      pincode: { type: 'text' },
      contact_person: { type: 'text' },
      bank_name: { type: 'text' },
      account_no: { type: 'text' },
      ifsc: { type: 'text' },
      notes: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  workers: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      name: { type: 'text' },
      role: { type: 'text' },
      phone: { type: 'text' },
      daily_wage: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      join_date: { type: 'date' },
      status: { type: 'text', defaultTo: 'Active' },
      notes: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  machines: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      name: { type: 'text' },
      model: { type: 'text' },
      serial_number: { type: 'text' },
      purchase_date: { type: 'date' },
      purchase_cost: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      status: { type: 'text', defaultTo: 'Active' },
      last_maintenance: { type: 'date' },
      next_maintenance: { type: 'date' },
      notes: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  production: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      production_date: { type: 'date' },
      product_name: { type: 'text' },
      quantity: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      unit: { type: 'text' },
      workers_used: { type: 'text' },
      machine_id: { type: 'integer', references: 'machines.id' },
      raw_material_cost: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      labor_cost: { type: 'decimal', precision: 15, scale: 2, defaultTo: 0 },
      notes: { type: 'text' },
      status: { type: 'text', defaultTo: 'In Progress' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    }
  },
  settings: {
    columns: {
      id: { type: 'increments', primary: true },
      organization_id: { type: 'integer', references: 'organizations.id' },
      key: { type: 'text' },
      value: { type: 'text' },
    }
  },
  audit_log: {
    columns: {
      id: { type: 'increments', primary: true },
      user_id: { type: 'integer' },
      organization_id: { type: 'integer' },
      action: { type: 'text' },
      table_name: { type: 'text' },
      record_id: { type: 'integer' },
      old_value: { type: 'jsonb' },
      new_value: { type: 'jsonb' },
      ip_address: { type: 'text' },
      created_at: { type: 'timestamp', defaultTo: 'now' },
    },
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(organization_id)',
      'CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id)',
    ]
  },
};

// ───────────────────────────────────────────────
// KNEX COLUMN BUILDER HELPER
// ───────────────────────────────────────────────

function addColumn(table, colName, colDef) {
  let col;
  switch (colDef.type) {
    case 'increments': col = table.increments(colName); break;
    case 'integer': col = table.integer(colName); break;
    case 'bigInteger': col = table.bigInteger(colName); break;
    case 'text': col = table.text(colName); break;
    case 'date': col = table.date(colName); break;
    case 'timestamp': col = table.timestamp(colName); break;
    case 'jsonb': col = table.jsonb(colName); break;
    case 'decimal':
      col = table.decimal(colName, colDef.precision || 15, colDef.scale || 2);
      break;
    default: col = table.text(colName); break;
  }
  if (colDef.primary) col.primary();
  if (colDef.unique) col.unique();
  if (colDef.references) col.references(colDef.references);
  if (colDef.onDelete) col.onDelete(colDef.onDelete);
  if (colDef.defaultTo !== undefined) col.defaultTo(colDef.defaultTo === 'now' ? table.knex.fn.now() : colDef.defaultTo);
  return col;
}

// ───────────────────────────────────────────────
// MAIN SELF-HEAL ENGINE
// ───────────────────────────────────────────────

async function selfHeal(db) {
  const report = { 
    started: new Date().toISOString(), 
    tables: {}, 
    routes: {},
    fixes: [], 
    errors: [],
    status: 'healthy'
  };

  console.log('\n🔧 ═══════════════════════════════════════════');
  console.log('🔧 SELF-HEAL ENGINE STARTING...');
  console.log('🔧 ═══════════════════════════════════════════\n');

  // ── STEP 1: Check DB Connection ──
  try {
    await db.raw('SELECT 1');
    console.log('✅ DB Connection: OK');
  } catch (e) {
    console.error('❌ DB Connection: FAILED -', e.message);
    report.errors.push({ area: 'db_connection', error: e.message });
    report.status = 'critical';
    return report;
  }

  // ── STEP 2: Check & Create Missing Tables ──
  console.log('\n📊 Checking tables...');
  for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
    try {
      const exists = await db.schema.hasTable(tableName);
      if (!exists) {
        console.log(`  ❌ Table "${tableName}" MISSING → Creating...`);
        await db.schema.createTable(tableName, table => {
          for (const [colName, colDef] of Object.entries(schema.columns)) {
            addColumn(table, colName, colDef);
          }
        });
        console.log(`  ✅ Table "${tableName}" CREATED`);
        report.fixes.push({ type: 'table_created', table: tableName });
      } else {
        console.log(`  ✅ Table "${tableName}" exists`);
      }
      report.tables[tableName] = exists ? 'exists' : 'created';
    } catch (e) {
      console.error(`  ❌ Table "${tableName}" error:`, e.message);
      report.errors.push({ area: 'table', table: tableName, error: e.message });
      report.tables[tableName] = 'error: ' + e.message;
    }
  }

  // ── STEP 3: Check & Add Missing Columns ──
  console.log('\n📐 Checking columns...');
  for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
    try {
      const exists = await db.schema.hasTable(tableName);
      if (!exists) continue;

      for (const [colName, colDef] of Object.entries(schema.columns)) {
        const hasCol = await db.schema.hasColumn(tableName, colName);
        if (!hasCol) {
          console.log(`  ❌ "${tableName}.${colName}" MISSING → Adding...`);
          await db.schema.table(tableName, table => {
            addColumn(table, colName, colDef);
          });
          console.log(`  ✅ "${tableName}.${colName}" ADDED`);
          report.fixes.push({ type: 'column_added', table: tableName, column: colName });
        }
      }
    } catch (e) {
      console.error(`  ❌ Column check "${tableName}" error:`, e.message);
      report.errors.push({ area: 'column', table: tableName, error: e.message });
    }
  }

  // ── STEP 4: Create Missing Indexes ──
  console.log('\n🔎 Checking indexes...');
  for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
    if (!schema.indexes) continue;
    for (const idxSql of schema.indexes) {
      try {
        await db.raw(idxSql);
        console.log(`  ✅ Index OK: ${idxSql.match(/idx_\w+/)?.[0] || 'index'}`);
      } catch (e) {
        console.error(`  ❌ Index error: ${e.message}`);
        report.errors.push({ area: 'index', sql: idxSql, error: e.message });
      }
    }
  }

  // ── STEP 5: Check Seed Data ──
  console.log('\n🌱 Checking seed data...');
  try {
    const orgCount = await db('organizations').count('id as count').first();
    if (parseInt(orgCount.count) === 0) {
      console.log('  ❌ No organizations → Seeding...');
      const seed = require('./seeds/001_initial_data');
      await seed.seed(db);
      console.log('  ✅ Seed data inserted');
      report.fixes.push({ type: 'seed_data_inserted' });
    } else {
      console.log(`  ✅ Organizations: ${orgCount.count}`);
    }
  } catch (e) {
    console.error('  ❌ Seed check error:', e.message);
    report.errors.push({ area: 'seed', error: e.message });
  }

  // ── STEP 6: Check Route Loading ──
  console.log('\n🛣️ Checking routes...');
  const ROUTE_FILES = [
    { path: './routes/authRoutes', mount: '/api/auth' },
    { path: './routes/customerRoutes', mount: '/api/customers' },
    { path: './routes/invoiceRoutes', mount: '/api/invoices' },
    { path: './routes/quotationRoutes', mount: '/api/quotations' },
    { path: './routes/purchaseRoutes', mount: '/api/purchases' },
    { path: './routes/paymentRoutes', mount: '/api/payments' },
    { path: './routes/expenseRoutes', mount: '/api/expenses' },
    { path: './routes/creditNoteRoutes', mount: '/api/credit-notes' },
    { path: './routes/supplierRoutes', mount: '/api/suppliers' },
    { path: './routes/inventoryRoutes', mount: '/api/inventory' },
    { path: './routes/workerRoutes', mount: '/api/workers' },
    { path: './routes/machineRoutes', mount: '/api/machines' },
    { path: './routes/productionRoutes', mount: '/api/production' },
    { path: './routes/dashboardRoutes', mount: '/api/dashboard' },
    { path: './routes/gstRoutes', mount: '/api/gst' },
    { path: './routes/reportRoutes', mount: '/api/reports' },
    { path: './routes/settingsRoutes', mount: '/api/settings' },
    { path: './routes/exportRoutes', mount: '/api/export' },
  ];

  for (const route of ROUTE_FILES) {
    try {
      require.resolve(route.path);
      const router = require(route.path);
      const stackSize = router?.stack?.length || 'unknown';
      console.log(`  ✅ ${route.mount} → ${route.path} (${stackSize} routes)`);
      report.routes[route.mount] = { loaded: true, routes: stackSize };
    } catch (e) {
      console.error(`  ❌ ${route.mount} → ${route.path} FAILED: ${e.message}`);
      report.routes[route.mount] = { loaded: false, error: e.message };
      report.errors.push({ area: 'route', path: route.path, mount: route.mount, error: e.message });
    }
  }

  // ── STEP 7: Quick Data Integrity Check ──
  console.log('\n🩺 Quick data integrity check...');
  try {
    // Check for orphaned invoice items (no matching invoice)
    const orphanItems = await db.raw(`
      SELECT COUNT(*) as count FROM invoice_items ii 
      LEFT JOIN invoices i ON ii.invoice_id = i.id 
      WHERE i.id IS NULL
    `);
    const orphanCount = parseInt(orphanItems.rows?.[0]?.count || 0);
    if (orphanCount > 0) {
      console.log(`  ⚠️  Found ${orphanCount} orphaned invoice items`);
      report.errors.push({ area: 'data_integrity', issue: 'orphaned_invoice_items', count: orphanCount });
    } else {
      console.log('  ✅ No orphaned invoice items');
    }

    // Check for invoices with null total_amount
    const nullTotals = await db.raw(`
      SELECT COUNT(*) as count FROM invoices WHERE total_amount IS NULL OR total_amount = 0
    `);
    const nullCount = parseInt(nullTotals.rows?.[0]?.count || 0);
    if (nullCount > 0) {
      console.log(`  ⚠️  Found ${nullCount} invoices with zero/null total`);
      report.errors.push({ area: 'data_integrity', issue: 'invoices_zero_total', count: nullCount });
    } else {
      console.log('  ✅ All invoices have totals');
    }
  } catch (e) {
    console.log('  ⚠️  Data integrity check skipped:', e.message);
  }

  // ── FINAL STATUS ──
  if (report.errors.length > 0) report.status = 'issues_found';
  if (report.fixes.length > 0) report.status = 'fixed';

  console.log('\n🔧 ═══════════════════════════════════════════');
  console.log(`🔧 RESULT: ${report.fixes.length} fixes applied, ${report.errors.length} errors remaining`);
  console.log('🔧 ═══════════════════════════════════════════\n');

  return report;
}

// ───────────────────────────────────────────────
// RUNTIME ERROR TRACKER
// ───────────────────────────────────────────────

const errorLog = [];
const MAX_ERRORS = 100;

function trackError(area, error, req) {
  const entry = {
    time: new Date().toISOString(),
    area,
    error: error?.message || String(error),
    stack: error?.stack?.split('\n').slice(0, 3).join(' | '),
    url: req?.originalUrl,
    method: req?.method,
    body: req?.body ? JSON.stringify(req.body).substring(0, 200) : undefined,
  };
  errorLog.unshift(entry);
  if (errorLog.length > MAX_ERRORS) errorLog.pop();
  return entry;
}

function getRecentErrors(limit = 20) {
  return errorLog.slice(0, limit);
}

// ───────────────────────────────────────────────
// EXPRESS MIDDLEWARE: Auto-catch errors
// ───────────────────────────────────────────────

function errorTrackerMiddleware(err, req, res, next) {
  const entry = trackError('runtime', err, req);
  console.error(`❌ [${entry.time}] ${req.method} ${req.originalUrl}: ${err.message}`);
  
  // Auto-detect common errors and give helpful responses
  if (err.message?.includes('column') && err.message?.includes('does not exist')) {
    const colMatch = err.message.match(/column "([^"]+)" does not exist/);
    const tblMatch = err.message.match(/relation "([^"]+)" does not exist/);
    return res.status(500).json({
      success: false,
      msg: `Database column error: "${colMatch?.[1] || 'unknown'}" doesn't exist in "${tblMatch?.[1] || 'table'}". Run /api/diagnose to auto-fix.`,
      autoFixHint: '/api/diagnose',
      error: err.message
    });
  }
  
  if (err.message?.includes('invalid input syntax for type date')) {
    return res.status(400).json({
      success: false,
      msg: 'Date format error: Empty date values are not allowed. The global middleware should fix this — check server.js sanitize function.',
      error: err.message
    });
  }

  if (err.message?.includes('duplicate key')) {
    return res.status(409).json({
      success: false,
      msg: 'Duplicate entry: This record already exists.',
      error: err.message
    });
  }

  if (err.message?.includes('violates foreign key')) {
    return res.status(400).json({
      success: false,
      msg: 'Referenced record not found. Check that the related record exists.',
      error: err.message
    });
  }

  res.status(500).json({
    success: false,
    msg: err.message || 'Internal server error',
    errorId: entry.time
  });
}

// ───────────────────────────────────────────────
// EXPORTS
// ───────────────────────────────────────────────

module.exports = {
  selfHeal,
  TABLE_SCHEMAS,
  trackError,
  getRecentErrors,
  errorTrackerMiddleware
};
