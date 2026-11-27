// Split out of routes/aiAssistantRoutes.js — tools
const getDb = require('../config/db');
const fs = require('fs');
const path = require('path');
const { searchKnowledge } = require('../aiKnowledge');

// ═══════════════════════════════════════════════
// TOOL DEFINITIONS — For Gemini function calling
// ═══════════════════════════════════════════════

const TOOL_DEFINITIONS = [
  {
    name: "diagnose_system",
    description: "Run full system diagnostics — checks all database tables, columns, indexes, routes, seed data, and data integrity. Returns a detailed report with status of each component.",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "get_recent_errors",
    description: "Get list of recent runtime errors that occurred in the ERP system. Returns error details including time, area, error message, and request info.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "NUMBER", description: "Maximum number of errors to return (default 20)" }
      }
    }
  },
  {
    name: "run_sql",
    description: "Execute a SQL query on the PostgreSQL database. SELECT queries are allowed freely. INSERT/UPDATE/DELETE need user confirmation. DROP/TRUNCATE/ALTER are blocked.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "SQL query to execute" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_table_structure",
    description: "Get the structure and column details of a database table.",
    parameters: {
      type: "OBJECT",
      properties: {
        table: { type: "STRING", description: "Table name to inspect" }
      },
      required: ["table"]
    }
  },
  {
    name: "list_table_data",
    description: "List data from a database table with optional limit and where clause.",
    parameters: {
      type: "OBJECT",
      properties: {
        table: { type: "STRING", description: "Table name" },
        limit: { type: "NUMBER", description: "Max rows to return (default 20)" },
        where: { type: "STRING", description: "SQL WHERE clause (without the WHERE keyword)" },
        columns: { type: "STRING", description: "Columns to select (default *)" }
      },
      required: ["table"]
    }
  },
  {
    name: "update_record",
    description: "Update a record in a database table by ID. Use with caution.",
    parameters: {
      type: "OBJECT",
      properties: {
        table: { type: "STRING", description: "Table name" },
        id: { type: "NUMBER", description: "Record ID to update" },
        data: { type: "OBJECT", description: "Object with field:value pairs to update" }
      },
      required: ["table", "id", "data"]
    }
  },
  {
    name: "fix_system",
    description: "Run the self-healing engine to auto-fix missing tables, columns, indexes, and seed data. This is safe and idempotent.",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "get_settings",
    description: "Get current organization settings including company details, bank info, and font settings.",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "update_settings",
    description: "Update organization settings. Provide the fields to update.",
    parameters: {
      type: "OBJECT",
      properties: {
        settings: { type: "OBJECT", description: "Settings key-value pairs to update" }
      }
    }
  },
  {
    name: "read_file",
    description: "Read a source code file from the server. Path is relative to the backend/src/ directory. Useful for reviewing and debugging code.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "File path relative to backend/src/ (e.g., 'routes/invoiceRoutes.js')" }
      },
      required: ["path"]
    }
  },
  {
    name: "write_file",
    description: "Write or update a source code file on the server. Changes take effect immediately but are lost on next deploy. For permanent changes, the user must update GitHub.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "File path relative to backend/src/" },
        content: { type: "STRING", description: "Full file content to write" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "list_files",
    description: "List files in a directory on the server. Path is relative to backend/src/.",
    parameters: {
      type: "OBJECT",
      properties: {
        path: { type: "STRING", description: "Directory path relative to backend/src/ (default: '.')" }
      }
    }
  },
  {
    name: "get_invoice_detail",
    description: "Get details of a specific invoice including items and totals.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: { type: "NUMBER", description: "Invoice ID" }
      },
      required: ["id"]
    }
  },
  {
    name: "get_quotation_detail",
    description: "Get details of a specific quotation including items.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: { type: "NUMBER", description: "Quotation ID" }
      },
      required: ["id"]
    }
  },
  {
    name: "count_records",
    description: "Count records in a table, optionally with a WHERE clause. Quick way to check data.",
    parameters: {
      type: "OBJECT",
      properties: {
        table: { type: "STRING", description: "Table name" },
        where: { type: "STRING", description: "SQL WHERE clause (without WHERE keyword)" }
      },
      required: ["table"]
    }
  },
  {
    name: "deploy_render",
    description: "Trigger a deploy on Render (backend hosting). Requires admin confirmation before executing.",
    parameters: {
      type: "OBJECT",
      properties: {
        confirm: { type: "BOOLEAN", description: "Set to true only after user explicitly confirms they want to deploy" }
      }
    }
  },
  {
    name: "github_status",
    description: "Check GitHub repository status — latest commits, branch info, and repo health.",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "vercel_status",
    description: "Check Vercel deployment status for the frontend. Shows latest build status and URL.",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "list_invoices",
    description: "List sales invoices with filters. Use for questions like 'invoices in October', 'unpaid invoices of Tata', 'biggest invoice this month'.",
    parameters: { type: "OBJECT", properties: {
      month: { type: "STRING", description: "Month as YYYY-MM (optional)" },
      payment_status: { type: "STRING", description: "Paid, Unpaid or Partial (optional)" },
      customer: { type: "STRING", description: "Customer name contains (optional)" },
      limit: { type: "NUMBER", description: "Max rows, default 25" } } }
  },
  {
    name: "list_quotations",
    description: "List quotations with filters by month or customer name.",
    parameters: { type: "OBJECT", properties: {
      month: { type: "STRING", description: "Month as YYYY-MM (optional)" },
      customer: { type: "STRING", description: "Customer name contains (optional)" },
      limit: { type: "NUMBER", description: "Max rows, default 25" } } }
  },
  {
    name: "list_purchases",
    description: "List purchase bills with filters by month, supplier or payment status.",
    parameters: { type: "OBJECT", properties: {
      month: { type: "STRING", description: "Month as YYYY-MM (optional)" },
      supplier: { type: "STRING", description: "Supplier name contains (optional)" },
      payment_status: { type: "STRING", description: "Paid, Unpaid or Partial (optional)" },
      limit: { type: "NUMBER", description: "Max rows, default 25" } } }
  },
  {
    name: "get_customer_detail",
    description: "Full picture of one customer: contact details, invoices, total business, outstanding amount. Pass a name or an id.",
    parameters: { type: "OBJECT", properties: { customer: { type: "STRING", description: "Customer name or numeric id" } }, required: ["customer"] }
  },
  {
    name: "get_monthly_trend",
    description: "Month-by-month sales and purchase totals (with GST) for the last N months. Use for trends, comparisons and growth questions.",
    parameters: { type: "OBJECT", properties: { months: { type: "NUMBER", description: "How many months back, default 6, max 24" } } }
  },
  {
    name: "list_vehicle_papers",
    description: "List saved Vehicle Papers (Margin Money, Form 22A, Form 17, Vahan) by type or vehicle number. Never returns file contents.",
    parameters: { type: "OBJECT", properties: {
      doc_type: { type: "STRING", description: "money_receipt, form_22a, form_17 or vahan (optional)" },
      vehicle_no: { type: "STRING", description: "Vehicle number contains (optional)" } } }
  },
  {
    name: "find_document",
    description: "Search invoices, quotations, purchase bills and customers at once by number or name. Use when the user gives a number like 'INV-101' or a name and you do not know the type.",
    parameters: { type: "OBJECT", properties: { query: { type: "STRING", description: "Number or name to find" } }, required: ["query"] }
  },
  // FIX #9: restart_server removed from AI tools — destructive ops need real server-side confirmation, not LLM-decided chat text
  {
    name: "get_env_vars",
    description: "List environment variable names (not values) configured on the server. Useful for checking which API keys are set.",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "get_server_info",
    description: "Get server information — Node.js version, uptime, memory usage, CPU info, and platform details.",
    parameters: { type: "OBJECT", properties: {} }
  },
  // ═══════════════════════════════════════════════════
  // BUSINESS TOOLS — answer real ERP questions from the database
  // ═══════════════════════════════════════════════════
  {
    name: "get_business_overview",
    description: "Get a one-shot business snapshot: revenue, paid/pending amounts, receivables, payables, GST output/input/net, customer count, and record counts across all modules. Best first call for questions like 'how is my business doing?'.",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "get_dashboard_stats",
    description: "Get full dashboard metrics: total/paid/pending revenue, overdue buckets (30/60/90 days), expenses, profit, quotation stats, purchase stats, low-stock items, recent invoices and top customers.",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "get_gst_summary",
    description: "Get GST summary for a financial year: output/input GST (CGST/SGST/IGST), net payable, monthly and quarterly breakdown with carry-forward. Use for 'how much GST do I owe?' questions.",
    parameters: {
      type: "OBJECT",
      properties: {
        year: { type: "NUMBER", description: "Financial year start year (e.g. 2026 for FY 2026-27). Default: current year." }
      }
    }
  },
  {
    name: "get_outstanding_invoices",
    description: "Get unpaid invoices and overdue amounts (who owes the business money). Includes ageing: current, 30/60/90+ days overdue, sorted by amount.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "NUMBER", description: "Max invoices to return (default 25)" }
      }
    }
  },
  {
    name: "get_outstanding_bills",
    description: "Get unpaid purchase bills (what the business owes suppliers). Sorted by amount descending.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "NUMBER", description: "Max bills to return (default 25)" }
      }
    }
  },
  {
    name: "get_top_customers",
    description: "Get top customers by total invoiced business, with GSTIN, city/state and totals. Use for 'who is my biggest customer?'.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "NUMBER", description: "Max customers (default 5)" }
      }
    }
  },
  {
    name: "search_customer",
    description: "Search customers by name, phone, or GSTIN. Returns matching customers with contact and business details.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "Search text — name, phone, or GSTIN fragment" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_inventory_status",
    description: "Get inventory items and low-stock alerts (items at or below minimum quantity). Use for 'am I low on stock?' questions.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "NUMBER", description: "Max items (default 25)" }
      }
    }
  },
  {
    name: "get_recent_payments",
    description: "Get recent payments received from customers, with mode, reference and linked invoice. Use for 'what payments came in?' questions.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "NUMBER", description: "Max payments (default 20)" }
      }
    }
  },
  {
    name: "get_expense_summary",
    description: "Get total expenses and recent expense entries by category. Use for 'what are my expenses?' questions.",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "NUMBER", description: "Max recent entries (default 20)" }
      }
    }
  },
  {
    name: "get_knowledge",
    description: "Search the company knowledge base (products, materials, GST rules, invoice/quotation formats, company profile). Use for domain questions like 'what products do you make?', 'what materials do you use?', 'how is GST calculated?', 'what are your HSN codes?'.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "The topic to look up (e.g. 'tanker specs', 'gst rules', 'materials', 'quotation format')" }
      },
      required: ["query"]
    }
  }
];

// Privacy boundary: do not let an LLM run arbitrary SQL, read/write source,
// deploy code or retrieve unrestricted records. Model output is NOT user consent.
const SAFE_AI_TOOL_NAMES = new Set([
  'get_business_overview', 'get_dashboard_stats', 'get_gst_summary',
  'get_outstanding_invoices', 'get_outstanding_bills', 'get_top_customers',
  'search_customer', 'get_inventory_status', 'get_recent_payments',
  'get_expense_summary', 'get_knowledge',
  'list_invoices', 'list_quotations', 'list_purchases', 'get_customer_detail',
  'get_monthly_trend', 'list_vehicle_papers', 'find_document'
]);
const SAFE_TOOL_DEFINITIONS = TOOL_DEFINITIONS.filter(t => SAFE_AI_TOOL_NAMES.has(t.name));

// ═══════════════════════════════════════════════
// TOOL EXECUTORS — Actual functions that run on the server
// ═══════════════════════════════════════════════

// "YYYY-MM" -> [firstDay, lastDay] as YYYY-MM-DD strings (or null)
function monthRange(m) {
  const mm = /^(\d{4})-(\d{2})$/.exec(String(m || '').trim());
  if (!mm) return null;
  const y = +mm[1], mo = +mm[2];
  if (mo < 1 || mo > 12) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return [`${mm[1]}-${mm[2]}-01`, `${mm[1]}-${mm[2]}-${String(last).padStart(2, '0')}`];
}

const BLOCKED_SQL = /\b(DROP\s+(TABLE|DATABASE|SCHEMA|INDEX)|TRUNCATE|ALTER\s+TABLE\s+\w+\s+DROP|GRANT|REVOKE)\b/i;
const DANGEROUS_SQL = /\b(DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/i;
const NO_WHERE = /\b(DELETE\s+FROM\s+\w+\s*;|UPDATE\s+\w+\s+SET\s+.*?;)/i;

async function executeTool(name, args, orgId) {
  if (!SAFE_AI_TOOL_NAMES.has(name)) return { error: 'This AI operation is disabled for privacy and safety.' };
  args = args && typeof args === 'object' ? args : {};
  const db = getDb();
  
  switch (name) {
    case 'diagnose_system': {
      const { selfHeal } = require('../selfHeal');
      const report = await selfHeal(db);
      return {
        status: report.status,
        tablesChecked: Object.keys(report.tables || {}).length,
        tablesExisting: Object.values(report.tables || {}).filter(v => v === 'exists').length,
        tablesCreated: Object.values(report.tables || {}).filter(v => v === 'created').length,
        routesLoaded: Object.values(report.routes || {}).filter(v => v.loaded).length,
        routesFailed: Object.values(report.routes || {}).filter(v => !v.loaded).length,
        fixesApplied: report.fixes?.length || 0,
        errorsRemaining: report.errors?.length || 0,
        fixes: report.fixes,
        errors: report.errors?.slice(0, 10),
        failedRoutes: Object.entries(report.routes || {}).filter(([, v]) => !v.loaded).map(([mount, v]) => ({ mount, error: v.error }))
      };
    }

    case 'get_recent_errors': {
      const { getRecentErrors } = require('../selfHeal');
      const limit = args.limit || 20;
      const errors = getRecentErrors(limit);
      return { count: errors.length, errors };
    }

    case 'run_sql': {
      const query = args.query.trim();
      if (BLOCKED_SQL.test(query)) {
        return { error: 'Blocked: Destructive SQL operations (DROP, TRUNCATE, ALTER DROP, GRANT, REVOKE) are not allowed for safety.' };
      }
      if (DANGEROUS_SQL.test(query) && !query.toLowerCase().includes('where')) {
        return { error: 'Blocked: DELETE/UPDATE without WHERE clause is not allowed. Add a WHERE clause to target specific records.' };
      }
      try {
        const result = await db.raw(query);
        const rows = result.rows || result;
        const limitedRows = Array.isArray(rows) ? rows.slice(0, 50) : rows;
        return { success: true, rowCount: Array.isArray(rows) ? rows.length : 1, rows: limitedRows };
      } catch (err) {
        return { error: `SQL Error: ${err.message}` };
      }
    }

    case 'get_table_structure': {
      try {
        const exists = await db.schema.hasTable(args.table);
        if (!exists) return { error: `Table "${args.table}" does not exist` };
        // Parameterized query — never interpolate the table name into SQL
        const cols = await db.raw(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_name = ?
           ORDER BY ordinal_position`,
          [args.table]
        );
        const count = await db(args.table).count('* as count').first();
        return { table: args.table, exists: true, columns: cols.rows, rowCount: parseInt(count.count) };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'list_table_data': {
      try {
        const { table, limit = 20, where, columns = '*' } = args;
        const exists = await db.schema.hasTable(table);
        if (!exists) return { error: `Table "${table}" does not exist` };
        let query = db(table).select(db.raw(columns)).limit(Math.min(limit, 100));
        if (where) query = query.whereRaw(where);
        // Filter by org_id for org-scoped tables
        const orgScoped = ['invoices','quotations','purchase_bills','customers','suppliers','expenses','payments','inventory','workers','machines','production','credit_notes'];
        if (orgScoped.includes(table) && orgId) query = query.where({ organization_id: orgId });
        const rows = await query;
        return { table, rowCount: rows.length, rows };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'update_record': {
      try {
        const { table, id, data } = args;
        const exists = await db.schema.hasTable(table);
        if (!exists) return { error: `Table "${table}" does not exist` };
        await db(table).where({ id }).update(data);
        const updated = await db(table).where({ id }).first();
        return { success: true, table, id, updated };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'fix_system': {
      const { selfHeal } = require('../selfHeal');
      const report = await selfHeal(db);
      return {
        status: report.status,
        fixesApplied: report.fixes?.length || 0,
        errorsRemaining: report.errors?.length || 0,
        fixes: report.fixes,
        errors: report.errors?.slice(0, 5)
      };
    }

    case 'get_settings': {
      try {
        const org = await db('organizations').where({ id: orgId }).first();
        const settings = await db('settings').where({ organization_id: orgId });
        const settingsMap = {};
        settings.forEach(s => { settingsMap[s.key] = s.value; });
        return { organization: org, settings: settingsMap };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'update_settings': {
      try {
        const { settings } = args;
        for (const [key, value] of Object.entries(settings)) {
          await db('settings').where({ organization_id: orgId, key }).del();
          await db('settings').insert({ organization_id: orgId, key, value });
        }
        return { success: true, updated: Object.keys(settings) };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'read_file': {
      try {
        const filePath = args.path;
        // Security: Only allow reading from backend/src/
        const fullPath = path.resolve(__dirname, filePath);
        if (!fullPath.startsWith(path.resolve(__dirname))) {
          return { error: 'Access denied: Can only read files within backend/src/' };
        }
        if (!fs.existsSync(fullPath)) {
          return { error: `File not found: ${filePath}` };
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        return { path: filePath, size: content.length, lines: content.split('\n').length, content: content.substring(0, 10000) };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'write_file': {
      try {
        const { path: filePath, content } = args;
        const fullPath = path.resolve(__dirname, filePath);
        if (!fullPath.startsWith(path.resolve(__dirname))) {
          return { error: 'Access denied: Can only write files within backend/src/' };
        }
        // Ensure directory exists
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf-8');
        return { success: true, path: filePath, size: content.length, note: 'Change takes effect immediately but will be lost on next deploy. Update GitHub for permanent changes.' };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'list_files': {
      try {
        const dirPath = args.path || '.';
        const fullPath = path.resolve(__dirname, dirPath);
        if (!fullPath.startsWith(path.resolve(__dirname))) {
          return { error: 'Access denied' };
        }
        if (!fs.existsSync(fullPath)) return { error: `Directory not found: ${dirPath}` };
        const items = fs.readdirSync(fullPath).map(name => {
          const itemPath = path.join(fullPath, name);
          const stat = fs.statSync(itemPath);
          return { name, type: stat.isDirectory() ? 'directory' : 'file', size: stat.size };
        });
        return { path: dirPath, items };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'get_invoice_detail': {
      try {
        const invoice = await db('invoices')
          .where({ 'invoices.id': args.id })
          .leftJoin('customers', 'invoices.customer_id', 'customers.id')
          .select('invoices.*', 'customers.name as customer_name')
          .first();
        if (!invoice) return { error: 'Invoice not found' };
        const items = await db('invoice_items').where({ invoice_id: args.id });
        return { invoice, items };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'get_quotation_detail': {
      try {
        const quotation = await db('quotations').where({ id: args.id }).first();
        if (!quotation) return { error: 'Quotation not found' };
        const items = await db('quotation_items').where({ quotation_id: args.id });
        const parts = (quotation.notes || '').split('|||');
        return { quotation: { ...quotation, customer_name: parts[0] || '', additional_info: parts[1] || '' }, items };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'count_records': {
      try {
        let query = db(args.table).count('* as count');
        if (args.where) query = query.whereRaw(args.where);
        const result = await query.first();
        return { table: args.table, count: parseInt(result.count) };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'deploy_render': {
      if (!args.confirm) {
        return { 
          needsConfirmation: true, 
          message: '⚠️ This will trigger a new deployment on Render. The current live backend will be replaced. Type "yes, deploy" to confirm.' 
        };
      }
      // Render doesn't have a deploy API on free tier, but we can provide instructions
      return { 
        success: true, 
        message: '🚀 To deploy on Render:\n1. Go to https://dashboard.render.com\n2. Find your web service\n3. Click "Manual Deploy" → "Deploy latest commit"\n\nOr push to GitHub and Render auto-deploys.\n\nNote: Render free tier auto-deploys on GitHub push.',
        autoDeployAvailable: false 
      };
    }

    case 'github_status': {
      try {
        const repoUrl = 'https://github.com/armaankhan45-cmd/glob-erp';
        // We can check the health endpoint to infer deployment status
        const healthCheck = await db.raw('SELECT 1 as ok');
        return { 
          repoUrl,
          status: 'accessible',
          branch: 'main',
          backendHealth: healthCheck.rows?.[0]?.ok ? 'healthy' : 'unknown',
          note: 'GitHub repo is private. To push code, use: git push origin main'
        };
      } catch (err) {
        return { error: err.message };
      }
    }

    case 'vercel_status': {
      return { 
        frontendUrl: 'https://glob-erp.vercel.app',
        autoDeploy: true,
        status: 'auto-deploys on push to GitHub main branch',
        dashboard: 'https://vercel.com/dashboard',
        note: 'Vercel automatically deploys when frontend code is pushed to GitHub'
      };
    }

    // FIX #9: restart_server case removed — no LLM-triggered process control

    case 'get_env_vars': {
      const vars = {
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        GROQ_API_KEY: !!process.env.GROQ_API_KEY,
        DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
        CEREBRAS_API_KEY: !!process.env.CEREBRAS_API_KEY,
        OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
        OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
        DATABASE_URL: !!process.env.DATABASE_URL,
        JWT_SECRET: !!process.env.JWT_SECRET,
        CORS_ORIGIN: process.env.CORS_ORIGIN || 'not set',
        PORT: process.env.PORT || 'not set (default 10000)',
        NODE_ENV: process.env.NODE_ENV || 'not set'
      };
      return { environmentVariables: vars, note: 'Values are hidden for security. Only shows whether keys are set or not.' };
    }

    case 'get_server_info': {
      const os = require('os');
      return {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: `${Math.floor(process.uptime() / 60)} minutes`,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsage: {
          rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
        },
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
        hostname: os.hostname(),
      };
    }

    // ═══════════════════════════════════════════════════
    // BUSINESS TOOL EXECUTORS — always org-scoped
    // ═══════════════════════════════════════════════════
    case 'get_business_overview': {
      try {
        const rev = await db('invoices').where({ organization_id: orgId }).sum('total_amount as t').first();
        const paid = await db('invoices').where({ organization_id: orgId, payment_status: 'Paid' }).sum('total_amount as t').first();
        const pending = await db('invoices').where({ organization_id: orgId }).whereIn('payment_status', ['Unpaid', 'Partial']).sum('total_amount as t').first();
        const outGST = await db('invoices').where({ organization_id: orgId }).sum('cgst_amount as c').sum('sgst_amount as s').sum('igst_amount as i').first();
        const inGST = await db('purchase_bills').where({ organization_id: orgId }).sum('cgst_amount as c').sum('sgst_amount as s').sum('igst_amount as i').first();
        const cust = await db('customers').where({ organization_id: orgId }).count('id as c').first();
        const inv = await db('invoices').where({ organization_id: orgId }).count('id as c').first();
        const quotes = await db('quotations').where({ organization_id: orgId }).count('id as c').first();
        const bills = await db('purchase_bills').where({ organization_id: orgId }).count('id as c').first();
        const pendingBills = await db('purchase_bills').where({ organization_id: orgId, payment_status: 'Unpaid' }).sum('total_amount as t').first();
        const exp = await db('expenses').where({ organization_id: orgId }).sum('amount as t').first();
        const o = { c: parseFloat(outGST.c || 0), s: parseFloat(outGST.s || 0), i: parseFloat(outGST.i || 0) };
        const inp = { c: parseFloat(inGST.c || 0), s: parseFloat(inGST.s || 0), i: parseFloat(inGST.i || 0) };
        return {
          revenue: parseFloat(rev.t || 0),
          paid: parseFloat(paid.t || 0),
          pendingReceivables: parseFloat(pending.t || 0),
          payables: parseFloat(pendingBills.t || 0),
          totalExpenses: parseFloat(exp.t || 0),
          estimatedProfit: parseFloat(rev.t || 0) - parseFloat(exp.t || 0),
          outputGST: o, inputGST: inp,
          netGSTPayable: Math.max(0, (o.c - inp.c) + (o.s - inp.s) + (o.i - inp.i)),
          counts: {
            customers: parseInt(cust.c || 0), invoices: parseInt(inv.c || 0),
            quotations: parseInt(quotes.c || 0), purchaseBills: parseInt(bills.c || 0)
          }
        };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_dashboard_stats': {
      try {
        const revenue = await db('invoices').where({ organization_id: orgId }).sum('total_amount as t').first();
        const paidRevenue = await db('invoices').where({ organization_id: orgId, payment_status: 'Paid' }).sum('total_amount as t').first();
        const pending = await db('invoices').where({ organization_id: orgId, payment_status: 'Unpaid' }).count('id as c').sum('total_amount as t').first();
        const exp = await db('expenses').where({ organization_id: orgId }).sum('amount as t').first();
        const cust = await db('customers').where({ organization_id: orgId }).count('id as c').first();
        const lowStock = await db('inventory').where({ organization_id: orgId }).whereRaw('quantity <= min_quantity').select('item_name', 'quantity', 'min_quantity', 'unit');
        const recent = await db('invoices').where({ 'invoices.organization_id': orgId }).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('invoices.invoice_number', 'invoices.total_amount', 'invoices.payment_status', 'invoices.invoice_date', 'customers.name as customer_name').orderBy('invoices.created_at', 'desc').limit(8);
        return {
          totalRevenue: parseFloat(revenue.t || 0),
          paidRevenue: parseFloat(paidRevenue.t || 0),
          pendingCount: parseInt(pending.c || 0),
          pendingAmount: parseFloat(pending.t || 0),
          totalExpenses: parseFloat(exp.t || 0),
          netProfit: parseFloat(revenue.t || 0) - parseFloat(exp.t || 0),
          customerCount: parseInt(cust.c || 0),
          lowStockItems: lowStock,
          recentInvoices: recent
        };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_gst_summary': {
      try {
        const year = parseInt(args.year, 10) || new Date().getFullYear();
        const fyStart = `${year}-04-01`, fyEnd = `${year + 1}-03-31`;
        const outT = await db('invoices').where({ organization_id: orgId }).whereBetween('invoice_date', [fyStart, fyEnd]).sum('cgst_amount as c').sum('sgst_amount as s').sum('igst_amount as i').sum('subtotal as taxable').first();
        const inT = await db('purchase_bills').where({ organization_id: orgId }).whereBetween('bill_date', [fyStart, fyEnd]).sum('cgst_amount as c').sum('sgst_amount as s').sum('igst_amount as i').sum('subtotal as taxable').first();
        const o = { c: parseFloat(outT.c || 0), s: parseFloat(outT.s || 0), i: parseFloat(outT.i || 0) };
        const inp = { c: parseFloat(inT.c || 0), s: parseFloat(inT.s || 0), i: parseFloat(inT.i || 0) };
        return {
          financialYear: `${year}-${String(year + 1).slice(2)}`,
          outputGST: o, inputGST: inp,
          outputTotal: o.c + o.s + o.i, inputTotal: inp.c + inp.s + inp.i,
          netPayable: { cgst: Math.max(0, o.c - inp.c), sgst: Math.max(0, o.s - inp.s), igst: Math.max(0, o.i - inp.i) },
          totalNetPayable: Math.max(0, (o.c - inp.c) + (o.s - inp.s) + (o.i - inp.i)),
          taxableSales: parseFloat(outT.taxable || 0), taxablePurchases: parseFloat(inT.taxable || 0)
        };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_outstanding_invoices': {
      try {
        const limit = Math.min(args.limit || 25, 100);
        const unpaid = await db('invoices').where({ 'invoices.organization_id': orgId }).whereIn('invoices.payment_status', ['Unpaid', 'Partial']).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('invoices.id', 'invoices.invoice_number', 'invoices.invoice_date', 'invoices.due_date', 'invoices.total_amount', 'invoices.payment_status', 'customers.name as customer_name', 'customers.phone').orderBy('invoices.total_amount', 'desc').limit(limit);
        const now = new Date();
        const days = d => Math.floor((now - new Date(d)) / 86400000);
        let totalUnpaid = 0, overdueTotal = 0, overdueCount = 0;
        const rows = unpaid.map(inv => {
          const amount = parseFloat(inv.total_amount || 0);
          totalUnpaid += amount;
          const overdueDays = inv.due_date ? days(inv.due_date) : (inv.invoice_date ? days(inv.invoice_date) : 0);
          const isOverdue = overdueDays > 0;
          if (isOverdue) { overdueTotal += amount; overdueCount++; }
          return { ...inv, overdueDays: isOverdue ? overdueDays : 0, isOverdue };
        });
        return { totalUnpaid, overdueCount, overdueAmount: overdueTotal, invoices: rows };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_outstanding_bills': {
      try {
        const limit = Math.min(args.limit || 25, 100);
        const bills = await db('purchase_bills').where({ organization_id: orgId }).whereIn('payment_status', ['Unpaid', 'Partial']).select('id', 'bill_number', 'bill_date', 'supplier_name', 'total_amount', 'payment_status').orderBy('total_amount', 'desc').limit(limit);
        const totalUnpaid = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
        return { totalPayables: totalUnpaid, billCount: bills.length, bills };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_top_customers': {
      try {
        const limit = Math.min(args.limit || 5, 20);
        const top = await db('invoices').where({ 'invoices.organization_id': orgId }).leftJoin('customers', 'invoices.customer_id', 'customers.id').select('customers.id', 'customers.name', 'customers.gstin', 'customers.city', 'customers.state', 'customers.phone').sum('invoices.total_amount as totalBusiness').groupBy('customers.id', 'customers.name', 'customers.gstin', 'customers.city', 'customers.state', 'customers.phone').orderBy('totalBusiness', 'desc').limit(limit);
        return { customers: top };
      } catch (err) { return { error: err.message }; }
    }

    case 'search_customer': {
      try {
        const q = String(args.query || '').trim();
        if (!q) return { error: 'Provide a search query' };
        const customers = await db('customers').where({ organization_id: orgId }).where(function () {
          this.where('name', 'ilike', `%${q}%`).orWhere('phone', 'ilike', `%${q}%`).orWhere('gstin', 'ilike', `%${q}%`).orWhere('trade_name', 'ilike', `%${q}%`);
        }).limit(10);
        return { count: customers.length, customers };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_inventory_status': {
      try {
        const limit = Math.min(args.limit || 25, 100);
        const low = await db('inventory').where({ organization_id: orgId }).whereRaw('quantity <= min_quantity').select('item_name', 'item_code', 'quantity', 'min_quantity', 'unit', 'category').limit(20);
        const total = await db('inventory').where({ organization_id: orgId }).count('id as c').first();
        const items = await db('inventory').where({ organization_id: orgId }).orderBy('quantity', 'asc').limit(limit);
        return { totalItems: parseInt(total.c || 0), lowStockCount: low.length, lowStockItems: low, items };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_recent_payments': {
      try {
        const limit = Math.min(args.limit || 20, 100);
        const payments = await db('payments').where({ 'payments.organization_id': orgId }).leftJoin('customers', 'payments.customer_id', 'customers.id').leftJoin('invoices', 'payments.invoice_id', 'invoices.id').select('payments.id', 'payments.payment_number', 'payments.payment_date', 'payments.amount', 'payments.payment_mode', 'payments.type', 'payments.reference', 'customers.name as customer_name', 'invoices.invoice_number').orderBy('payments.payment_date', 'desc').limit(limit);
        const total = await db('payments').where({ organization_id: orgId }).sum('amount as t').first();
        return { totalReceived: parseFloat(total.t || 0), payments };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_expense_summary': {
      try {
        const limit = Math.min(args.limit || 20, 100);
        const total = await db('expenses').where({ organization_id: orgId }).sum('amount as t').first();
        const byCategory = await db('expenses').where({ organization_id: orgId }).select('category').sum('amount as t').groupBy('category').orderBy('t', 'desc');
        const recent = await db('expenses').where({ organization_id: orgId }).orderBy('expense_date', 'desc').limit(limit);
        return { totalExpenses: parseFloat(total.t || 0), byCategory, recentExpenses: recent };
      } catch (err) { return { error: err.message }; }
    }

    case 'list_invoices':
    case 'list_quotations':
    case 'list_purchases': {
      try {
        const limit = Math.min(parseInt(args.limit) || 25, 100);
        const range = monthRange(args.month);
        if (args.month && !range) return { error: 'month must look like 2026-10' };
        const like = v => `%${String(v).trim()}%`;
        let q, rows;
        if (name === 'list_invoices') {
          q = db('invoices').where({ 'invoices.organization_id': orgId }).leftJoin('customers', 'invoices.customer_id', 'customers.id');
          if (range) q = q.whereBetween('invoices.invoice_date', range);
          if (args.payment_status) q = q.where('invoices.payment_status', args.payment_status);
          if (args.customer) q = q.where('customers.name', 'ilike', like(args.customer));
          rows = await q.select('invoices.id', 'invoices.invoice_number', db.raw("to_char(invoices.invoice_date,'YYYY-MM-DD') as invoice_date"), 'customers.name as customer_name', 'invoices.subtotal', 'invoices.total_amount', 'invoices.payment_status').orderBy('invoices.invoice_date', 'desc').limit(limit);
        } else if (name === 'list_quotations') {
          q = db('quotations').where({ 'quotations.organization_id': orgId }).leftJoin('customers', 'quotations.customer_id', 'customers.id');
          if (range) q = q.whereBetween('quotations.quotation_date', range);
          if (args.customer) q = q.where(function () { this.where('customers.name', 'ilike', like(args.customer)).orWhereRaw("split_part(quotations.notes, '|||', 1) ilike ?", [like(args.customer)]); });
          rows = await q.select('quotations.id', 'quotations.quotation_number', db.raw("to_char(quotations.quotation_date,'YYYY-MM-DD') as quotation_date"), db.raw("COALESCE(customers.name, NULLIF(split_part(quotations.notes, '|||', 1), '')) as customer_name"), 'quotations.total_amount', 'quotations.status').orderBy('quotations.quotation_date', 'desc').limit(limit);
        } else {
          q = db('purchase_bills').where({ organization_id: orgId });
          if (range) q = q.whereBetween('bill_date', range);
          if (args.supplier) q = q.where('supplier_name', 'ilike', like(args.supplier));
          if (args.payment_status) q = q.where('payment_status', args.payment_status);
          rows = await q.select('id', 'bill_number', db.raw("to_char(bill_date,'YYYY-MM-DD') as bill_date"), 'supplier_name', 'subtotal', 'total_amount', 'payment_status').orderBy('bill_date', 'desc').limit(limit);
        }
        const total = rows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
        return { count: rows.length, totalAmount: total, rows };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_customer_detail': {
      try {
        const key = String(args.customer || '').trim();
        if (!key) return { error: 'Provide a customer name or id' };
        let cust = /^\d+$/.test(key) ? await db('customers').where({ organization_id: orgId, id: key }).first() : null;
        if (!cust) cust = await db('customers').where({ organization_id: orgId }).where('name', 'ilike', `%${key}%`).first();
        if (!cust) return { error: `No customer matching "${key}"` };
        const invoices = await db('invoices').where({ organization_id: orgId, customer_id: cust.id }).select('id', 'invoice_number', db.raw("to_char(invoice_date,'YYYY-MM-DD') as invoice_date"), 'total_amount', 'payment_status').orderBy('invoice_date', 'desc').limit(50);
        const sum = (arr, f) => arr.filter(f).reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);
        return {
          customer: { id: cust.id, name: cust.name, gstin: cust.gstin, phone: cust.phone, email: cust.email, city: cust.city, state: cust.state },
          invoiceCount: invoices.length, totalBusiness: sum(invoices, () => true),
          outstanding: sum(invoices, r => r.payment_status !== 'Paid'), recentInvoices: invoices.slice(0, 10)
        };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_monthly_trend': {
      try {
        const n = Math.min(Math.max(parseInt(args.months) || 6, 1), 24);
        const from = new Date(); from.setDate(1); from.setMonth(from.getMonth() - (n - 1));
        const start = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`;
        const sales = await db('invoices').where({ organization_id: orgId }).where('invoice_date', '>=', start)
          .select(db.raw("to_char(invoice_date, 'YYYY-MM') as month"), db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(total_amount),0) as total'), db.raw('COALESCE(SUM(cgst_amount+sgst_amount+igst_amount),0) as gst')).groupBy('month').orderBy('month');
        const buys = await db('purchase_bills').where({ organization_id: orgId }).where('bill_date', '>=', start)
          .select(db.raw("to_char(bill_date, 'YYYY-MM') as month"), db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(total_amount),0) as total'), db.raw('COALESCE(SUM(cgst_amount+sgst_amount+igst_amount),0) as gst')).groupBy('month').orderBy('month');
        return { from: start, sales, purchases: buys };
      } catch (err) { return { error: err.message }; }
    }

    case 'list_vehicle_papers': {
      try {
        let q = db('vehicle_papers').where({ organization_id: orgId });
        if (args.doc_type) q = q.where('type', args.doc_type);
        if (args.vehicle_no) q = q.where('vehicle_no', 'ilike', `%${String(args.vehicle_no).trim()}%`);
        const rows = await q.select('id', 'type', 'paper_no', db.raw("to_char(paper_date,'YYYY-MM-DD') as paper_date"), 'customer_name', 'vehicle_no', 'chassis_no', 'engine_no', 'model', 'amount', 'payment_mode').orderBy('created_at', 'desc').limit(50);
        return { count: rows.length, papers: rows };
      } catch (err) { return { error: err.message }; }
    }

    case 'find_document': {
      try {
        const q = String(args.query || '').trim();
        if (q.length < 2) return { error: 'Query too short' };
        const like = `%${q}%`;
        const [inv, quo, pur, cus] = await Promise.all([
          db('invoices').where({ 'invoices.organization_id': orgId }).leftJoin('customers', 'invoices.customer_id', 'customers.id').where(function () { this.where('invoices.invoice_number', 'ilike', like).orWhere('customers.name', 'ilike', like); }).select('invoices.id', 'invoices.invoice_number', 'customers.name as customer_name', 'invoices.total_amount', 'invoices.payment_status').limit(5),
          db('quotations').where({ organization_id: orgId }).where(function () { this.where('quotation_number', 'ilike', like).orWhereRaw("split_part(notes, '|||', 1) ilike ?", [like]); }).select('id', 'quotation_number', db.raw("split_part(notes, '|||', 1) as customer_name"), 'total_amount').limit(5),
          db('purchase_bills').where({ organization_id: orgId }).where(function () { this.where('bill_number', 'ilike', like).orWhere('supplier_name', 'ilike', like); }).select('id', 'bill_number', 'supplier_name', 'total_amount', 'payment_status').limit(5),
          db('customers').where({ organization_id: orgId }).where(function () { this.where('name', 'ilike', like).orWhere('gstin', 'ilike', like).orWhere('phone', 'ilike', like); }).select('id', 'name', 'phone', 'gstin').limit(5),
        ]);
        return { invoices: inv, quotations: quo, purchases: pur, customers: cus };
      } catch (err) { return { error: err.message }; }
    }

    case 'get_knowledge': {
      const chunks = searchKnowledge(args.query, 6);
      if (!chunks.length) return { query: args.query, found: 0, results: [] };
      return {
        query: args.query,
        found: chunks.length,
        results: chunks.map(c => ({ title: c.title, category: c.category, content: c.content }))
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}


module.exports = { TOOL_DEFINITIONS, SAFE_AI_TOOL_NAMES, SAFE_TOOL_DEFINITIONS, monthRange, BLOCKED_SQL, DANGEROUS_SQL, NO_WHERE, executeTool };
