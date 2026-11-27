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

const { SAFE_TOOL_DEFINITIONS, executeTool } = require('../ai/tools');
const { callAI, sleep, chunkText, streamFinalAnswer, callSingleProvider, safeFetch } = require('../ai/providers');
const { businessIntent, ruleBasedResponse, formatToolResult } = require('../ai/replies');
// ═══════════════════════════════════════════════
// MAIN CHAT ENDPOINT
// ═══════════════════════════════════════════════

router.post('/chat', auth, adminOnly, async (req, res) => {
  try {
    const { messages = [], provider: requestedProvider } = req.body || {};
    if (!Array.isArray(messages) || messages.length > 30 || messages.some(m => typeof m.content !== 'string' || m.content.length > 4000))
      return res.status(400).json({ success: false, msg: 'Message history is too long or invalid.' });
    const orgId = req.user.organization_id;
    const userMessage = messages[messages.length - 1]?.content || '';

    // ═══ INSTANT BUSINESS ANSWERS ═══
    // Clear business questions ("How much GST do I owe?") are answered DIRECTLY
    // from the live database — no LLM round-trip, so they're instant and never
    // fail even if the free AI provider is slow or down.
    const bizIntent = businessIntent(userMessage.toLowerCase());
    if (bizIntent) {
      const result = await executeTool(bizIntent.tool.name, bizIntent.tool.args, orgId);
      const formatted = formatToolResult(bizIntent.tool.name, result);
      return res.json({
        success: true,
        message: bizIntent.text + '\n\n' + formatted,
        toolCalls: [{ name: bizIntent.tool.name, args: bizIntent.tool.args, result }],
        provider: 'instant (live data)'
      });
    }
    
    // ── ALWAYS USE AI FLOW ──
    // Pollinations AI is FREE and needs NO API key, so AI is ALWAYS available!
    // Other providers (Gemini, Groq, DeepSeek) are tried for higher rate limits if keys are set
    const allMessages = [
      ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', content: m.content })),
    ];

    // If user selected a specific provider, try ONLY that one first
    if (requestedProvider && requestedProvider !== 'auto') {
      const singleResult = await callSingleProvider(requestedProvider, allMessages, SAFE_TOOL_DEFINITIONS);
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
          const nextResult = await callSingleProvider(requestedProvider, currentMessages, SAFE_TOOL_DEFINITIONS);
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
      const aiResponse = await callAI(currentMessages, SAFE_TOOL_DEFINITIONS);
      
      if (!aiResponse) {
        // All AI providers failed (even Pollinations), fall back to rule-based
        const ruleResult = ruleBasedResponse(userMessage, orgId);
        if (ruleResult.toolCalls?.length > 0) {
          const toolResults = [];
          for (const tc of ruleResult.toolCalls) {
            const result = await executeTool(tc.name, tc.args, orgId);
            toolResults.push({ name: tc.name, args: tc.args, result });
          }
          // Format the tool results into a readable answer (not raw JSON)
          const formatted = toolResults.map(tr => formatToolResult(tr.name, tr.result)).join('');
          return res.json({
            success: true,
            message: ruleResult.text + '\n\n' + formatted,
            toolCalls: toolResults,
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
// ═══════════════════════════════════════════════
// DIAGNOSTIC ENDPOINT — Tests all AI providers
// ═══════════════════════════════════════════════

router.get('/test', auth, adminOnly, async (req, res) => {
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
          model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
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
    GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
    DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
    CEREBRAS_API_KEY: !!process.env.CEREBRAS_API_KEY,
    OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
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
  let primary = 'Private ERP answers (no external model)';
  if (keys.GROQ_API_KEY) { active.push('Groq'); primary = primary === 'Pollinations AI (Free)' ? 'Groq' : primary; }
  if (keys.GEMINI_API_KEY) { active.push('Gemini 2.5 Pro + Flash'); if (primary === 'Pollinations AI (Free)') primary = 'Gemini 2.5 Pro'; }
  if (keys.DEEPSEEK_API_KEY) { active.push('DeepSeek V3'); if (primary === 'Pollinations AI (Free)') primary = 'DeepSeek V3'; }
  if (keys.CEREBRAS_API_KEY) { active.push('Cerebras Llama 3.3'); }
  if (keys.OPENROUTER_API_KEY) { active.push('OpenRouter'); }
  if (keys.OPENAI_API_KEY) { active.push('OpenAI GPT-4o'); }
  // Pollinations is ALWAYS available (no key needed!)
  if (process.env.ALLOW_PUBLIC_AI === 'true') { active.push('Pollinations AI (Free)'); if (active.length === 1) primary = 'Pollinations AI (Free)'; }
  if (active.length && primary === 'Private ERP answers (no external model)') primary = active[0];
  
  res.json({
    success: true,
    aiEnabled: true, // private read-only ERP answers work even without a model
    modelConfigured: active.length > 0, // key presence does not prove it works
    providers: active,
    primaryProvider: primary,
    toolsAvailable: SAFE_TOOL_DEFINITIONS.length,
    streamingSupported: true,
    privateMode: process.env.ALLOW_PUBLIC_AI !== 'true',
    note: 'Private mode: anonymous public AI is disabled unless ALLOW_PUBLIC_AI=true. Configure a working provider key in Render; live ERP metrics work without an AI provider.'
  });
});

// ═══════════════════════════════════════════════════════════════
// STREAMING CHAT — token-by-token SSE responses.
// Events: { delta } { tool } { done } { error }
// ═══════════════════════════════════════════════════════════════
router.post('/stream', auth, adminOnly, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const send = (event, data) => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (e) {} };

  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const rawMessage = String(req.body?.message || '').trim().slice(0, 4000);
  const providedHistory = Array.isArray(req.body?.messages) ? req.body.messages.slice(-20).filter(m => typeof m.content === 'string').map(m => ({ ...m, content: m.content.slice(0, 4000) })) : [];

  if (!rawMessage) { send('error', { msg: 'Empty message' }); return res.end(); }

  try {
    // ── 1) INSTANT BUSINESS ANSWERS (live data, never fails) ──
    const biz = businessIntent(rawMessage.toLowerCase());
    if (biz) {
      const result = await executeTool(biz.tool.name, biz.tool.args, orgId);
      send('tool', { name: biz.tool.name, args: biz.tool.args, result });
      const full = biz.text + '\n\n' + formatToolResult(biz.tool.name, result);
      for (const chunk of chunkText(full, 22)) { send('delta', { text: chunk }); await sleep(6); }
      send('done', { provider: 'instant (live data)' });
      return res.end();
    }

    // ── 2) Build history (provided first, else rule of thumb) ──
    const history = providedHistory
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'model', content: m.content }));
    const working = [...history, { role: 'user', content: rawMessage }];

    // ── 3) TOOL RESOLUTION LOOP (non-streaming; emit tool events live) ──
    let finalResponse = '';
    let usedProvider = 'unknown';
    let current = [...working];
    let maxIter = 6;
    while (maxIter-- > 0) {
      const ai = await callAI(current, SAFE_TOOL_DEFINITIONS);
      if (!ai) break;
      usedProvider = ai.provider || usedProvider;
      if (ai.toolCalls?.length) {
        for (const tc of ai.toolCalls) {
          const result = await executeTool(tc.name, tc.args, orgId);
          send('tool', { name: tc.name, args: tc.args, result });
          current.push({ role: 'tool_call', name: tc.name, args: tc.args });
          current.push({ role: 'tool_result', name: tc.name, result });
        }
        if (ai.text) finalResponse = ai.text;
        continue;
      }
      finalResponse = ai.text || finalResponse;
      break;
    }

    // ── 4) STREAM the final answer ──
    if (finalResponse) {
      // Tool loop already produced the answer — stream it in chunks
      for (const chunk of chunkText(finalResponse, 22)) { send('delta', { text: chunk }); await sleep(6); }
    } else {
      const provider = await streamFinalAnswer(working, delta => send('delta', { text: delta }));
      if (provider) usedProvider = provider;
    }

    // ── 5) If everything failed, rule-based fallback ──
    if (!finalResponse && usedProvider === 'unknown') {
      const ruleResult = ruleBasedResponse(rawMessage, orgId);
      if (ruleResult.toolCalls?.length) {
        const toolResults = [];
        for (const tc of ruleResult.toolCalls) {
          const result = await executeTool(tc.name, tc.args, orgId);
          send('tool', { name: tc.name, args: tc.args, result });
          toolResults.push({ name: tc.name, args: tc.args, result });
        }
        const formatted = toolResults.map(tr => formatToolResult(tr.name, tr.result)).join('');
        const full = ruleResult.text + '\n\n' + formatted;
        for (const chunk of chunkText(full, 22)) { send('delta', { text: chunk }); await sleep(6); }
        usedProvider = 'fallback';
      } else {
        for (const chunk of chunkText(ruleResult.text, 22)) { send('delta', { text: chunk }); await sleep(6); }
        usedProvider = 'fallback';
      }
    }

    send('done', { provider: usedProvider });
    return res.end();
  } catch (e) {
    console.error('Stream error:', e.message);
    send('error', { msg: 'AI stream error: ' + e.message });
    return res.end();
  }
});

// ═══════════════════════════════════════════════════════════════
// PROACTIVE INSIGHTS — real findings from the live database,
// shown when the assistant opens. Makes it feel genuinely smart.
// ═══════════════════════════════════════════════════════════════
router.get('/insights', auth, async (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const insights = [];
    const now = new Date();
    const year = now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear();
    const fyStart = `${year}-04-01`, fyEnd = `${year + 1}-03-31`;

    // Unpaid invoices (receivables)
    const unpaid = await db('invoices').where({ organization_id: orgId }).whereIn('payment_status', ['Unpaid', 'Partial']).count('id as c').sum('total_amount as t').first();
    if (parseInt(unpaid.c || 0) > 0) {
      insights.push({ type: 'money', icon: '💰', title: `${unpaid.c} unpaid invoice${unpaid.c == 1 ? '' : 's'}`, detail: `₹${parseFloat(unpaid.t || 0).toLocaleString('en-IN')} waiting to be collected`, question: 'Who owes me money?' });
    }

    // Low stock
    const low = await db('inventory').where({ organization_id: orgId }).whereRaw('quantity <= min_quantity').count('id as c').first();
    if (parseInt(low.c || 0) > 0) {
      insights.push({ type: 'stock', icon: '📦', title: `${low.c} item${low.c == 1 ? '' : 's'} low on stock`, detail: 'Below minimum quantity', question: 'Am I low on stock?' });
    }

    // GST payable this FY
    const outT = await db('invoices').where({ organization_id: orgId }).whereBetween('invoice_date', [fyStart, fyEnd]).sum('cgst_amount as c').sum('sgst_amount as s').sum('igst_amount as i').first();
    const inT = await db('purchase_bills').where({ organization_id: orgId }).whereBetween('bill_date', [fyStart, fyEnd]).sum('cgst_amount as c').sum('sgst_amount as s').sum('igst_amount as i').first();
    const outG = parseFloat(outT.c || 0) + parseFloat(outT.s || 0) + parseFloat(outT.i || 0);
    const inG = parseFloat(inT.c || 0) + parseFloat(inT.s || 0) + parseFloat(inT.i || 0);
    if (outG > inG) {
      insights.push({ type: 'gst', icon: '🧾', title: `GST payable ₹${(outG - inG).toLocaleString('en-IN')}`, detail: `FY ${year}-${String(year + 1).slice(2)} (output − input)`, question: 'How much GST do I owe?' });
    }

    // Unpaid supplier bills (payables)
    const bills = await db('purchase_bills').where({ organization_id: orgId }).whereIn('payment_status', ['Unpaid', 'Partial']).sum('total_amount as t').first();
    if (parseFloat(bills.t || 0) > 0) {
      insights.push({ type: 'bills', icon: '🏦', title: `₹${parseFloat(bills.t).toLocaleString('en-IN')} owed to suppliers`, detail: 'Unpaid purchase bills', question: 'What do I owe suppliers?' });
    }

    // Revenue this FY
    const rev = await db('invoices').where({ organization_id: orgId }).whereBetween('invoice_date', [fyStart, fyEnd]).sum('total_amount as t').first();
    if (parseFloat(rev.t || 0) > 0) {
      insights.push({ type: 'revenue', icon: '📈', title: `Revenue ₹${parseFloat(rev.t).toLocaleString('en-IN')} this FY`, detail: `FY ${year}-${String(year + 1).slice(2)}`, question: 'How is my business doing?' });
    }

    res.json({ success: true, insights });
  } catch (e) {
    res.json({ success: false, insights: [], msg: e.message });
  }
});

module.exports = router;
