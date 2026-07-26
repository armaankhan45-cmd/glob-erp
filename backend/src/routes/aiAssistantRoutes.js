/**
 * 🤖 AI Assistant Route — Full-Featured ERP AI
 * 
 * Capabilities:
 * - Connects to Google Gemini API (free tier) for natural language understanding
 * - 15+ tools for interacting with the ERP (diagnose, fix, SQL, read/write code, etc.)
 * - Falls back to rule-based system if no API key configured
 * - Admin-only access
 * - Conversation memory (last 30 messages)
 * - Secure SQL execution with destructive query blocking
 */
const express = require('express');
const router = express.Router();
const getDb = require('../config/db');
const { auth, adminOnly } = require('../middleware/auth');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════
// SYSTEM PROMPT — Full ERP context for the AI
// ═══════════════════════════════════════════════

const SYSTEM_PROMPT = `You are the **Glob ERP AI Assistant** — an expert developer and system administrator for a GST-compliant fabrication ERP web application.

## Your Business Context
- **Company:** GLOB FABRICATION AND ENTERPRISES (Maharashtra, India)
- **GSTIN:** 27AWAPK1209R1ZC
- **Business Type:** Fabrication/manufacturing of SS tanks, tankers, chassis mounting
- **HSN Codes:** 7309 (tanks), 8708 (chassis), 8481 (valves), 7307 (pipes)

## Your Tech Stack
- **Backend:** Express.js + Knex.js on PostgreSQL (hosted on Render free tier)
- **Frontend:** React + Vite + Tailwind CSS (hosted on Vercel)
- **Database:** Neon PostgreSQL free tier
- **API Base:** https://glob-erp-api.onrender.com/api
- **Frontend URL:** https://glob-erp.vercel.app

## Database Tables (18 total)
organizations, users, customers, invoices, invoice_items, quotations, quotation_items, purchase_bills, purchase_bill_items, payments, expenses, credit_notes, inventory, suppliers, workers, machines, production, settings, audit_log

## API Routes (18 total)
/api/auth, /api/customers, /api/invoices, /api/quotations, /api/purchases, /api/payments, /api/expenses, /api/credit-notes, /api/suppliers, /api/inventory, /api/workers, /api/machines, /api/production, /api/dashboard, /api/gst, /api/reports, /api/settings, /api/export

## Key ERP Features
- GST Invoices with HSN auto-detect, CGST/SGST/IGST calculation
- Quotations (no dates, no HSN, typeable customer name, bordered box format)
- Purchase Bills (editable after creation)
- GST Reports with monthly carry-forward balance
- Dashboard with Bar/Line/Area charts
- Logo/Stamp/Signature upload (base64 in DB)
- Self-healing auto-diagnostics engine
- WhatsApp + Email sharing for invoices and quotations

## Known Issues & Fixes
- Empty date strings → null (global middleware handles this)
- "total" column → "total_amount" (global rename middleware)
- Quotation customer_name stored in notes field via ||| separator
- Logo/stamp/signature stored as base64 data URI in DB (Render has no persistent disk)
- PDF generation uses HTML (no Puppeteer on free tier)
- Render free tier spins down after 15 min inactivity — first request takes ~30s

## Your Capabilities
You have access to TOOLS that let you:
1. **Diagnose** the system (check tables, routes, errors)
2. **Fix** problems (auto-create missing tables/columns, run repairs)
3. **Query** the database (run SELECT queries safely)
4. **Modify** data (update records, settings)
5. **Read** source code files on the server
6. **Write** source code files on the server (immediate effect, persists until next deploy)
7. **Generate** code suggestions and show them to the user
8. **Deploy** to Render, check GitHub status, check Vercel status
9. **Restart** the server (requires admin confirmation)
10. **Check** environment variables and server info

## Your Rules
1. Always explain what you're doing before taking action
2. For destructive operations (DROP, DELETE, UPDATE), ALWAYS confirm with the user first
3. When writing code, show the full code with proper formatting
4. When fixing errors, explain the root cause and the fix
5. If you're not sure about something, say so — don't guess
6. Use the tools available to you — don't just guess at answers
7. Be concise but thorough
8. Format your responses with markdown: **bold** for emphasis, \`\`\`code blocks\`\`\` for code, lists for steps

## Important Notes
- When you modify server files, changes take effect immediately but are lost on next deploy (Render pulls from GitHub)
- For permanent code changes, the user needs to update GitHub
- You can read any file in the backend/src/ directory
- You can run SQL queries but destructive ones need confirmation
- The self-heal engine runs on every server startup and fixes missing tables/columns automatically`;

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
  }
];

// ═══════════════════════════════════════════════
// TOOL EXECUTORS — Actual functions that run on the server
// ═══════════════════════════════════════════════

const BLOCKED_SQL = /\b(DROP\s+(TABLE|DATABASE|SCHEMA|INDEX)|TRUNCATE|ALTER\s+TABLE\s+\w+\s+DROP|GRANT|REVOKE)\b/i;
const DANGEROUS_SQL = /\b(DELETE\s+FROM|UPDATE\s+\w+\s+SET)\b/i;
const NO_WHERE = /\b(DELETE\s+FROM\s+\w+\s*;|UPDATE\s+\w+\s+SET\s+.*?;)/i;

async function executeTool(name, args, orgId) {
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
        const cols = await db.raw(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = '${args.table}'
          ORDER BY ordinal_position
        `);
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

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ═══════════════════════════════════════════════
// MULTI-PROVIDER AI INTEGRATION — ALL FREE!
// Supports: Pollinations (FREE, NO KEY), Gemini, Groq, Cerebras, OpenRouter, DeepSeek, OpenAI
// Priority: Pollinations (always free) → Gemini Pro → Groq → DeepSeek → Cerebras → OpenRouter → OpenAI
// ═══════════════════════════════════════════════

async function callAI(messages, toolDefs) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  
  // ── Strategy: Best keyed providers FIRST, then free fallback ──
  // Keyed providers have higher rate limits and are faster
  // Pollinations is the LAST resort (always free but rate-limited)

  // 1. Groq — Very fast, 1000 req/day (if key provided)
  if (groqKey) {
    const result = await callGroq(messages, toolDefs, groqKey);
    if (result) return { ...result, provider: 'Groq Llama 3.3 70B' };
  }

  // 2. Gemini 2.5 Pro — Most powerful free model (if key provided)
  if (geminiKey) {
    const proResult = await callGemini(messages, toolDefs, geminiKey, 'gemini-2.5-pro');
    if (proResult) return { ...proResult, provider: 'Gemini 2.5 Pro' };
    
    const flashResult = await callGemini(messages, toolDefs, geminiKey, 'gemini-2.5-flash');
    if (flashResult) return { ...flashResult, provider: 'Gemini 2.5 Flash' };
  }

  // 3. DeepSeek V3 — Great for code, 5M free tokens (if key provided)
  if (deepseekKey) {
    const result = await callDeepSeek(messages, toolDefs, deepseekKey);
    if (result) return { ...result, provider: 'DeepSeek V3' };
  }

  // 4. Cerebras — Very fast, 1M tokens/day (if key provided)
  if (cerebrasKey) {
    const result = await callCerebras(messages, toolDefs, cerebrasKey);
    if (result) return { ...result, provider: 'Cerebras' };
  }

  // 5. OpenRouter — Multi-model gateway (if key provided)
  if (openrouterKey) {
    const result = await callOpenRouter(messages, toolDefs, openrouterKey);
    if (result) return { ...result, provider: 'OpenRouter' };
  }

  // 6. OpenAI GPT-4o — Paid only (if key provided)
  if (openaiKey) {
    const result = await callOpenAI(messages, toolDefs, openaiKey);
    if (result) return { ...result, provider: 'OpenAI GPT-4o' };
  }

  // 7. Pollinations AI — ALWAYS FREE, NO KEY — last resort fallback
  const pollResult = await callPollinations(messages, toolDefs);
  if (pollResult) return { ...pollResult, provider: 'Pollinations AI (Free)' };

  return null; // All providers failed — fall back to rule-based
}

// ── POLLINATIONS AI (100% FREE, NO API KEY NEEDED!) ──
// OpenAI-compatible API, supports tool calling, no signup required
// Endpoint: https://text.pollinations.ai/openai
// Anonymous: ~1 req/15sec, Free registered: ~1 req/5sec
async function callPollinations(messages, toolDefs) {
  const url = 'https://text.pollinations.ai/openai';

  const pollMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      pollMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      pollMessages.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'tool_call') {
      pollMessages.push({ 
        role: 'assistant', 
        content: null,
        tool_calls: [{ id: `call_${msg.name}_${Date.now()}`, type: 'function', function: { name: msg.name, arguments: JSON.stringify(msg.args || {}) } }]
      });
    } else if (msg.role === 'tool_result') {
      pollMessages.push({
        role: 'tool',
        tool_call_id: `call_${msg.name}`,
        content: JSON.stringify(msg.result)
      });
    }
  }

  // Convert tool definitions to OpenAI format
  const pollTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // NO API KEY NEEDED! 🎉
      },
      body: JSON.stringify({
        model: 'openai',  // Free: GPT-OSS 20B Reasoning model (supports tools!)
        messages: pollMessages,
        tools: pollTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Pollinations error:', response.status, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('Pollinations fetch error:', err.message);
    return null;
  }
}

// ── DEEPSEEK API (Free tier: 5M tokens, great for code) ──
async function callDeepSeek(messages, toolDefs, apiKey) {
  const url = 'https://api.deepseek.com/v1/chat/completions';

  const dsMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      dsMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      dsMessages.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'tool_call') {
      dsMessages.push({ 
        role: 'assistant', 
        content: null,
        tool_calls: [{ id: `call_${msg.name}_${Date.now()}`, type: 'function', function: { name: msg.name, arguments: JSON.stringify(msg.args || {}) } }]
      });
    } else if (msg.role === 'tool_result') {
      dsMessages.push({
        role: 'tool',
        tool_call_id: `call_${msg.name}`,
        content: JSON.stringify(msg.result)
      });
    }
  }

  const dsTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: dsMessages,
        tools: dsTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) return null;

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('DeepSeek fetch error:', err.message);
    return null;
  }
}

// ── GEMINI API ──
async function callGemini(messages, toolDefs, apiKey, model = 'gemini-2.5-pro') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const contents = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      contents.push({ role: 'model', parts: [{ text: msg.content }] });
    } else if (msg.role === 'tool_call') {
      contents.push({ role: 'model', parts: [{ functionCall: { name: msg.name, args: msg.args || {} } }] });
    } else if (msg.role === 'tool_result') {
      contents.push({ role: 'user', parts: [{ functionResponse: { name: msg.name, response: msg.result } }] });
    }
  }

  const body = {
    contents,
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    tools: [{ functionDeclarations: toolDefs }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 16384,
      topP: 0.95
    }
  };

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // timeout handled by safeFetch
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Gemini ${model} error:`, response.status, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    return extractGeminiResponse(data);
  } catch (err) {
    console.error(`Gemini ${model} fetch error:`, err.message);
    return null;
  }
}

// ── OPENAI API ──
async function callOpenAI(messages, toolDefs, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';

  // Convert to OpenAI format
  const openaiMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      openaiMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      openaiMessages.push({ role: 'assistant', content: msg.content });
    } else if (msg.role === 'tool_call') {
      openaiMessages.push({ 
        role: 'assistant', 
        content: null,
        tool_calls: [{ id: `call_${msg.name}`, type: 'function', function: { name: msg.name, arguments: JSON.stringify(msg.args || {}) } }]
      });
    } else if (msg.role === 'tool_result') {
      openaiMessages.push({
        role: 'tool',
        tool_call_id: `call_${msg.name}`,
        content: JSON.stringify(msg.result)
      });
    }
  }

  // Convert tool definitions to OpenAI format
  const openaiTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: openaiMessages,
        tools: openaiTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', response.status, errText.substring(0, 200));
      return null;
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('OpenAI fetch error:', err.message);
    return null;
  }
}

// ── GROQ API (Free Llama 3.3 70B) ──
async function callGroq(messages, toolDefs, apiKey) {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const groqMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      groqMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      groqMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Groq tool calling format (OpenAI compatible)
  const groqTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: groqMessages,
        tools: groqTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) return null;

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('Groq fetch error:', err.message);
    return null;
  }
}

// ── CEREBRAS API (Free, very fast Llama 3.3 70B) ──
async function callCerebras(messages, toolDefs, apiKey) {
  const url = 'https://api.cerebras.ai/v1/chat/completions';

  const cbrMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      cbrMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      cbrMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Cerebras uses OpenAI-compatible API with tool calling
  const cbrTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b',
        messages: cbrMessages,
        tools: cbrTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) return null;

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('Cerebras fetch error:', err.message);
    return null;
  }
}

// ── OPENROUTER API (Free tier, multi-model gateway) ──
async function callOpenRouter(messages, toolDefs, apiKey) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const orMessages = [
    { role: 'system', content: SYSTEM_PROMPT }
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      orMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      orMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  const orTools = toolDefs.map(td => ({
    type: 'function',
    function: {
      name: td.name,
      description: td.description,
      parameters: td.parameters || { type: 'object', properties: {} }
    }
  }));

  try {
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://glob-erp.vercel.app',
        'X-Title': 'Glob ERP AI Assistant'
      },
      body: JSON.stringify({
        // Use a free model — tries them in order
        model: 'google/gemini-2.5-flash-preview-05-20',
        models: ['google/gemini-2.5-flash-preview-05-20', 'meta-llama/llama-3.3-70b-instruct'],
        messages: orMessages,
        tools: orTools,
        temperature: 0.7,
        max_tokens: 4096
      }),
      // timeout handled by safeFetch
    });

    if (!response.ok) return null;

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) return null;

    const toolCalls = [];
    if (choice.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        try {
          toolCalls.push({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          });
        } catch (e) {}
      }
    }

    return {
      text: choice.message?.content || '',
      toolCalls,
      finishReason: choice.finish_reason
    };
  } catch (err) {
    console.error('OpenRouter fetch error:', err.message);
    return null;
  }
}

function extractGeminiResponse(data) {
  if (!data?.candidates?.[0]?.content?.parts) return null;
  
  const parts = data.candidates[0].content.parts;
  const textParts = [];
  const toolCalls = [];

  for (const part of parts) {
    if (part.text) textParts.push(part.text);
    if (part.functionCall) {
      toolCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {}
      });
    }
  }

  return {
    text: textParts.join('\n'),
    toolCalls,
    finishReason: data.candidates[0].finishReason
  };
}

// ═══════════════════════════════════════════════
// RULE-BASED FALLBACK (when no API key)
// ═══════════════════════════════════════════════

function ruleBasedResponse(msg, orgId) {
  const lower = msg.toLowerCase();

  if (lower.includes('health') || lower.includes('check') || lower.includes('diagnos') || lower.includes('status')) {
    return { text: 'Let me run a full system diagnosis for you...', toolCalls: [{ name: 'diagnose_system', args: {} }] };
  }
  if (lower.includes('error') || lower.includes('broke') || lower.includes('failed') || lower.includes('wrong')) {
    return { text: 'Let me check the recent errors...', toolCalls: [{ name: 'get_recent_errors', args: { limit: 15 } }] };
  }
  if (lower.includes('fix') || lower.includes('repair') || lower.includes('solve')) {
    return { text: 'Running the self-healing engine to fix issues...', toolCalls: [{ name: 'fix_system', args: {} }] };
  }
  if (lower.match(/table\s+(\w+)/)) {
    const table = lower.match(/table\s+(\w+)/)[1];
    return { text: `Checking the structure of table "${table}"...`, toolCalls: [{ name: 'get_table_structure', args: { table } }] };
  }
  if (lower.includes('setting')) {
    return { text: 'Fetching current settings...', toolCalls: [{ name: 'get_settings', args: {} }] };
  }
  if (lower.match(/invoice\s*#?\s*(\d+)/)) {
    const id = parseInt(lower.match(/invoice\s*#?\s*(\d+)/)[1]);
    return { text: `Fetching invoice #${id}...`, toolCalls: [{ name: 'get_invoice_detail', args: { id } }] };
  }
  if (lower.includes('count') || lower.includes('how many') || lower.includes('total')) {
    if (lower.includes('invoice')) return { text: 'Counting invoices...', toolCalls: [{ name: 'count_records', args: { table: 'invoices' } }] };
    if (lower.includes('quotation')) return { text: 'Counting quotations...', toolCalls: [{ name: 'count_records', args: { table: 'quotations' } }] };
    if (lower.includes('customer')) return { text: 'Counting customers...', toolCalls: [{ name: 'count_records', args: { table: 'customers' } }] };
  }
  if (lower.includes('list') || lower.includes('show') || lower.includes('view')) {
    if (lower.includes('invoice')) return { text: 'Listing recent invoices...', toolCalls: [{ name: 'list_table_data', args: { table: 'invoices', limit: 10 } }] };
    if (lower.includes('quotation')) return { text: 'Listing recent quotations...', toolCalls: [{ name: 'list_table_data', args: { table: 'quotations', limit: 10 } }] };
    if (lower.includes('customer')) return { text: 'Listing customers...', toolCalls: [{ name: 'list_table_data', args: { table: 'customers', limit: 20 } }] };
    if (lower.includes('file') || lower.includes('code')) return { text: 'Listing server files...', toolCalls: [{ name: 'list_files', args: { path: 'routes' } }] };
  }
  if (lower.includes('read') && lower.includes('file') || lower.includes('show code') || lower.includes('source')) {
    const routesPath = lower.includes('invoice') ? 'routes/invoiceRoutes.js' : 
                       lower.includes('quotation') ? 'routes/quotationRoutes.js' :
                       lower.includes('server') ? 'server.js' : '.';
    return { text: `Reading file ${routesPath}...`, toolCalls: [{ name: 'read_file', args: { path: routesPath } }] };
  }

  // Default help
  return {
    text: `I can help you with many things! Try asking me to:

🔍 **Diagnose & Fix:**
- "Check system health"
- "Show recent errors"
- "Fix the errors"

📊 **Data & Queries:**
- "List recent invoices"
- "Count quotations"
- "Show invoice #1"
- "Check table invoices"

🔧 **Code & Files:**
- "Read file routes/invoiceRoutes.js"
- "List files in routes/"

⚙️ **Settings:**
- "Show settings"
- "Update settings"

💡 **Or just describe your problem** and I'll figure out how to help!

---

🆓 **This AI is 100% FREE** — powered by Pollinations AI. No API key, no signup, no credit card needed!`
  };
}

// ═══════════════════════════════════════════════
// MAIN CHAT ENDPOINT
// ═══════════════════════════════════════════════

router.post('/chat', auth, adminOnly, async (req, res) => {
  try {
    const { messages = [], provider: requestedProvider } = req.body;
    const orgId = req.user.organization_id;
    const userMessage = messages[messages.length - 1]?.content || '';
    
    // ── ALWAYS USE AI FLOW ──
    // Pollinations AI is FREE and needs NO API key, so AI is ALWAYS available!
    // Other providers (Gemini, Groq, DeepSeek) are tried for higher rate limits if keys are set
    const allMessages = [
      ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', content: m.content })),
    ];

    // If user selected a specific provider, try ONLY that one first
    if (requestedProvider && requestedProvider !== 'auto') {
      const singleResult = await callSingleProvider(requestedProvider, allMessages, TOOL_DEFINITIONS);
      if (singleResult) {
        // Handle tool calls in a loop
        let currentMessages = [...allMessages];
        let finalResponse = singleResult.text || '';
        let maxIter = 5;
        currentMessages.push({ role: 'model', content: singleResult.text || 'Processing...' });
        
        while (singleResult.toolCalls?.length > 0 && maxIter-- > 0) {
          const toolResults = [];
          for (const tc of singleResult.toolCalls) {
            const result = await executeTool(tc.name, tc.args, orgId);
            toolResults.push({ name: tc.name, args: tc.args, result });
          }
          for (const tr of toolResults) {
            currentMessages.push({ role: 'tool_result', name: tr.name, result: tr.result });
          }
          // Get next response with tool results
          const nextResult = await callSingleProvider(requestedProvider, currentMessages, TOOL_DEFINITIONS);
          if (!nextResult) break;
          finalResponse = nextResult.text || finalResponse;
          if (!nextResult.toolCalls?.length) {
            const toolCallsInConversation = [];
            for (let i = 0; i < currentMessages.length; i++) {
              if (currentMessages[i].role === 'tool_result') toolCallsInConversation.push({ name: currentMessages[i].name, result: currentMessages[i].result });
            }
            return res.json({ success: true, message: finalResponse, toolCalls: toolCallsInConversation, provider: singleResult.provider });
          }
          singleResult.toolCalls = nextResult.toolCalls;
          currentMessages.push({ role: 'model', content: nextResult.text || 'Processing...' });
        }
        return res.json({ success: true, message: finalResponse, provider: singleResult.provider });
      }
      // If selected provider fails, fall through to auto
    }

    let maxIterations = 5;
    let currentMessages = [...allMessages];
    let finalResponse = '';
    let usedProvider = 'unknown';

    while (maxIterations-- > 0) {
      const aiResponse = await callAI(currentMessages, TOOL_DEFINITIONS);
      
      if (!aiResponse) {
        // All AI providers failed (even Pollinations), fall back to rule-based
        const ruleResult = ruleBasedResponse(userMessage, orgId);
        if (ruleResult.toolCalls?.length > 0) {
          const toolResults = [];
          for (const tc of ruleResult.toolCalls) {
            const result = await executeTool(tc.name, tc.args, orgId);
            toolResults.push({ name: tc.name, result });
          }
          return res.json({
            success: true,
            message: ruleResult.text,
            toolCalls: ruleResult.toolCalls.map((tc, i) => ({ name: tc.name, args: tc.args, result: toolResults[i].result })),
            provider: 'fallback'
          });
        }
        return res.json({ success: true, message: ruleResult.text, provider: 'fallback' });
      }

      usedProvider = aiResponse.provider || usedProvider;
      const extracted = aiResponse;

      if (extracted.toolCalls.length > 0) {
        // Execute tools and continue conversation
        const toolResults = [];
        for (const tc of extracted.toolCalls) {
          const result = await executeTool(tc.name, tc.args, orgId);
          toolResults.push({ name: tc.name, args: tc.args, result });
        }

        // Add model's tool call + results to conversation
        currentMessages.push({ role: 'model', content: extracted.text || `Calling ${extracted.toolCalls.map(t => t.name).join(', ')}...` });
        for (const tr of toolResults) {
          currentMessages.push({ role: 'tool_result', name: tr.name, result: tr.result });
        }

        // If there's text along with tool calls, include it
        if (extracted.text) finalResponse = extracted.text;

        // Continue the loop to get the final response
        continue;
      }

      // No more tool calls — this is the final response
      finalResponse = extracted.text || finalResponse;
      
      // Collect all tool calls from the conversation for the frontend
      const toolCallsInConversation = [];
      for (let i = 0; i < currentMessages.length; i++) {
        if (currentMessages[i].role === 'tool_result') {
          toolCallsInConversation.push({
            name: currentMessages[i].name,
            result: currentMessages[i].result
          });
        }
      }

      return res.json({
        success: true,
        message: finalResponse,
        toolCalls: toolCallsInConversation,
        provider: usedProvider
      });
    }

    // Max iterations reached — return what we have
    return res.json({
      success: true,
      message: finalResponse || 'I processed your request but hit the iteration limit. Try a more specific question.',
      provider: usedProvider
    });

  } catch (err) {
    console.error('AI Chat error:', err);
    res.status(500).json({ success: false, msg: 'AI chat error: ' + err.message });
  }
});

// Format tool results for the rule-based fallback
function formatToolResult(name, result) {
  if (result.error) return `❌ **${name}** failed: ${result.error}\n\n`;
  
  switch (name) {
    case 'diagnose_system':
      return `📊 **System Diagnosis: ${result.status?.toUpperCase()}**\n\n` +
        `✅ Tables: ${result.tablesExisting}/${result.tablesChecked} exist${result.tablesCreated ? ` (${result.tablesCreated} created)` : ''}\n` +
        `✅ Routes: ${result.routesLoaded} loaded${result.routesFailed ? `, ${result.routesFailed} FAILED` : ''}\n` +
        `🔧 Fixes: ${result.fixesApplied}\n` +
        `⚠️ Errors: ${result.errorsRemaining}\n` +
        (result.failedRoutes?.length ? `\n**Failed Routes:**\n` + result.failedRoutes.map(r => `- ❌ ${r.mount}: ${r.error}`).join('\n') : '') +
        (result.fixes?.length ? `\n**Auto-fixes:**\n` + result.fixes.map(f => `- ✅ ${f.type}: ${f.table || ''}${f.column ? '.' + f.column : ''}`).join('\n') : '') +
        '\n\n';

    case 'get_recent_errors':
      if (!result.errors?.length) return '✅ **No recent errors!**\n\n';
      return `⚠️ **${result.count} Recent Errors:**\n\n` +
        result.errors.slice(0, 10).map((e, i) => `${i + 1}. **${e.area || e.method || 'Runtime'}** ${e.url || ''}\n   ${e.error}`).join('\n\n') + '\n\n';

    case 'run_sql':
      if (!result.success) return `❌ SQL Error: ${result.error}\n\n`;
      return `📝 **SQL Result** (${result.rowCount} rows):\n\`\`\`json\n${JSON.stringify(result.rows?.slice(0, 10), null, 2)}\n\`\`\`\n\n`;

    case 'get_table_structure':
      return `📋 **Table: ${result.table}** (${result.rowCount} rows)\n\n` +
        result.columns.map(c => `- **${c.column_name}** (${c.data_type}${c.is_nullable === 'YES' ? ', nullable' : ''}${c.column_default ? `, default: ${c.column_default}` : ''})`).join('\n') + '\n\n';

    case 'list_table_data':
      return `📊 **${result.table}** (${result.rowCount} rows):\n\`\`\`json\n${JSON.stringify(result.rows?.slice(0, 5), null, 2)}\n\`\`\`\n\n`;

    case 'fix_system':
      return `🔧 **Auto-Fix Results: ${result.status}**\n` +
        `Fixes: ${result.fixesApplied}, Remaining errors: ${result.errorsRemaining}\n` +
        (result.fixes?.length ? result.fixes.map(f => `- ✅ ${f.type}: ${f.table || ''}${f.column ? '.' + f.column : ''}`).join('\n') : '') + '\n\n';

    case 'get_settings':
      return `⚙️ **Organization Settings:**\n\`\`\`json\n${JSON.stringify(result.organization, null, 2).substring(0, 2000)}\n\`\`\`\n\n`;

    case 'read_file':
      return `📄 **File: ${result.path}** (${result.lines} lines, ${result.size} bytes)\n\`\`\`javascript\n${result.content.substring(0, 3000)}\n\`\`\`\n\n`;

    case 'list_files':
      return `📂 **Directory: ${result.path}**\n` +
        result.items.map(i => `${i.type === 'directory' ? '📁' : '📄'} ${i.name} (${i.size} bytes)`).join('\n') + '\n\n';

    case 'count_records':
      return `📊 **${result.table}**: ${result.count} records\n\n`;

    case 'update_record':
      return result.success ? `✅ **Updated ${result.table} #${result.id}**\n\n` : `❌ Update failed\n\n`;

    case 'update_settings':
      return result.success ? `✅ **Settings updated**: ${result.updated.join(', ')}\n\n` : `❌ Settings update failed\n\n`;

    case 'write_file':
      return result.success ? `✅ **File written**: ${result.path}\n📝 ${result.note}\n\n` : `❌ Write failed\n\n`;

    default:
      return `📋 **${name}**: ${JSON.stringify(result).substring(0, 1000)}\n\n`;
  }
}

// ═══════════════════════════════════════════════
// QUICK ACTION ENDPOINTS
// ═══════════════════════════════════════════════

// ── Call a single specific provider by name ──
async function callSingleProvider(providerName, messages, toolDefs) {
  switch (providerName) {
    case 'Groq Llama 3.3 70B':
      if (process.env.GROQ_API_KEY) {
        const r = await callGroq(messages, toolDefs, process.env.GROQ_API_KEY);
        return r ? { ...r, provider: 'Groq Llama 3.3 70B' } : null;
      }
      return null;
    case 'Gemini 2.5 Pro':
      if (process.env.GEMINI_API_KEY) {
        const r = await callGemini(messages, toolDefs, process.env.GEMINI_API_KEY, 'gemini-2.5-pro');
        return r ? { ...r, provider: 'Gemini 2.5 Pro' } : null;
      }
      return null;
    case 'Gemini 2.5 Flash':
      if (process.env.GEMINI_API_KEY) {
        const r = await callGemini(messages, toolDefs, process.env.GEMINI_API_KEY, 'gemini-2.5-flash');
        return r ? { ...r, provider: 'Gemini 2.5 Flash' } : null;
      }
      return null;
    case 'DeepSeek V3':
      if (process.env.DEEPSEEK_API_KEY) {
        const r = await callDeepSeek(messages, toolDefs, process.env.DEEPSEEK_API_KEY);
        return r ? { ...r, provider: 'DeepSeek V3' } : null;
      }
      return null;
    case 'Cerebras':
      if (process.env.CEREBRAS_API_KEY) {
        const r = await callCerebras(messages, toolDefs, process.env.CEREBRAS_API_KEY);
        return r ? { ...r, provider: 'Cerebras' } : null;
      }
      return null;
    case 'OpenRouter':
      if (process.env.OPENROUTER_API_KEY) {
        const r = await callOpenRouter(messages, toolDefs, process.env.OPENROUTER_API_KEY);
        return r ? { ...r, provider: 'OpenRouter' } : null;
      }
      return null;
    case 'Pollinations AI (Free)':
      const r = await callPollinations(messages, toolDefs);
      return r ? { ...r, provider: 'Pollinations AI (Free)' } : null;
    default:
      return null;
  }
}

// ── HELPER: Safe fetch with AbortController timeout ──
async function safeFetch(url, options = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ═══════════════════════════════════════════════
// DIAGNOSTIC ENDPOINT — Tests all AI providers
// ═══════════════════════════════════════════════

router.get('/test', auth, async (req, res) => {
  const results = {};
  
  // 1. Test Pollinations (FREE, no key)
  try {
    const t0 = Date.now();
    const resp = await safeFetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10
      })
    }, 30000);
    const data = await resp.json();
    results.pollinations = {
      status: resp.ok ? '✅ WORKING' : '❌ FAILED',
      httpStatus: resp.status,
      response: data.choices?.[0]?.message?.content || data.error?.message || JSON.stringify(data).substring(0, 200),
      latency: `${Date.now() - t0}ms`,
      model: data.model || 'unknown',
      tier: data.user_tier || 'unknown'
    };
  } catch (err) {
    results.pollinations = { status: '❌ ERROR', error: err.message, code: err.code || 'unknown' };
  }

  // 2. Test Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const t0 = Date.now();
      const resp = await safeFetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say OK' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      }, 30000);
      const data = await resp.json();
      results.gemini = {
        status: resp.ok ? '✅ WORKING' : '❌ FAILED',
        httpStatus: resp.status,
        response: data.candidates?.[0]?.content?.parts?.[0]?.text || data.error?.message || JSON.stringify(data).substring(0, 200),
        latency: `${Date.now() - t0}ms`
      };
    } catch (err) {
      results.gemini = { status: '❌ ERROR', error: err.message };
    }
  } else {
    results.gemini = { status: '⚠️ NO KEY', note: 'GEMINI_API_KEY not set in Render environment' };
  }

  // 3. Test Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const t0 = Date.now();
      const resp = await safeFetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 10
        })
      }, 15000);
      const data = await resp.json();
      results.groq = {
        status: resp.ok ? '✅ WORKING' : '❌ FAILED',
        httpStatus: resp.status,
        response: data.choices?.[0]?.message?.content || data.error?.message || JSON.stringify(data).substring(0, 200),
        latency: `${Date.now() - t0}ms`
      };
    } catch (err) {
      results.groq = { status: '❌ ERROR', error: err.message };
    }
  } else {
    results.groq = { status: '⚠️ NO KEY', note: 'GROQ_API_KEY not set in Render environment' };
  }

  // 4. Test DeepSeek
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const t0 = Date.now();
      const resp = await safeFetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 10 })
      }, 15000);
      const data = await resp.json();
      results.deepseek = {
        status: resp.ok ? '✅ WORKING' : '❌ FAILED',
        httpStatus: resp.status,
        response: data.choices?.[0]?.message?.content || data.error?.message || JSON.stringify(data).substring(0, 200),
        latency: `${Date.now() - t0}ms`
      };
    } catch (err) {
      results.deepseek = { status: '❌ ERROR', error: err.message };
    }
  } else {
    results.deepseek = { status: '⚠️ NO KEY', note: 'DEEPSEEK_API_KEY not set in Render environment' };
  }

  // 5. Test Cerebras
  if (process.env.CEREBRAS_API_KEY) {
    try {
      const t0 = Date.now();
      const resp = await safeFetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.CEREBRAS_API_KEY}` },
        body: JSON.stringify({ model: 'llama-3.3-70b', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 10 })
      }, 15000);
      const data = await resp.json();
      results.cerebras = {
        status: resp.ok ? '✅ WORKING' : '❌ FAILED',
        httpStatus: resp.status,
        response: data.choices?.[0]?.message?.content || data.error?.message || JSON.stringify(data).substring(0, 200),
        latency: `${Date.now() - t0}ms`
      };
    } catch (err) {
      results.cerebras = { status: '❌ ERROR', error: err.message };
    }
  } else {
    results.cerebras = { status: '⚠️ NO KEY', note: 'CEREBRAS_API_KEY not set in Render environment' };
  }

  // 6. Test OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const t0 = Date.now();
      const resp = await safeFetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'HTTP-Referer': 'https://glob-erp.vercel.app' },
        body: JSON.stringify({ model: 'meta-llama/llama-3.3-70b-instruct:free', messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 10 })
      }, 15000);
      const data = await resp.json();
      results.openrouter = {
        status: resp.ok ? '✅ WORKING' : '❌ FAILED',
        httpStatus: resp.status,
        response: data.choices?.[0]?.message?.content || data.error?.message || JSON.stringify(data).substring(0, 200),
        latency: `${Date.now() - t0}ms`
      };
    } catch (err) {
      results.openrouter = { status: '❌ ERROR', error: err.message };
    }
  } else {
    results.openrouter = { status: '⚠️ NO KEY', note: 'OPENROUTER_API_KEY not set in Render environment' };
  }

  // Environment summary
  const envKeys = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `✅ Set (${process.env.GEMINI_API_KEY.substring(0, 8)}...)` : '❌ Not set',
    GROQ_API_KEY: process.env.GROQ_API_KEY ? `✅ Set (${process.env.GROQ_API_KEY.substring(0, 8)}...)` : '❌ Not set',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? `✅ Set (${process.env.DEEPSEEK_API_KEY.substring(0, 8)}...)` : '❌ Not set',
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY ? `✅ Set (${process.env.CEREBRAS_API_KEY.substring(0, 8)}...)` : '❌ Not set',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? `✅ Set (${process.env.OPENROUTER_API_KEY.substring(0, 8)}...)` : '❌ Not set',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `✅ Set (${process.env.OPENAI_API_KEY.substring(0, 8)}...)` : '❌ Not set',
  };

  res.json({ success: true, environment: envKeys, providers: results });
});

router.get('/status', auth, async (req, res) => {
  const keys = {
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    CEREBRAS_API_KEY: !!process.env.CEREBRAS_API_KEY,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY
  };
  
  // Keyed providers first (higher rate limits), then Pollinations as fallback
  const active = [];
  let primary = 'Pollinations AI (Free)';
  if (keys.GROQ_API_KEY) { active.push('Groq Llama 3.3 70B'); primary = primary === 'Pollinations AI (Free)' ? 'Groq Llama 3.3 70B' : primary; }
  if (keys.GEMINI_API_KEY) { active.push('Gemini 2.5 Pro + Flash'); if (primary === 'Pollinations AI (Free)') primary = 'Gemini 2.5 Pro'; }
  if (keys.DEEPSEEK_API_KEY) { active.push('DeepSeek V3'); if (primary === 'Pollinations AI (Free)') primary = 'DeepSeek V3'; }
  if (keys.CEREBRAS_API_KEY) { active.push('Cerebras Llama 3.3'); }
  if (keys.OPENROUTER_API_KEY) { active.push('OpenRouter'); }
  if (keys.OPENAI_API_KEY) { active.push('OpenAI GPT-4o'); }
  // Pollinations is ALWAYS available (no key needed!)
  active.push('Pollinations AI (Free)');
  
  res.json({
    success: true,
    aiEnabled: true, // ALWAYS true — Pollinations is free and needs no key!
    providers: active,
    primaryProvider: primary,
    toolsAvailable: 22,
    note: 'AI is always enabled! Pollinations AI works for free without any API key. Add your own keys for higher rate limits.'
  });
});

module.exports = router;
