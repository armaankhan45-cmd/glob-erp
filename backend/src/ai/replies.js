// Split out of routes/aiAssistantRoutes.js — replies


// ═══════════════════════════════════════════════
// RULE-BASED FALLBACK (when no API key)
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// BUSINESS INTENT DETECTION — answers common business questions
// directly from the live database, without needing an LLM at all.
// This makes the assistant instant + reliable even when the free
// AI provider is slow or down.
// ═══════════════════════════════════════════════════════════════
function businessIntent(lower) {
  // 1) GST / tax (also "how much GST do I owe")
  if (lower.includes('gst') || (lower.includes('tax') && !lower.includes('taxi'))) {
    return { text: 'Here is your **GST position** for the current financial year:', tool: { name: 'get_gst_summary', args: {} } };
  }
  // 2) Payables to suppliers (BEFORE "owe", so "what do I owe suppliers?" → bills)
  if (lower.includes('payable') || lower.includes('supplier')) {
    return { text: 'Here is what you **owe your suppliers**:', tool: { name: 'get_outstanding_bills', args: {} } };
  }
  // 3) Receivables — who owes the business
  if (lower.includes('owe') || lower.includes('outstanding') || lower.includes('unpaid') || lower.includes('receivable') || lower.includes('overdue') || lower.includes('pending payment') || lower.includes('who has not paid')) {
    return { text: 'Here is **who owes you money** (outstanding invoices):', tool: { name: 'get_outstanding_invoices', args: {} } };
  }
  // 4) Top customers
  if (lower.includes('top customer') || lower.includes('biggest customer') || lower.includes('best customer') || lower.includes('largest customer')) {
    return { text: 'Here are your **top customers** by business:', tool: { name: 'get_top_customers', args: {} } };
  }
  // 5) Stock / inventory
  if (lower.includes('stock') || lower.includes('inventory')) {
    return { text: 'Here is your **inventory status**:', tool: { name: 'get_inventory_status', args: {} } };
  }
  // 6) Payments received
  if (lower.includes('payment') || lower.includes('paid me') || lower.includes('received')) {
    return { text: 'Here are your **recent payments**:', tool: { name: 'get_recent_payments', args: {} } };
  }
  // 7) Expenses
  if (lower.includes('expense') || lower.includes('spending') || lower.includes('spent')) {
    return { text: 'Here is your **expense summary**:', tool: { name: 'get_expense_summary', args: {} } };
  }
  // 8) Find / search a customer
  const findM = lower.match(/(?:find|search)\s*customer\s*(?:named|called)?\s*"?([a-z0-9 .&]+)"?/);
  if (findM && findM[1].trim()) {
    const q = findM[1].trim();
    return { text: `Searching for customer **"${q}"**…`, tool: { name: 'search_customer', args: { query: q } } };
  }
  // 9) Business overview / profit / revenue / how is my business doing
  if (lower.includes('business') || lower.includes('doing') || lower.includes('overview') || lower.includes('profit') || lower.includes('revenue') || lower.includes('earning') || lower.includes('income') || lower.includes('summary') || lower.includes('dashboard')) {
    return { text: 'Here is your **business overview**:', tool: { name: 'get_business_overview', args: {} } };
  }
  return null;
}

function ruleBasedResponse(msg, orgId) {
  const lower = msg.toLowerCase();

  // ── BUSINESS QUESTIONS — answered from live data ──
  const biz = businessIntent(lower);
  if (biz) return { text: biz.text, toolCalls: [biz.tool] };

  // These requests are intentionally not executable by an LLM.
  if (/\b(sql|code|file|deploy|repair|fix system|diagnos|server error)\b/.test(lower)) {
    return { text: 'For privacy and safety I cannot run SQL, change code, deploy, or repair the server from chat. Ask an administrator to use the Diagnostics page instead.', toolCalls: [] };
  }

  // Default help — no anonymous third-party provider is used in private mode.
  return {
    text: `I can answer live ERP questions now: **GST payable**, **who owes me money**, **top customers**, **inventory**, **expenses**, or **how is my business doing?**\n\nFor open-ended AI chat, add a valid Gemini or Groq API key in Render → Environment. Public anonymous AI is disabled by default to protect business data.`,
    toolCalls: []
  };
}

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

    case 'get_business_overview':
      return `📈 **Business Overview**\n\n` +
        `💰 Total Revenue: **₹${result.revenue?.toLocaleString('en-IN')}**\n` +
        `✅ Paid: ₹${result.paid?.toLocaleString('en-IN')} | ⏳ Receivables: ₹${result.pendingReceivables?.toLocaleString('en-IN')}\n` +
        `🏦 Payables to suppliers: ₹${result.payables?.toLocaleString('en-IN')} | Expenses: ₹${result.totalExpenses?.toLocaleString('en-IN')}\n` +
        `📊 Estimated Profit: ₹${result.estimatedProfit?.toLocaleString('en-IN')}\n` +
        `🧾 GST Payable: ₹${result.netGSTPayable?.toLocaleString('en-IN')}\n` +
        `📦 Customers: ${result.counts?.customers} · Invoices: ${result.counts?.invoices} · Quotations: ${result.counts?.quotations} · Purchase Bills: ${result.counts?.purchaseBills}\n\n`;

    case 'get_dashboard_stats':
      return `📊 **Dashboard Stats**\n\n` +
        `💰 Revenue: ₹${result.totalRevenue?.toLocaleString('en-IN')} (Paid: ₹${result.paidRevenue?.toLocaleString('en-IN')})\n` +
        `⏳ Pending: ${result.pendingCount} invoices · ₹${result.pendingAmount?.toLocaleString('en-IN')}\n` +
        `💸 Expenses: ₹${result.totalExpenses?.toLocaleString('en-IN')} | Net: ₹${result.netProfit?.toLocaleString('en-IN')}\n` +
        (result.lowStockItems?.length ? `📦 Low stock: ${result.lowStockItems.map(i => `${i.item_name} (${i.quantity} left)`).join(', ')}\n` : '') +
        (result.recentInvoices?.length ? `\n**Recent invoices:**\n` + result.recentInvoices.slice(0, 5).map(inv => `- ${inv.invoice_number} — ${inv.customer_name}: ₹${parseFloat(inv.total_amount).toLocaleString('en-IN')} (${inv.payment_status})`).join('\n') : '') + '\n\n';

    case 'get_outstanding_invoices':
      if (!result.invoices?.length) return '✅ **No unpaid invoices!** Everyone has paid.\n\n';
      return `⏳ **Outstanding Receivables: ₹${result.totalUnpaid?.toLocaleString('en-IN')}** (${result.invoices.length} unpaid)\n` +
        `⚠️ Of which overdue: ₹${result.overdueAmount?.toLocaleString('en-IN')} (${result.overdueCount} invoices)\n\n` +
        result.invoices.slice(0, 15).map(inv => `- **${inv.invoice_number}** — ${inv.customer_name}: ₹${parseFloat(inv.total_amount).toLocaleString('en-IN')}${inv.isOverdue ? ` (${inv.overdueDays}d overdue)` : ''}`).join('\n') + '\n\n';

    case 'get_outstanding_bills':
      if (!result.bills?.length) return '✅ **No unpaid purchase bills.**\n\n';
      return `🏦 **Payables to suppliers: ₹${result.totalPayables?.toLocaleString('en-IN')}** (${result.billCount} bills)\n\n` +
        result.bills.slice(0, 15).map(b => `- **${b.bill_number}** — ${b.supplier_name}: ₹${parseFloat(b.total_amount).toLocaleString('en-IN')}`).join('\n') + '\n\n';

    case 'get_gst_summary':
      return `🧾 **GST Summary (FY ${result.financialYear})**\n\n` +
        `Output GST: ₹${result.outputTotal?.toLocaleString('en-IN')} (CGST ${result.outputGST?.c} + SGST ${result.outputGST?.s} + IGST ${result.outputGST?.i})\n` +
        `Input GST: ₹${result.inputTotal?.toLocaleString('en-IN')} (CGST ${result.inputGST?.c} + SGST ${result.inputGST?.s} + IGST ${result.inputGST?.i})\n` +
        `**Net Payable: ₹${result.totalNetPayable?.toLocaleString('en-IN')}**\n\n`;

    case 'get_top_customers':
      if (!result.customers?.length) return 'No customers found.\n\n';
      return `👑 **Top Customers by Business:**\n\n` +
        result.customers.map((c, i) => `${i + 1}. **${c.name}** — ₹${parseFloat(c.totalBusiness).toLocaleString('en-IN')} (${c.city || ''}${c.gstin ? ', GSTIN ' + c.gstin : ''})`).join('\n') + '\n\n';

    case 'search_customer':
      if (!result.customers?.length) return 'No matching customers found.\n\n';
      return `🔎 **Found ${result.count} customer(s):**\n\n` +
        result.customers.map(c => `- **${c.name}**${c.trade_name ? ' (' + c.trade_name + ')' : ''} — 📞 ${c.phone || 'N/A'}, GSTIN: ${c.gstin || 'N/A'}, ${c.city || ''}`).join('\n') + '\n\n';

    case 'get_inventory_status':
      return `📦 **Inventory: ${result.totalItems} items** — ${result.lowStockCount} low-stock alerts\n\n` +
        (result.lowStockItems?.length ? `⚠️ **Low stock:**\n` + result.lowStockItems.map(i => `- ${i.item_name}: ${i.quantity} ${i.unit || ''} left (min ${i.min_quantity})`).join('\n') + '\n\n' : '✅ No low-stock items.\n\n');

    case 'get_recent_payments':
      return `💵 **Payments received: ₹${result.totalReceived?.toLocaleString('en-IN')}**\n\n` +
        (result.payments?.slice(0, 10).map(p => `- ${p.payment_date ? String(p.payment_date).slice(0, 10) : ''} — ${p.customer_name || 'N/A'}: ₹${parseFloat(p.amount).toLocaleString('en-IN')} (${p.payment_mode})`).join('\n') || '') + '\n\n';

    case 'get_expense_summary':
      return `💸 **Total Expenses: ₹${result.totalExpenses?.toLocaleString('en-IN')}**\n\n` +
        (result.byCategory?.length ? `**By category:**\n` + result.byCategory.map(c => `- ${c.category || 'Other'}: ₹${parseFloat(c.t).toLocaleString('en-IN')}`).join('\n') + '\n\n' : '');

    case 'get_knowledge':
      if (!result.results?.length) return `No knowledge found for "${result.query}".\n\n`;
      return `📚 **Knowledge (${result.found} result${result.found === 1 ? '' : 's'}):**\n\n` +
        result.results.map(r => `### ${r.title} (${r.category})\n${r.content}`).join('\n\n') + '\n\n';

    default:
      return `📋 **${name}**: ${JSON.stringify(result).substring(0, 1000)}\n\n`;
  }
}


module.exports = { businessIntent, ruleBasedResponse, formatToolResult };
